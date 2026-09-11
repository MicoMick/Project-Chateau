// ─── Damage Report Log (print) ───────────────────────────────────────────────
// A standalone print action scoped to just the Damage Reports sub-tab — kept
// separate from printFinancialReport.js on purpose, since the main financial
// statement was deliberately trimmed down and damage claims don't belong
// mixed into a Statement of Income & Expenditure. This is the paper trail
// for borrowed-item losses: what was reported, when, and how it was resolved
// (payment received, item replaced, still pending, etc.).
export const printDamageLog = (reports) => {
  const today = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const fmtDt = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const rows = reports.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fef2f2' : '#fff'}">
      <td style="white-space:nowrap;">${fmtDt(r.created_at)}</td>
      <td>${(r.description || '').replace(/\n/g, '<br/>')}</td>
      <td style="font-weight:bold;">${r.status || 'Pending'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Damage Report Log — ${today}</title>
  <style>
    *{box-sizing:border-box;}
    body{font-family:Arial,sans-serif;margin:24px;color:#1a1a1a;font-size:12px;}
    .doc-header{text-align:center;border-bottom:3px solid #006837;padding-bottom:14px;margin-bottom:16px;}
    .doc-header h1{font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#006837;margin:0 0 4px;}
    .doc-header .org{font-size:12px;color:#374151;font-weight:bold;margin:2px 0;}
    .doc-header .period{font-size:11px;color:#64748b;margin:4px 0 0;}
    table{width:100%;border-collapse:collapse;font-size:11px;}
    th{background:#006837;color:#FFF200;padding:7px 8px;text-align:left;font-weight:bold;font-size:10.5px;}
    td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;}
    @media print{body{margin:10px;}@page{margin:12mm;size:A4;}}
  </style></head><body>

  <div class="doc-header">
    <h1>Damage Report Log</h1>
    <div class="org">Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)</div>
    <div class="period">Generated: ${today} &nbsp;·&nbsp; ${reports.length} report${reports.length !== 1 ? 's' : ''}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:100px;">Reported On</th>
        <th>Details</th>
        <th style="width:110px;">Status</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:#999;padding:20px;">No damage reports filed.</td></tr>'}</tbody>
  </table>

  </body></html>`;

  const w = window.open('', '_blank', 'width=1000,height=800');
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => { w.print(); };
};
