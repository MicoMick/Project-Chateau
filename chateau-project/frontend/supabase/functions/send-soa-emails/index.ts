// supabase/functions/send-soa-emails/index.ts
// Sends a formal HOA Statement of Account email to every resident
// with an outstanding balance, via Resend.
//
// Secrets required:
//   RESEND_API_KEY=re_...
//   TEST_OVERRIDE_EMAIL=your@email.com  ← remove once domain is verified

import { createClient } from 'npm:@supabase/supabase-js@2'

const MONTHLY_DUE_DEFAULT = 150 // fallback used only if hoa_settings hasn't been created yet

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fc  = (n: number) =>
  `&#8369;${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
const fd  = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
const fdShort = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmShort = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-PH', { month: 'short' })

function phtToday() {
  const s = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth()+1).padStart(2,'0')}-${String(s.getUTCDate()).padStart(2,'0')}`
}

// ── Monthly Due Breakdown ─────────────────────────────────────────────────────
// Proportionally splits the current monthly due (configurable via hoa_settings)
// among HOA's actual monthly operating expenses.
// - Security Guard Salary and Street Sweeper Salary are FIXED costs.
// - Electricity Bill and Water Bill are VARIABLE (based on actual monthly usage).
// The last item absorbs any rounding difference so the total is ALWAYS exact.
function buildLineItemBreakdown(monthlyDueAmount: number) {
  const base = [
    { label: 'Security Guard Salary', category: 'Salaries',    fixedTotal: 22000, type: 'Fixed'    },
    { label: 'Electricity Bill',      category: 'Utilities',   fixedTotal: 14000, type: 'Variable' },
    { label: 'Street Sweeper Salary', category: 'Maintenance', fixedTotal: 1200,  type: 'Fixed'    },
    { label: 'Water Bill',            category: 'Utilities',   fixedTotal: 400,   type: 'Variable' },
  ]
  const tot = base.reduce((s, i) => s + i.fixedTotal, 0)
  const items: Array<{ label: string; category: string; type: string; amount: number }> = []
  let sumSoFar = 0

  base.forEach((item, idx) => {
    let amount: number
    if (idx === base.length - 1) {
      // Last item = due amount minus what's already allocated — prevents rounding drift
      amount = Math.round((monthlyDueAmount - sumSoFar) * 100) / 100
    } else {
      amount = Math.round((item.fixedTotal / tot) * monthlyDueAmount * 100) / 100
    }
    sumSoFar = Math.round((sumSoFar + amount) * 100) / 100
    items.push({ label: item.label, category: item.category, type: item.type, amount })
  })
  return items
}

// ── Reference Number ──────────────────────────────────────────────────────────
function generateSoaRef(userId: string, date: string) {
  const ym   = date.slice(0, 7).replace('-', '')
  const uid  = userId.slice(0, 6).toUpperCase()
  return `SOA-${ym}-${uid}`
}

