// supabase/functions/generate-monthly-dues/index.ts
//
// Server-side version of Payment.jsx's runGenerateDues() + runDelinquencyCheck().
// Meant to be triggered by Supabase Cron (pg_cron), NOT by a logged-in user —
// so it has no user JWT and instead checks a shared CRON_SECRET.
//
// Idempotent: safe to run multiple times a day. It only actually inserts dues
// the first time it runs after a new month has started (checked via the
// "does a payment row already exist for this month's due_date?" query).
//
// Also the trigger point for the two things that need to happen once a new
// month starts (see Task 1b below): posting a single "Monthly HOA Dues"
// announcement (start = 1st, end = last day of month — shows as one calendar
// dot per day for that span, not a new post every day) and auto-sending the
// Statement of Account email to every resident with an outstanding balance.
// Both piggyback on this cron instead of needing a schedule of their own, and
// only fire on the 1st when dues were freshly generated this run — not on
// every subsequent "already generated" day for the rest of the month.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MONTHLY_DUE_DEFAULT = 150 // fallback if hoa_settings hasn't been created yet

const BILL_LINE_ITEMS_BASE = [
  { label: 'Security Guard',  category: 'Salaries',    fixedTotal: 22000 },
  { label: 'Electricity',     category: 'Utilities',   fixedTotal: 14000 },
  { label: 'Street Sweepers', category: 'Maintenance', fixedTotal: 1200  },
  { label: 'Water',           category: 'Utilities',   fixedTotal: 400   },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Now takes the current monthly due amount — configurable via hoa_settings,
// edited by Treasurer/President from Payment.jsx.
function buildLineItemBreakdown(monthlyDueAmount: number) {
  const totalBase = BILL_LINE_ITEMS_BASE.reduce((s, i) => s + i.fixedTotal, 0)
  const items: Array<{ label: string; category: string; amount: number }> = []
  let sumSoFar = 0
  BILL_LINE_ITEMS_BASE.forEach((item, idx) => {
    const amount = idx === BILL_LINE_ITEMS_BASE.length - 1
      ? Math.round((monthlyDueAmount - sumSoFar) * 100) / 100
      : Math.round((item.fixedTotal / totalBase) * monthlyDueAmount * 100) / 100
    sumSoFar = Math.round((sumSoFar + amount) * 100) / 100
    items.push({ label: item.label, category: item.category, amount })
  })
  return items
}

// ── Reference number generator ──────────────────────────────────────────────
// Generates a per-resident, per-month ref like SOA-202607-1F7A7D — same
// format as the Statement of Account's own reference number (see
// send-soa-emails/index.ts's generateSoaRef and Payment.jsx's soaRef), so all
// three match instead of the old HOA-MMYYYY-RAND4 format.
function generateRefNo(month: number, year: number, userId: string) {
  const mm = String(month + 1).padStart(2, '0')
  const uid = (userId || 'XXXXXX').slice(0, 6).toUpperCase()
  return `SOA-${year}${mm}-${uid}`
}

// ── Manila-time "today" ─────────────────────────────────────────────────────
// The Edge Function runtime thinks in UTC. We shift the clock forward 8 hours
// (PHT = UTC+8) and then read the UTC-getter fields off that shifted instant —
// this avoids depending on whatever the runtime's "local" timezone happens to
// be, so the date math is correct no matter where this actually executes.
function manilaDateParts() {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-indexed, matches Payment.jsx's getMonth()
    date: shifted.getUTCDate(),
  }
}

