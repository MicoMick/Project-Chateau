import { MONTHLY_DUE_DEFAULT, buildLineItemBreakdown, localToday } from './paymentUtils';

// ─── Statement of Account (SOA) printer ───────────────────────────────────────
// Generates a printable per-resident billing statement, similar in spirit to
// AuditorDashboard's printFinancialReport — opens a new window, builds HTML,
// then triggers the browser print dialog. Used exclusively by SOAPrintModal.
export const printSOA = (resident, paidHistory = [], viewMode = 'both', monthlyDueAmount = MONTHLY_DUE_DEFAULT, qrCodeUrl = null) => {
  const fmtCurrency = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short',  day: 'numeric', year: 'numeric' }) : '—';
  const fmtDateL = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'long',   day: 'numeric', year: 'numeric' }) : '—';
  const fmtMonth = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'long',   year: 'numeric' }) : '—';
  const fmtMonthAbbr = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short' }) : '—';
  // A single payment can cover more than one month's due (paid in advance).
  // In that case, show the period as a range ending on the payment's due_date
  // rather than labeling it with just the due month.
  const fmtPaidPeriod = (p) => {
    const months = monthlyDueAmount > 0 ? Math.round(Number(p.amount || 0) / monthlyDueAmount) : 1;
    if (months > 1 && p.due_date) {
      const end = new Date(p.due_date);
      const start = new Date(end);
      start.setMonth(start.getMonth() - (months - 1));
      return start.getFullYear() === end.getFullYear()
        ? `${fmtMonthAbbr(start)} to ${fmtMonthAbbr(end)} ${end.getFullYear()}`
        : `${fmtMonthAbbr(start)} ${start.getFullYear()} to ${fmtMonthAbbr(end)} ${end.getFullYear()}`;
    }
    return fmtMonth(p.due_date);
  };

  const showOutstanding = viewMode === 'outstanding' || viewMode === 'both';
  const showHistory     = viewMode === 'history'     || viewMode === 'both';

  // Ascending copy (oldest → newest) — used for date-range math (earliest due
  // date, period span). Order-independent of how the table is displayed.
  const unpaidListAsc    = (resident.unpaidList || []).slice().sort((a, b) => new Date(a.due_date||0) - new Date(b.due_date||0));
  // Display copy (newest → oldest) — so when a new month's due is generated,
  // it appears above older unpaid dues in the printed/emailed table.
  const unpaidListDesc   = unpaidListAsc.slice().reverse();
  const totalDue         = unpaidListAsc.reduce((s, p) => s + Number(p.amount || 0), 0);
  const today            = localToday();
  const isSettled        = unpaidListAsc.length === 0;
  const monthsUnpaidCount = unpaidListAsc.length;
  const latestStatementDate = isSettled ? null
    : unpaidListAsc.reduce((l, p) => (p.statement_date && p.statement_date > l ? p.statement_date : l), unpaidListAsc[0]?.statement_date || today);
  const earliestDueDate  = isSettled ? null : unpaidListAsc[0]?.due_date;

  // Payment history — chronological order (January → July, etc.), oldest first.
  // Capped to the most recent 12 entries, but that cap is applied before the
  // chronological sort so we keep the newest 12 without disturbing their order.
  const paidHistoryChrono = paidHistory
    .slice()
    .sort((a, b) => new Date(b.due_date || b.paid_at || 0) - new Date(a.due_date || a.paid_at || 0))
    .slice(0, 12)
    .sort((a, b) => new Date(a.due_date || a.paid_at || 0) - new Date(b.due_date || b.paid_at || 0));

  // Reference number — YearMonth + first 6 chars of user id
  const soaRef = `SOA-${today.slice(0,7).replace('-','')}` +
    `-${(resident.id || resident.user_id || 'XXXXXX').slice(0,6).toUpperCase()}`;

  // Breakdown — use stored line_items or freshly computed
  const sampleLineItems = unpaidListAsc.find(p => Array.isArray(p.line_items) && p.line_items.length)?.line_items
    || buildLineItemBreakdown(monthlyDueAmount);

  const TH = `background:#006837;color:#fff;text-align:left;padding:7px 9px;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;`;

  const breakdownRows = isSettled ? '' : sampleLineItems.map((item, i) => {
    const bg   = i % 2 === 0 ? '#f8fafc' : '#fff';
    const type = item.type;
    const badge = type
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;border:1px solid;${
          type === 'Fixed'
            ? 'color:#166534;background:#f0fdf4;border-color:#bbf7d0;'
            : 'color:#64748b;background:#f8fafc;border-color:#e2e8f0;'
        }">${type}</span>`
      : '';
    return `<tr>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};">${item.label}${badge}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};font-size:10px;color:#64748b;">${item.category}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};text-align:right;">${fmtCurrency(item.amount)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};text-align:right;font-weight:bold;">${fmtCurrency(item.amount * monthsUnpaidCount)}</td>
    </tr>`;
  }).join('');

  const unpaidRows = unpaidListDesc.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#fef2f2' : '#fff'}">
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtMonth(p.due_date)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">Monthly HOA Dues</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtDate(p.statement_date)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtDate(p.due_date)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-size:10px;">${p.reference_no || '—'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-weight:bold;text-align:center;color:${p.status === 'overdue' ? '#dc2626' : '#d97706'};text-transform:capitalize;">${p.status || 'Unpaid'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;">${fmtCurrency(p.amount)}</td>
    </tr>`).join('');

  const paidRows = paidHistoryChrono.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#f0fdf4' : '#fff'}">
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtPaidPeriod(p)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtDate(p.paid_at)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-size:10px;">${p.payer_reference_no || '—'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-size:10px;">${p.reference_no || '—'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;color:#166534;">${fmtCurrency(p.amount)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <title>Statement of Account — ${resident.full_name}</title>
  <style>
    *{box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#f1f5f9;color:#1e293b;}
    .page{max-width:760px;margin:28px auto;background:#fff;border-radius:12px;overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,.10);}
    /* Letterhead */
    .lh{background:#006837;padding:0;}
    .lh-inner{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 26px;}
    .lh h1{margin:0;font-size:20px;font-weight:900;color:#fff;letter-spacing:-.3px;}
    .lh .org{font-size:11px;color:#a7f3d0;margin:3px 0 0;}
    .lh .doc-type{font-size:9px;font-weight:bold;color:#a7f3d0;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;}
    .lh .ref-no{font-size:12px;font-weight:900;color:#FFF200;letter-spacing:.04em;}
    .lh .issued{font-size:10px;color:#a7f3d0;margin-top:5px;}
    /* Status banner */
    .status-bar{padding:11px 26px;border-bottom:2px solid;display:flex;justify-content:space-between;align-items:center;}
    .status-bar.unpaid{background:#fef2f2;border-color:#fecaca;}
    .status-bar.settled{background:#f0fdf4;border-color:#bbf7d0;}
    .status-bar .slbl{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;}
    .status-bar.unpaid .slbl{color:#b91c1c;}
    .status-bar.settled .slbl{color:#166534;}
    .status-bar .sdl{font-size:11px;color:#991b1b;margin-top:2px;}
    .status-bar .total-amt{font-size:22px;font-weight:900;color:#dc2626;text-align:right;}
    .status-bar .total-lbl{font-size:9px;font-weight:bold;color:#b91c1c;text-transform:uppercase;letter-spacing:.05em;text-align:right;}
    /* Account block */
    .acct{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0;}
    .acct-cell{padding:16px 26px;}
    .acct-cell:first-child{border-right:1px solid #f1f5f9;}
    .acct-lbl{font-size:9px;font-weight:bold;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;}
    .acct-val{font-size:13px;font-weight:900;color:#0f172a;margin-top:4px;}
    .acct-sub{font-size:11px;color:#64748b;margin-top:2px;}
    /* Body */
    .body{padding:18px 26px;}
    h2{font-size:11.5px;color:#006837;margin:18px 0 7px;border-bottom:2px solid #006837;
      padding-bottom:4px;text-transform:uppercase;letter-spacing:.04em;}
    h2:first-child{margin-top:0;}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px;}
    th{${TH}}
    td{padding:7px 9px;border-bottom:1px solid #f1f5f9;}
    /* Breakdown note */
    .bkd-note{font-size:10px;color:#94a3b8;font-style:italic;margin:0 0 7px;}
    /* Payment instructions */
    .pay-box{background:#fffbeb;border:1.5px solid #f59e0b;border-radius:8px;padding:13px 16px;margin:14px 0;}
    .pay-box .plbl{font-size:10px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;}
    .pay-box p{margin:0;font-size:10.5px;color:#78350f;line-height:1.7;}
    /* Footer */
    .footer{background:#f8fafc;border-top:2px solid #e2e8f0;padding:13px 26px;}
    .footer p{margin:0;font-size:10px;color:#94a3b8;line-height:1.6;}
    @media print{
      body{background:#fff;}
      .page{margin:0;border-radius:0;box-shadow:none;max-width:100%;}
      @page{margin:8mm;size:A4;}
    }
  </style></head>
  <body>
  <div class="page">

    <!-- Letterhead -->
    <div class="lh">
      <div class="lh-inner">
        <div>
          <div class="doc-type">Official Document</div>
          <h1>Statement of Account</h1>
          <div class="org">Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;color:#a7f3d0;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;">Reference No.</div>
          <div class="ref-no">${soaRef}</div>
          <div class="issued">Issued: ${fmtDateL(today)}</div>
        </div>
      </div>
    </div>

    <!-- Status banner -->
    <div class="status-bar ${isSettled ? 'settled' : 'unpaid'}">
      <div>
        <div class="slbl">${isSettled ? '✓ Account Status: Fully Settled' : '⚠ Account Status: Payment Required'}</div>
        ${!isSettled ? `<div class="sdl">Payment due on or before <strong>${fmtDateL(earliestDueDate)}</strong></div>` : ''}
      </div>
      ${!isSettled ? `<div>
        <div class="total-lbl">Total Amount Due</div>
        <div class="total-amt">${fmtCurrency(totalDue)}</div>
      </div>` : ''}
    </div>

    <!-- Account info -->
    <div class="acct">
      <div class="acct-cell">
        <div class="acct-lbl">Account Holder</div>
        <div class="acct-val">${resident.full_name}</div>
        <div class="acct-sub">${resident.fullAddress || resident.street || 'N/A'}</div>
      </div>
      <div class="acct-cell">
        <div class="acct-lbl">Billing Summary</div>
        <div class="acct-val" style="${monthsUnpaidCount > 0 ? 'color:#dc2626;' : 'color:#166534;'}">
          ${monthsUnpaidCount > 0
            ? `${monthsUnpaidCount} month${monthsUnpaidCount !== 1 ? 's' : ''} unpaid`
            : 'No outstanding balance'}
        </div>
        <div class="acct-sub">Monthly due: <strong>${fmtCurrency(monthlyDueAmount)}</strong>
          ${monthsUnpaidCount > 1 ? ` · Period: ${fmtMonth(unpaidListAsc[0]?.due_date)} – ${fmtMonth(unpaidListAsc[unpaidListAsc.length-1]?.due_date)}` : ''}</div>
      </div>
    </div>

    <div class="body">

    ${showOutstanding ? (!isSettled ? `
    <!-- Breakdown -->
    <h2>Monthly Due Breakdown — What Your ${fmtCurrency(monthlyDueAmount)}/month Covers</h2>
    <p class="bkd-note">* Fixed costs are charged at the same rate every month. Variable costs are estimates based on actual utility bills.</p>
    <table>
      <thead><tr>
        <th>Item</th>
        <th>Category</th>
        <th style="text-align:right;">Per Month</th>
        <th style="text-align:right;">&times; ${monthsUnpaidCount} Month${monthsUnpaidCount !== 1 ? 's' : ''}</th>
      </tr></thead>
      <tbody>${breakdownRows}</tbody>
      <tfoot><tr>
        <td colspan="3" style="text-align:right;font-weight:bold;background:#f0fdf4;border-top:2px solid #006837;">Total:</td>
        <td style="text-align:right;font-weight:900;background:#f0fdf4;border-top:2px solid #006837;color:#006837;font-size:13px;">${fmtCurrency(totalDue)}</td>
      </tr></tfoot>
    </table>

    <!-- Outstanding charges — newest due shown first, so a freshly-generated
         month's due appears above older unpaid months -->
    <h2>Outstanding Charges</h2>
    <table>
      <thead><tr>
        <th>Period</th><th>Description</th><th>Statement Date</th><th>Due Date</th>
        <th>Reference #</th><th style="text-align:center;">Status</th><th style="text-align:right;">Amount</th>
      </tr></thead>
      <tbody>${unpaidRows}</tbody>
      <tfoot><tr>
        <td colspan="6" style="text-align:right;font-weight:bold;background:#fef2f2;border-top:2px solid #dc2626;">Total Amount Due:</td>
        <td style="text-align:right;font-weight:900;background:#fef2f2;border-top:2px solid #dc2626;color:#dc2626;font-size:13px;">${fmtCurrency(totalDue)}</td>
      </tr></tfoot>
    </table>

    <!-- Payment instructions -->
    <div class="pay-box">
      <div class="plbl">&#128179; Payment Instructions</div>
      <p>Please settle your outstanding balance on or before <strong>${fmtDateL(earliestDueDate)}</strong> to avoid late penalties.<br>
      Payments may be made at the <strong>HOA Office</strong> or through your designated <strong>HOA Treasurer</strong>.<br>
      Present this document as your billing reference — Ref. No. <strong>${soaRef}</strong>.</p>
      ${qrCodeUrl ? `
      <div style="margin-top:12px;text-align:center;">
        <img src="${qrCodeUrl}" alt="GCash QR Code" style="max-width:160px;border:1px solid #e2e8f0;border-radius:8px;" />
        <p style="margin:6px 0 0;font-size:10px;color:#92700e;font-weight:bold;">Scan this QR Code to pay directly</p>
      </div>
      ` : ''}
    </div>
    ` : `
    <!-- Settled -->
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:18px;text-align:center;margin-bottom:16px;">
      <div style="font-size:24px;margin-bottom:4px;">&#10003;</div>
      <div style="font-size:14px;font-weight:900;color:#166534;">Account Fully Settled</div>
      <div style="font-size:11px;color:#15803d;margin-top:4px;">No outstanding dues. Thank you for your prompt payments!</div>
    </div>
    `) : ''}

    ${showHistory ? (paidHistoryChrono.length ? `
    <!-- Payment history — chronological order, oldest month first -->
    <h2>Past Recent Payment History</h2>
    <table>
      <thead><tr>
        <th>Period</th><th>Date Paid</th><th>Your Ref #</th><th>HOA Ref #</th>
        <th style="text-align:right;">Amount</th>
      </tr></thead>
      <tbody>${paidRows}</tbody>
    </table>` : `
    <h2>Past Recent Payment History</h2>
    <p style="font-size:11px;color:#94a3b8;font-style:italic;">No payment history on record yet.</p>
    `) : ''}

    </div><!-- end .body -->

    <!-- Footer -->
    <div class="footer">
      <p>This is an official Statement of Account issued by the <strong>Chateau Real Executive Village
      Homeowners Association Inc. (CREVHAI)</strong> on ${fmtDateL(today)}. This document is system-generated
      and is valid without a manual signature. For disputes or inquiries, please contact the HOA Treasurer's
      office within 5 business days. Ref. No.: <strong>${soaRef}</strong>.</p>
    </div>

  </div><!-- end .page -->
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1050');
  if (!win) { alert('Please allow popups to print the Statement of Account.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
};
