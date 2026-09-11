// ─── Print Summary (mirrors the physical FINANCIAL STATEMENT ledger) ────────
// Split out of AuditorDashboard.jsx to keep that file focused on state/tabs.
// Only covers Statement of Income & Expenditure, the Net Income summary, and
// Itemized Expenses — the detailed Accounts Receivable, Monthly Dues
// Collected, Paid in Advance, and Court/Facility Rental breakdown tables were
// intentionally dropped from this report (still viewable on-screen in their
// respective tabs).
//
// Laid out top-down on purpose — summary first, breakdown second, itemized
// detail last — instead of showing the same Income/Expenses/Net numbers
// three times over in three different formats (a prior version repeated
// them in a ledger table, a banner line, and a 3-box grid back-to-back).
// One clear headline, then progressively more detail below it.
export const printFinancialReport = ({ duesIncome, courtIncome, expenses, period }) => {
  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const isAnnual = period && (period.toLowerCase().includes('year') || period.toLowerCase().includes('annual'));
  const docTitle = isAnnual ? 'Annual Financial Report' : 'Financial Statement';

  // ── Income ────────────────────────────────────────────────────────────────
  const totalIncome = duesIncome.total + courtIncome.total;

  // ── Expenses (all categories, bucketed) ─────────────────────────────────
  const sumByCat = (cats) => (expenses.records || [])
    .filter(e => cats.includes(e.category))
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const salaryWages       = sumByCat(['Salaries']);
  const maintenanceRepair = sumByCat(['Maintenance']);
  const utilityBills      = sumByCat(['Utilities']);
  const otherExpenses     = sumByCat(['Supplies', 'Events', 'Projects', 'Legal', 'Insurance', 'Other']);
  const totalExpense      = salaryWages + maintenanceRepair + utilityBills + otherExpenses;

  // ── Summary ────────────────────────────────────────────────────────────────
  const netIncome = totalIncome - totalExpense;

  const fmtCur = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
  const TH     = (cols) => `<tr>${cols.map(col => `<th>${col}</th>`).join('')}</tr>`;

  const expenseRows = (expenses.records || []).map((e, i) => `
    <tr style="background:${i%2===0?'#fff5f5':'#fff'}">
      <td>${new Date(e.expense_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td>${e.description || '—'}</td>
      <td>${e.category || '—'}</td>
      <td style="text-align:right;font-weight:bold;color:#dc2626;">${fmtCur(e.amount)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head>
  <title>${docTitle} — ${today}</title>
  <style>
    *{box-sizing:border-box;}
    body{font-family:Arial,sans-serif;margin:28px;color:#1e293b;font-size:13px;line-height:1.5;}

    .doc-header{text-align:center;border-bottom:3px solid #006837;padding-bottom:16px;margin-bottom:20px;}
    .doc-header h1{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#006837;margin:0 0 5px;}
    .doc-header .org{font-size:13px;color:#374151;font-weight:bold;margin:2px 0;}
    .doc-header .period{font-size:12px;color:#64748b;margin:5px 0 0;}

    h2{font-size:13px;color:#0f172a;font-weight:900;margin:26px 0 10px;padding-bottom:6px;
       border-bottom:2px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.4px;}

    table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:12.5px;}
    th{background:#006837;color:#FFF200;padding:8px 10px;text-align:left;font-weight:bold;font-size:11.5px;}
    td{padding:7px 10px;border-bottom:1px solid #e2e8f0;}
    tfoot td{background:#f8fafc;font-weight:bold;padding:8px 10px;}

    /* Headline summary — the ONE place the bottom line lives */
    .summary-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:0 0 24px;}
    .sbox{border-radius:12px;padding:16px;border:2px solid;}
    .sbox .lbl{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;}
    .sbox .amt{font-size:20px;font-weight:900;}
    .sbox.income{border-color:#006837;background:#f0fdf4;}
    .sbox.income .lbl{color:#166534;} .sbox.income .amt{color:#006837;}
    .sbox.expense{border-color:#dc2626;background:#fef2f2;}
    .sbox.expense .lbl{color:#991b1b;} .sbox.expense .amt{color:#dc2626;}
    .sbox.net-pos{border-color:#0369a1;background:#eff6ff;}
    .sbox.net-pos .lbl{color:#0369a1;} .sbox.net-pos .amt{color:#0369a1;}
    .sbox.net-neg{border-color:#dc2626;background:#fef2f2;}
    .sbox.net-neg .lbl{color:#991b1b;} .sbox.net-neg .amt{color:#dc2626;}

    /* Income & Expenditure breakdown — plain, readable rows, no repeated totals */
    .stmt td{padding:8px 10px;font-size:12.5px;border-bottom:1px solid #f1f5f9;}
    .stmt .lbl{color:#334155;}
    .stmt .amt{text-align:right;font-weight:700;color:#0f172a;}
    .stmt .group-hdr td{padding-top:14px;padding-bottom:4px;border-bottom:none;
      font-size:10.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;}
    .stmt .subtotal-row td{border-top:1.5px solid #cbd5e1;font-weight:900;font-size:13px;}
    .stmt .subtotal-row.income td{color:#006837;}
    .stmt .subtotal-row.expense td{color:#dc2626;}

    /* Certification */
    .cert{margin-top:36px;padding-top:18px;border-top:2px solid #e2e8f0;}
    .cert-text{font-size:11.5px;color:#374151;line-height:1.7;margin-bottom:22px;}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-top:16px;}
    .sig-box{text-align:center;}
    .sig-line{border-top:1.5px solid #1a1a1a;margin-bottom:5px;margin-top:30px;}
    .sig-name{font-size:12px;font-weight:bold;}
    .sig-role{font-size:10.5px;color:#64748b;}

    @media print{body{margin:10px;}@page{margin:12mm;size:A4;}}
  </style></head><body>

  <!-- ── Document Header ── -->
  <div class="doc-header">
    <h1>${docTitle}</h1>
    <div class="org">Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)</div>
    ${period
      ? `<div class="period">Period: <strong>${period}</strong> &nbsp;·&nbsp; Generated: ${today}</div>`
      : `<div class="period">Generated: ${today}</div>`}
  </div>

  <!-- ── Headline Summary — the bottom line, stated once ── -->
  <div class="summary-grid">
    <div class="sbox income"><div class="lbl">Total Income</div><div class="amt">${fmtCur(totalIncome)}</div></div>
    <div class="sbox expense"><div class="lbl">Total Expenses</div><div class="amt">${fmtCur(totalExpense)}</div></div>
    <div class="sbox ${netIncome>=0?'net-pos':'net-neg'}">
      <div class="lbl">Net ${netIncome>=0?'Income':'Deficit'}</div>
      <div class="amt">${netIncome < 0 ? '−' : ''}${fmtCur(Math.abs(netIncome))}</div>
    </div>
  </div>

  <!-- ── Income & Expenditure Breakdown ── -->
  <h2>Income &amp; Expenditure Breakdown${period ? ` — ${period}` : ''}</h2>
  <table class="stmt">
    <tr class="group-hdr"><td colspan="2">Income</td></tr>
    <tr><td class="lbl">Monthly Dues Collected</td><td class="amt">${fmtCur(duesIncome.total)}</td></tr>
    <tr><td class="lbl">Court / Facility Rental</td><td class="amt">${fmtCur(courtIncome.total)}</td></tr>
    <tr class="subtotal-row income"><td class="lbl">Total Income</td><td class="amt">${fmtCur(totalIncome)}</td></tr>

    <tr class="group-hdr"><td colspan="2">Expenses</td></tr>
    <tr><td class="lbl">Salary Wages</td><td class="amt">${fmtCur(salaryWages)}</td></tr>
    <tr><td class="lbl">Maintenance &amp; Repair</td><td class="amt">${fmtCur(maintenanceRepair)}</td></tr>
    <tr><td class="lbl">Utility Bills (Electricity &amp; Water)</td><td class="amt">${fmtCur(utilityBills)}</td></tr>
    ${otherExpenses > 0 ? `<tr><td class="lbl">Other / Miscellaneous</td><td class="amt">${fmtCur(otherExpenses)}</td></tr>` : ''}
    <tr class="subtotal-row expense"><td class="lbl">Total Expenses</td><td class="amt">${fmtCur(totalExpense)}</td></tr>
  </table>

  <!-- ── Itemized Expenses ── -->
  <h2>Itemized Expenses (${(expenses.records||[]).length} entries)</h2>
  <table>
    <thead>${TH(['Date','Description','Category','Amount'])}</thead>
    <tbody>${expenseRows || '<tr><td colspan="4" style="text-align:center;color:#999">No expenses for this period</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="3" style="text-align:right;">Total Expenses:</td>
      <td style="text-align:right;color:#dc2626;font-weight:900;">${fmtCur(totalExpense)}</td>
    </tr></tfoot>
  </table>

  <!-- ── Certification Block ── -->
  <div class="cert">
    <p class="cert-text">
      We, the undersigned officers of the Chateau Real Executive Village Homeowners Association Inc. (CREVHAI),
      hereby certify that the foregoing financial statement is true and correct to the best of our knowledge,
      based on the records of the Association${period ? ` for the period ${period}` : ''}.
      This report was generated from the CREVHAI HOA Management System on ${today}.
    </p>
    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-name">HOA President</div>
        <div class="sig-role">Signature over Printed Name</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-name">HOA Treasurer</div>
        <div class="sig-role">Signature over Printed Name</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-name">HOA Auditor</div>
        <div class="sig-role">Signature over Printed Name</div>
      </div>
    </div>
  </div>

  </body></html>`;

  const w = window.open('', '_blank', 'width=1100,height=850');
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => { w.print(); };
};