function ymd(year: number, month: number, date: number) {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(date).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// ── Advance-payment coverage ────────────────────────────────────────────────
// A row's due_date is the LAST month it covers, not the only one — an advance
// payment of N months rolls the (N-1) preceding months into that same row
// instead of getting rows of their own (mirrors Payment.jsx's monthsCoveredBy
// / formatMonthCoverage). So "does resident X already have a row covering
// this month" can't just check due_date falling inside this month's range —
// a resident who prepaid Aug+Sep back in July has ONE row with due_date =
// Sep 30, which sits outside August's [monthStart, monthEnd] window and was
// being missed, generating a duplicate/overlapping August due on top of an
// already-covered month.
function monthIndex(year: number, month: number) {
  return year * 12 + month
}

function monthsCoveredBy(amount: number, monthlyDueAmount: number) {
  return Math.max(1, Math.round(Number(amount || 0) / (monthlyDueAmount || 1)))
}

Deno.serve(async (req: Request) => {
  // ── Auth: this function is called by pg_cron, which has no user session.
  // Supabase's platform-level JWT check inspects the "Authorization" header
  // before our code runs — so a shared secret must go in "apikey" instead,
  // which only our own code checks. (See: Supabase "Securing Edge Functions"
  // guide, "Service-to-service calls" pattern.) Set this with:
  //   supabase secrets set CRON_SECRET=<some-long-random-string>
  const CRON_SECRET = Deno.env.get('CRON_SECRET')
  const providedKey = req.headers.get('apikey') ?? ''
  if (CRON_SECRET && providedKey !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // ── Read the current monthly due amount — configurable via hoa_settings,
    // edited by Treasurer/President from Payment.jsx. Falls back to the
    // default if the table/row doesn't exist yet.
    let monthlyDueAmount = MONTHLY_DUE_DEFAULT
    try {
      const { data: settings } = await supabase.from('hoa_settings').select('monthly_due_amount').eq('id', 1).single()
      if (settings?.monthly_due_amount != null) monthlyDueAmount = Number(settings.monthly_due_amount)
    } catch (_e) {
      // hoa_settings not set up yet — keep the default.
    }
    const delinquentThreshold = monthlyDueAmount * 3 // 3 months unpaid, at the current due amount

    const { year, month, date } = manilaDateParts()
    const statementDate = ymd(year, month, date)
    const monthStart = ymd(year, month, 1)
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const monthEnd = ymd(year, month, lastDay)

    // ── Task 1: generate this month's dues (idempotent, per-resident) ──────
    // Per-resident idempotency — a resident who already has a payment row for
    // this month (paid in advance, back-filled as 'pending' on approval,
    // etc.) is skipped individually rather than using their existing row to
    // bail out of billing everyone else. This used to check "does ANY row
    // exist this month" and skip the WHOLE batch if so, which silently left
    // every other resident unbilled whenever even one resident already had a
    // row for the month.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let duesResult: Record<string, any> = { skipped: true, reason: 'Already generated for this month.' }

    const { data: residentsRaw, error: residentsErr } = await supabase
      .from('profiles')
      .select('id, full_name, resident_type')
      .eq('account_status', 'active')
      .order('full_name')

    // Tenants aren't billed for HOA dues — only owners/residents are (mirrors
    // Payment.jsx's fetchResidentsList / runGenerateDues).
    const residents = (residentsRaw || []).filter((r: { resident_type?: string }) => (r.resident_type || '').toLowerCase() !== 'tenant')

    if (residentsErr) {
      duesResult = { success: false, error: residentsErr.message }
    } else if (residents?.length) {
      // Only a lower bound on due_date — an advance-payment row's due_date can
      // sit months ahead of "now" while still covering the current month, so
      // an upper bound of monthEnd would wrongly exclude it (see comment on
      // monthsCoveredBy above).
      const { data: existingFromThisMonthOn, error: existingErr } = await supabase
        .from('payments')
        .select('user_id, amount, due_date')
        .gte('due_date', monthStart)

      if (existingErr) {
        duesResult = { success: false, error: existingErr.message }
      } else {
        const currentIdx = monthIndex(year, month)
        const alreadyBilled = new Set<string>()
        ;(existingFromThisMonthOn || []).forEach((p: { user_id: string; amount: number; due_date: string }) => {
          if (!p.due_date) return
          const d = new Date(p.due_date)
          const dueIdx = monthIndex(d.getUTCFullYear(), d.getUTCMonth())
          const covered = monthsCoveredBy(p.amount, monthlyDueAmount)
          const startIdx = dueIdx - (covered - 1)
          if (startIdx <= currentIdx && currentIdx <= dueIdx) alreadyBilled.add(p.user_id)
        })
        const residentsNeeding = residents.filter((r: { id: string }) => !alreadyBilled.has(r.id))

        if (!residentsNeeding.length) {
          duesResult = { skipped: true, reason: 'Already generated for this month.' }
        } else {
          const lineItems = buildLineItemBreakdown(monthlyDueAmount)
          const rows = residentsNeeding.map((r: { id: string }) => ({
            user_id: r.id,
            amount: monthlyDueAmount,
            statement_date: statementDate,
            due_date: monthEnd,
            status: 'unpaid',
            reference_no: generateRefNo(month, year, r.id),
            line_items: lineItems,
          }))

          const { error: insertErr } = await supabase.from('payments').insert(rows)
          if (insertErr) {
            duesResult = { success: false, error: insertErr.message }
          } else {
            duesResult = { success: true, count: rows.length, month: MONTHS[month], year, amount: monthlyDueAmount }
            try {
              await supabase.from('system_logs').insert({
                action: 'AUTO_MONTHLY_DUE',
                details: `Generated ₱${monthlyDueAmount} monthly dues for ${rows.length} residents — ${MONTHS[month]} ${year}. Statement: ${statementDate}, Due: ${monthEnd}.`,
              })
            } catch (_e) {
              // Audit logging is best-effort — a schema mismatch here must not
              // block the actual dues generation above.
            }
          }
        }
      }
    } else {
      duesResult = { skipped: true, reason: 'No active residents found.' }
    }

    // ── Task 1b: post the monthly announcement + auto-send SOA emails ──────
    // Only on the 1st, and only when Task 1 actually inserted fresh dues this
    // run (duesResult.success) — NOT on every "skipped" day for the rest of
    // the month, and NOT on a later day where a single late-approved resident
    // backfilled a current-month row and incidentally made duesResult.success
    // true again. Replaces the old client-side version that used to live in
    // Announcements.jsx (only fired if an admin happened to have that page
    // open on the 1st — unreliable, and hardcoded ₱150 instead of the real
    // configurable hoa_settings amount).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let announcementResult: Record<string, any> = { skipped: true }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let soaResult: Record<string, any> = { skipped: true }

    if (date === 1 && duesResult.success) {
      const annTitle = `Monthly HOA Dues — ${MONTHS[month]} ${year}`

      try {
        // Idempotency guard — in case this cron fires more than once on the 1st.
        const { data: existingAnn } = await supabase
          .from('announcements')
          .select('id')
          .eq('title', annTitle)
          .limit(1)

        if (existingAnn?.length) {
          announcementResult = { skipped: true, reason: 'Already posted today.' }
        } else {
          const monthEndFmt = new Date(Date.UTC(year, month, lastDay))
            .toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
          const content =
            `This is your monthly reminder that HOA dues of ₱${monthlyDueAmount.toLocaleString('en-PH')} are now due for ${MONTHS[month]} ${year}. ` +
            `Please settle your payment on or before ${monthEndFmt}. ` +
            `For payments and inquiries, please contact the HOA Treasurer or any board member. Thank you for your continued support of our community.`

          const { error: annErr } = await supabase.from('announcements').insert([{
            title: annTitle,
            content,
            category: 'Financial',
            status: 'published',
            is_emergency: false,
            is_pinned: false,
            start_date: statementDate,
            end_date: monthEnd,
            author_name: 'System',
          }])

          if (annErr) {
            announcementResult = { success: false, error: annErr.message }
          } else {
            await supabase.from('notifications').insert([{
              title: annTitle,
              message: `Monthly HOA dues of ₱${monthlyDueAmount.toLocaleString('en-PH')} are due for ${MONTHS[month]} ${year}. Due date: ${monthEndFmt}.`,
              is_read: false,
              created_at: new Date().toISOString(),
            }])
            announcementResult = { success: true, title: annTitle }
          }
        }
      } catch (e) {
        announcementResult = { success: false, error: e instanceof Error ? e.message : String(e) }
      }

      // Auto-send the Statement of Account email to every resident with an
      // outstanding balance — server-to-server call to send-soa-emails, using
      // the service role key as the bearer token (this function has no user
      // session to forward). The "Send SOA to All" button in Payment.jsx still
      // works exactly as before for manual/ad-hoc re-sends.
      try {
        const soaRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-soa-emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ viewMode: 'both' }),
        })
        soaResult = await soaRes.json()
      } catch (e) {
        soaResult = { success: false, error: e instanceof Error ? e.message : String(e) }
      }

      try {
        await supabase.from('system_logs').insert({
          activity: 'AUTO_MONTHLY_ANNOUNCEMENT_AND_SOA',
          severity: 'info',
          details: `[SYSTEM] Posted "${annTitle}" and auto-sent SOA emails — sent: ${soaResult.sent ?? 0}, failed: ${soaResult.failed ?? 0}.`,
        })
      } catch (_e) {
        // Best-effort, same as the dues-generation log above.
      }
    }

    // ── Task 2: delinquency check (3 months unpaid, at the current due amount) ─
    // 'pending' is excluded on purpose — it's used for back-filled dues on
    // newly-approved residents (see Payment.jsx / AccountApproval.jsx's
    // backfillPastDues), which are unverified history, not a confirmed missed
    // payment. They must not by themselves flip a brand-new resident straight
    // to delinquent before the Treasurer has verified them.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let delinquencyResult: Record<string, any> = { success: true, count: 0 }

    const { data: unpaidPayments, error: unpaidErr } = await supabase
      .from('payments')
      .select('user_id, amount')
      .in('status', ['unpaid', 'overdue'])

    if (unpaidErr) {
      delinquencyResult = { success: false, error: unpaidErr.message }
    } else if (unpaidPayments?.length) {
      const balanceMap: Record<string, number> = {}
      unpaidPayments.forEach((p: { user_id: string; amount: number }) => {
        balanceMap[p.user_id] = (balanceMap[p.user_id] || 0) + Number(p.amount || 0)
      })

      const eligibleIds = Object.entries(balanceMap)
        .filter(([, bal]) => bal >= delinquentThreshold)
        .map(([id]) => id)

      if (eligibleIds.length) {
        const { data: activeResidents, error: activeErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', eligibleIds)
          .eq('account_status', 'active')

        if (activeErr) {
          delinquencyResult = { success: false, error: activeErr.message }
        } else if (activeResidents?.length) {
          const idsToFlag = activeResidents.map((r: { id: string }) => r.id)
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ account_status: 'delinquent' })
            .in('id', idsToFlag)

          if (updateErr) {
            delinquencyResult = { success: false, error: updateErr.message }
          } else {
            delinquencyResult = {
              success: true,
              count: idsToFlag.length,
              names: activeResidents.map((r: { full_name: string }) => r.full_name),
            }
            try {
              await supabase.from('system_logs').insert({
                action: 'AUTO_DELINQUENT',
                details: `Marked ${idsToFlag.length} resident(s) as delinquent — unpaid balance ≥ ₱${delinquentThreshold}. Residents: ${activeResidents
                  .map((r: { full_name: string }) => r.full_name)
                  .join(', ')}`,
              })
            } catch (_e) {
              // Best-effort, same as above.
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ dues: duesResult, delinquency: delinquencyResult, announcement: announcementResult, soa: soaResult }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