// ── Formal SOA HTML ───────────────────────────────────────────────────────────
function buildFormalSoaHtml(
  resident: { full_name: string; fullAddress: string; email: string; id: string },
  unpaidList: Array<{
    amount: number
    due_date: string
    statement_date: string | null
    reference_no: string | null
    status: string
    line_items?: Array<{ label: string; category: string; amount: number }> | null
  }>,
  paidHistory: Array<{
    amount: number
    due_date: string
    paid_at: string | null
    payer_reference_no: string | null
    reference_no: string | null
  }>,
  viewMode: 'outstanding' | 'history' | 'both' = 'both',
  monthlyDueAmount: number = MONTHLY_DUE_DEFAULT,
  qrCodeUrl: string | null = null,
): string {
  const showOutstanding = viewMode === 'outstanding' || viewMode === 'both'
  const showHistory     = viewMode === 'history'     || viewMode === 'both'

  const todayStr    = phtToday()
  const todayFmt    = fd(todayStr)
  // Ascending (oldest → newest) — used for date-range math (earliest due date,
  // billing period span). Kept separate from the display order below.
  const sorted      = [...unpaidList].sort(
    (a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()
  )
  // Descending (newest → oldest) — for display, so a freshly-generated month's
  // due appears above older unpaid months in the emailed table.
  const sortedDesc  = [...sorted].reverse()
  const totalDue    = sorted.reduce((s, p) => s + Number(p.amount || 0), 0)
  const isSettled   = sorted.length === 0
  const monthsOwed  = sorted.length
  const earliestDue = isSettled ? null : sorted[0]?.due_date
  const soaRef      = generateSoaRef(resident.id, todayStr)

  // Payment history — chronological order (oldest → newest), capped to the
  // most recent 12 entries (cap applied before the chronological sort so we
  // keep the newest 12 without disturbing their display order).
  const paidHistoryChrono = [...paidHistory]
    .sort((a, b) => new Date(b.due_date || b.paid_at || 0).getTime() - new Date(a.due_date || a.paid_at || 0).getTime())
    .slice(0, 12)
    .sort((a, b) => new Date(a.due_date || a.paid_at || 0).getTime() - new Date(b.due_date || b.paid_at || 0).getTime())

  const lineItems = sorted.find(p => Array.isArray(p.line_items) && p.line_items!.length)?.line_items
    || buildLineItemBreakdown(monthlyDueAmount)

  // ── Table row helpers ─────────────────────────────────────────────────────
  const TH = (s: string) =>
    `background:#006837;color:#fff;padding:7px 10px;text-align:left;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;`
  const THR = TH('') + 'text-align:right;'

  // Breakdown rows (only when there are unpaid months)
  const breakdownRows = isSettled ? '' : lineItems.map((item, i) => {
    const rowBg = i % 2 === 0 ? '#f8fafc' : '#fff'
    const typeColor = (item as any).type === 'Variable' ? '#64748b' : '#374151'
    const typeBadge = (item as any).type
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;border:1px solid;${
          (item as any).type === 'Fixed'
            ? 'color:#166534;border-color:#bbf7d0;background:#f0fdf4;'
            : 'color:#64748b;border-color:#e2e8f0;background:#f8fafc;'
        }">${(item as any).type}</span>`
      : ''
    const monthlyAmt = fc(item.amount)
    const totalAmt   = fc(item.amount * monthsOwed)
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};">
        ${item.label} &nbsp;${typeBadge}
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};font-size:10px;color:#64748b;">${item.category}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};text-align:right;">${monthlyAmt}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};text-align:right;font-weight:bold;">${totalAmt}</td>
    </tr>`
  }).join('')

  // Outstanding charges rows — newest due first
  const chargeRows = sortedDesc.map((p, i) => {
    const rowBg      = i % 2 === 0 ? '#fef2f2' : '#fff'
    const statusClr  = p.status === 'overdue' ? '#dc2626' : '#d97706'
    const statusCap  = (p.status || 'Unpaid').charAt(0).toUpperCase() + (p.status || 'Unpaid').slice(1)
    const periodLabel = p.due_date
      ? new Date(p.due_date).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
      : '—'
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};">${periodLabel}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};">Monthly HOA Dues</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};">${fdShort(p.statement_date)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};">${fdShort(p.due_date)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};font-size:10px;">${p.reference_no || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};font-weight:bold;color:${statusClr};">${statusCap}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};text-align:right;font-weight:bold;">${fc(p.amount)}</td>
    </tr>`
  }).join('')

  // Payment history rows — chronological order, oldest of the last 12 first.
  // A single payment can cover more than one month's due (paid in advance),
  // in which case show the period as a range ending on the due_date rather
  // than labeling it with just the due month.
  const histRows = paidHistoryChrono.map((p, i) => {
    const rowBg = i % 2 === 0 ? '#f0fdf4' : '#fff'
    const months = monthlyDueAmount > 0 ? Math.round(Number(p.amount || 0) / monthlyDueAmount) : 1
    let period = '—'
    if (p.due_date) {
      if (months > 1) {
        const end = new Date(p.due_date)
        const start = new Date(end)
        start.setMonth(start.getMonth() - (months - 1))
        period = start.getFullYear() === end.getFullYear()
          ? `${fmShort(start)} to ${fmShort(end)} ${end.getFullYear()}`
          : `${fmShort(start)} ${start.getFullYear()} to ${fmShort(end)} ${end.getFullYear()}`
      } else {
        period = new Date(p.due_date).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
      }
    }
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};">${period}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};">${fdShort(p.paid_at)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};font-size:10px;">${p.payer_reference_no || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};font-size:10px;">${p.reference_no || '—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;background:${rowBg};text-align:right;font-weight:bold;color:#166534;">${fc(p.amount)}</td>
    </tr>`
  }).join('')

  // ── Document ─────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>HOA Statement of Account — ${resident.full_name}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
<table width="680" cellpadding="0" cellspacing="0"
  style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);max-width:100%;">

  <!-- ── Letterhead ── -->
  <tr><td style="background:#006837;padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:22px 28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px;vertical-align:middle;">
              <img src="https://chateaureals.com/ChataueLogo.svg" alt="CREVHAI Logo" width="44" height="44" style="display:block;" />
            </td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:9px;font-weight:bold;color:#a7f3d0;text-transform:uppercase;letter-spacing:.08em;">Official Document</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#fff;letter-spacing:-.3px;">Statement of Account</p>
              <p style="margin:2px 0 0;font-size:11px;color:#a7f3d0;">Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)</p>
            </td>
          </tr></table>
        </td>
        <td style="padding:22px 28px;text-align:right;vertical-align:top;">
          <p style="margin:0;font-size:9px;color:#a7f3d0;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;">Reference No.</p>
          <p style="margin:3px 0 0;font-size:13px;font-weight:900;color:#FFF200;letter-spacing:.04em;">${soaRef}</p>
          <p style="margin:6px 0 0;font-size:10px;color:#a7f3d0;">Issued: ${todayFmt}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ── Status banner ── -->
  <tr><td style="background:${isSettled ? '#f0fdf4' : '#fef2f2'};padding:12px 28px;border-bottom:2px solid ${isSettled ? '#bbf7d0' : '#fecaca'};">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <p style="margin:0;font-size:10px;font-weight:bold;color:${isSettled ? '#166534' : '#b91c1c'};text-transform:uppercase;letter-spacing:.05em;">
            ${isSettled ? '✓ Account Status: Fully Settled' : '⚠ Account Status: Payment Required'}
          </p>
          ${!isSettled ? `<p style="margin:3px 0 0;font-size:11px;color:#991b1b;">
            Payment due on or before <strong>${fd(earliestDue)}</strong>
          </p>` : ''}
        </td>
        ${!isSettled ? `<td style="text-align:right;">
          <p style="margin:0;font-size:10px;font-weight:bold;color:#b91c1c;text-transform:uppercase;letter-spacing:.05em;">Total Amount Due</p>
          <p style="margin:2px 0 0;font-size:22px;font-weight:900;color:#dc2626;">${fc(totalDue)}</p>
        </td>` : ''}
      </tr>
    </table>
  </td></tr>

  <!-- ── Account info ── -->
  <tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="vertical-align:top;padding-right:12px;">
          <p style="margin:0;font-size:9px;font-weight:bold;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Account Holder</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:900;color:#0f172a;">${resident.full_name}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#64748b;">${resident.fullAddress || 'N/A'}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#64748b;">${resident.email || ''}</p>
        </td>
        <td width="50%" style="vertical-align:top;padding-left:12px;border-left:1px solid #f1f5f9;">
          <p style="margin:0;font-size:9px;font-weight:bold;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Billing Period</p>
          <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#0f172a;">
            ${monthsOwed > 0
              ? `${new Date(sorted[0].due_date).toLocaleDateString('en-PH',{month:'long',year:'numeric'})} — ${new Date(sorted[sorted.length-1].due_date).toLocaleDateString('en-PH',{month:'long',year:'numeric'})}`
              : 'All periods settled'}
          </p>
          <p style="margin:4px 0 0;font-size:10px;color:#64748b;">
            Months unpaid: <strong style="color:${monthsOwed > 0 ? '#dc2626' : '#166534'};">${monthsOwed}</strong>
            &nbsp;·&nbsp; Monthly Due: <strong>${fc(monthlyDueAmount)}</strong>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 28px 0;">

    ${showOutstanding ? (!isSettled ? `
    <!-- ── Monthly Due Breakdown ── -->
    <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#006837;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #006837;padding-bottom:5px;">
      Monthly Due Breakdown — What Your ${fc(monthlyDueAmount)}/month Covers
    </p>
    <p style="margin:0 0 8px;font-size:10px;color:#94a3b8;font-style:italic;">
      * Fixed costs are charged at the same rate every month. Variable costs are estimates based on actual utility bills.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;margin-bottom:20px;">
      <thead><tr>
        <th style="${TH('')}width:35%;">Item</th>
        <th style="${TH('')}width:18%;">Category</th>
        <th style="${THR}width:20%;">Per Month</th>
        <th style="${THR}width:27%;">&times;&nbsp;${monthsOwed} Month${monthsOwed !== 1 ? 's' : ''}</th>
      </tr></thead>
      <tbody>${breakdownRows}</tbody>
      <tfoot><tr>
        <td colspan="3" style="padding:8px 10px;font-weight:bold;text-align:right;background:#f0fdf4;border-top:2px solid #006837;font-size:12px;">Total:</td>
        <td style="padding:8px 10px;font-weight:900;text-align:right;background:#f0fdf4;border-top:2px solid #006837;color:#006837;font-size:13px;">${fc(totalDue)}</td>
      </tr></tfoot>
    </table>

    <!-- ── Outstanding Charges ── -->
    <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#006837;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #006837;padding-bottom:5px;">
      Outstanding Charges
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;margin-bottom:20px;">
      <thead><tr>
        <th style="${TH('')}">Period</th>
        <th style="${TH('')}">Description</th>
        <th style="${TH('')}">Statement Date</th>
        <th style="${TH('')}">Due Date</th>
        <th style="${TH('')}">Reference #</th>
        <th style="${TH('')}">Status</th>
        <th style="${THR}">Amount</th>
      </tr></thead>
      <tbody>${chargeRows}</tbody>
      <tfoot><tr>
        <td colspan="6" style="padding:8px 10px;font-weight:bold;text-align:right;background:#fef2f2;border-top:2px solid #dc2626;">Total Amount Due:</td>
        <td style="padding:8px 10px;font-weight:900;text-align:right;background:#fef2f2;border-top:2px solid #dc2626;color:#dc2626;font-size:13px;">${fc(totalDue)}</td>
      </tr></tfoot>
    </table>

    <!-- ── Payment Instructions ── -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:11px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:.04em;">&#128179; Payment Instructions</p>
        <p style="margin:6px 0 0;font-size:11px;color:#78350f;line-height:1.7;">
          Please settle your outstanding balance on or before <strong>${fd(earliestDue)}</strong> to avoid late penalties.<br>
          Payments may be made at the <strong>HOA Office</strong> or through your designated <strong>HOA Treasurer</strong>.<br>
          Present this Statement of Account as your billing reference (Ref. No. <strong>${soaRef}</strong>).<br>
          <strong>Accounts with an unpaid balance of &#8369;450 or more (approximately 3 months) are automatically flagged delinquent
          and will have mobile app access locked until the balance is settled.</strong>
        </p>
        ${qrCodeUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr><td align="center">
            <img src="${qrCodeUrl}" alt="GCash QR Code" width="150" style="border:1px solid #fde68a;border-radius:8px;display:block;" />
            <p style="margin:6px 0 0;font-size:10px;color:#92400e;font-weight:900;">Scan this QR Code to pay directly</p>
          </td></tr>
        </table>
        ` : ''}
      </td></tr>
    </table>
    ` : `
    <!-- ── Settled notice ── -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:18px;text-align:center;">
        <p style="margin:0;font-size:16px;">&#10003;</p>
        <p style="margin:4px 0 0;font-size:13px;font-weight:900;color:#166534;">Account Fully Settled</p>
        <p style="margin:4px 0 0;font-size:11px;color:#15803d;">No outstanding dues. Thank you for your prompt payments!</p>
      </td></tr>
    </table>
    `) : ''}

    ${showHistory ? (paidHistoryChrono.length > 0 ? `
    <!-- ── Payment History — chronological, oldest of the last 12 first ── -->
    <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#006837;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #006837;padding-bottom:5px;">
      Past Recent Payment History
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:11px;margin-bottom:20px;">
      <thead><tr>
        <th style="${TH('')}">Period</th>
        <th style="${TH('')}">Date Paid</th>
        <th style="${TH('')}">Your Ref #</th>
        <th style="${TH('')}">HOA Ref #</th>
        <th style="${THR}">Amount</th>
      </tr></thead>
      <tbody>${histRows}</tbody>
    </table>
    ` : `
    <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#006837;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #006837;padding-bottom:5px;">
      Past Recent Payment History
    </p>
    <p style="margin:0 0 20px;font-size:11px;color:#94a3b8;font-style:italic;">No payment history on record yet.</p>
    `) : ''}

  </td></tr>

  <!-- ── Footer ── -->
  <tr><td style="padding:16px 28px;background:#f8fafc;border-top:2px solid #e2e8f0;">
    <p style="margin:0;font-size:10px;color:#94a3b8;line-height:1.7;">
      This is an official Statement of Account issued by the <strong>Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)</strong>
      on ${todayFmt}. This document is system-generated and is valid without a signature.
      For disputes or inquiries, please contact the HOA Treasurer's office within 5 business days of receipt.
    </p>
    <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1;text-align:center;">
      &#128274; This email contains sensitive billing information. Please do not forward to unauthorized parties. &nbsp;|&nbsp; Do not reply directly to this email.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Optional content filter sent from the admin portal:
  // { viewMode: 'outstanding' | 'history' | 'both' } — defaults to 'both' so a
  // cron-triggered or bodyless call behaves exactly as before.
  // Optional { userId } targets a single resident instead of every resident
  // with an outstanding balance — used by the "Send SOA to [Resident]" flow.
  let viewMode: 'outstanding' | 'history' | 'both' = 'both'
  let targetUserId: string | null = null
  try {
    const body = await req.json()
    if (body?.viewMode === 'outstanding' || body?.viewMode === 'history' || body?.viewMode === 'both') {
      viewMode = body.viewMode
    }
    if (typeof body?.userId === 'string' && body.userId) {
      targetUserId = body.userId
    }
  } catch (_e) {
    // No JSON body provided — keep the defaults.
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const RESEND_KEY    = Deno.env.get('RESEND_API_KEY')!
  const TEST_OVERRIDE = Deno.env.get('TEST_OVERRIDE_EMAIL') || null
  const today         = phtToday()

  // Current monthly due — configurable via hoa_settings, edited by
  // Treasurer/President from Payment.jsx. Falls back to the default if the
  // table/row doesn't exist yet. This only affects the breakdown fallback and
  // the "Monthly Due" label — actual charge amounts always come from each
  // payment row's stored `amount`/`line_items`, which don't change here.
  let monthlyDueAmount = MONTHLY_DUE_DEFAULT
  let qrCodeUrl: string | null = null
  try {
    const { data: settings } = await supabase.from('hoa_settings').select('monthly_due_amount, photo_url').eq('id', 1).single()
    if (settings?.monthly_due_amount != null) monthlyDueAmount = Number(settings.monthly_due_amount)
    if (settings?.photo_url) qrCodeUrl = settings.photo_url
  } catch (_e) {
    // hoa_settings not set up yet — keep the defaults.
  }

  try {
    let unpaidQuery = supabase
      .from('payments')
      .select('id, user_id, amount, due_date, statement_date, reference_no, status, line_items')
      .in('status', ['unpaid', 'overdue', 'pending'])
      .order('due_date', { ascending: true })
    if (targetUserId) unpaidQuery = unpaidQuery.eq('user_id', targetUserId)
    const { data: unpaidPayments, error: uErr } = await unpaidQuery
    if (uErr) { console.error('Fetch unpaid:', uErr.message); throw new Error(uErr.message) }

    // Bulk send: nothing to do if nobody owes anything. A single targeted
    // resident still gets emailed below even with zero unpaid rows — the
    // "Account Fully Settled" branch in buildFormalSoaHtml covers that case.
    if (!unpaidPayments?.length && !targetUserId) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, note: 'No outstanding balances.' }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const userIds = targetUserId
      ? [targetUserId]
      : [...new Set(unpaidPayments!.map((p: { user_id: string }) => p.user_id))]

    const { data: residents, error: rErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, block, lot, street')
      .in('id', userIds)
    if (rErr) { console.error('Fetch profiles:', rErr.message); throw new Error(rErr.message) }

    if (targetUserId && !residents?.length) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, error: 'Resident not found.' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const { data: paidPayments, error: pErr } = await supabase
      .from('payments')
      .select('user_id, amount, due_date, paid_at, payer_reference_no, reference_no')
      .in('user_id', userIds)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
    if (pErr) { console.error('Fetch paid:', pErr.message); throw new Error(pErr.message) }

    const unpaidMap: Record<string, typeof unpaidPayments> = {}
    unpaidPayments.forEach((p) => {
      if (!unpaidMap[p.user_id]) unpaidMap[p.user_id] = []
      unpaidMap[p.user_id].push(p)
    })
    const paidMap: Record<string, typeof paidPayments> = {}
    ;(paidPayments || []).forEach((p) => {
      if (!paidMap[p.user_id]) paidMap[p.user_id] = []
      if (paidMap[p.user_id].length < 12) paidMap[p.user_id].push(p)
    })

    let sent = 0, failed = 0
    const errors: string[] = []

    for (const resident of (residents || [])) {
      const unpaidList  = unpaidMap[resident.id] || []
      const paidHistory = paidMap[resident.id]   || []
      // Bulk send only emails residents who actually owe something. A
      // specifically-targeted resident gets emailed regardless (they'll see
      // the "Account Fully Settled" notice if they have no unpaid balance).
      if (!unpaidList.length && resident.id !== targetUserId) continue

      const fmtBlock = (b: string) => b?.toLowerCase().startsWith('blk') ? b : `Blk ${b}`
      const fmtLot   = (l: string) => l?.toLowerCase().startsWith('lot') ? l : `Lot ${l}`
      const addrParts = [
        resident.block  ? fmtBlock(resident.block) : null,
        resident.lot    ? fmtLot(resident.lot)     : null,
        resident.street || null,
      ].filter(Boolean)
      const fullAddress = addrParts.join(', ') || 'N/A'

      const totalDue = unpaidList.reduce((s: number, p: { amount: number }) => s + Number(p.amount || 0), 0)
      const recipient = TEST_OVERRIDE || resident.email
      if (!recipient) { failed++; continue }

      console.log(`Sending SOA to ${resident.full_name} (${recipient}) — ${unpaidList.length} unpaid month(s), total ${fc(totalDue)}`)

      const htmlBody = buildFormalSoaHtml(
        { full_name: resident.full_name, fullAddress, email: resident.email, id: resident.id },
        unpaidList,
        paidHistory,
        viewMode,
        monthlyDueAmount,
        qrCodeUrl,
      )
      const soaRef  = generateSoaRef(resident.id, today)
      const amtStr  = `PHP ${Number(totalDue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from:    'CREVHAI Billing <billing@chateaureals.com>',
          to:      [recipient],
          subject: `[${soaRef}] HOA Statement of Account — ${resident.full_name} | ${amtStr} Outstanding`,
          html:    htmlBody,
        }),
      })

      // Respect Resend's 2 emails/second rate limit
      await new Promise(r => setTimeout(r, 600))

      if (resendRes.ok) {
        sent++
        try {
          await supabase.from('soa_email_log').insert({
            user_id: resident.id, sent_to: recipient, amount_due: totalDue,
          })
        } catch (_e) { /* best-effort */ }
      } else {
        failed++
        const body = await resendRes.text()
        console.error(`Send failed for ${resident.full_name}:`, body)
        errors.push(`${resident.full_name}: ${body}`)
      }
    }

    console.log(`Done. Sent: ${sent}, Failed: ${failed}`)
    return new Response(JSON.stringify({ sent, failed, errors: errors.length ? errors : undefined }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('HANDLER_ERROR:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
