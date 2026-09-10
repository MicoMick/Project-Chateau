import React, { useState } from 'react';
import { Search, TableProperties, Download, Printer } from 'lucide-react';
import { buildNameCounts, normalizeName, monthsCoveredBy } from './paymentUtils';
import DuplicateBadge from './DuplicateBadge';
import PaginationBar, { usePagination } from './PaginationBar';

// ─── Standing Ledger View ──────────────────────────────────────────────────────
// Mirrors the physical paper ledger: one row per resident, shows standing + last payment date
const StandingLedger = ({ residentsList, payments, monthlyDue }) => {
  const [search,          setSearch]          = useState('');
  const [streetFilter,    setStreetFilter]    = useState('All');
  const [standingFilter,  setStandingFilter]  = useState('All');

  const nameCounts = buildNameCounts(residentsList);

  // Build one row per resident
  const rows = residentsList.map(r => {
    const rPayments = payments.filter(p => p.user_id === r.id);
    const paidPayments = rPayments.filter(p => (p.status || '').toLowerCase() === 'paid');

    // Last payment date
    const lastPaid = paidPayments.length > 0
      ? paidPayments.sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))[0]
      : null;

    // Standing: "Good" if latest due is paid; "No Record" if no payments at all; otherwise "Overdue/Pending"
    const latestDue = rPayments.sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))[0];
    let standing = 'No Record';
    let standingColor = 'bg-slate-100 text-slate-500 border-slate-200';
    if (latestDue) {
      const s = (latestDue.status || '').toLowerCase();
      if (s === 'paid') {
        if (monthsCoveredBy(latestDue.amount, monthlyDue) > 1) { standing = 'Paid in Advance'; standingColor = 'bg-purple-50 text-purple-700 border-purple-100'; }
        else                                       { standing = 'Good';           standingColor = 'bg-emerald-50 text-emerald-700 border-emerald-100'; }
      }
      else if (s === 'overdue')            { standing = 'Overdue'; standingColor = 'bg-red-50 text-red-600 border-red-100';            }
      else if (s === 'pending' || s === 'unpaid') { standing = 'Pending'; standingColor = 'bg-amber-50 text-amber-700 border-amber-100'; }
    }

    return {
      id:           r.id,
      full_name:    r.full_name || '—',
      isDuplicate:  nameCounts[normalizeName(r.full_name)] > 1,
      block:        r.block || '—',
      lot:          r.lot   || '—',
      street:       r.street || '—',
      resident_type: r.resident_type || '—',
      standing,
      standingColor,
      lastPaidDate: lastPaid?.paid_at
        ? new Date(lastPaid.paid_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'No record',
      totalPaid: paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
      unpaidCount: rPayments.filter(p => ['unpaid','pending','pending_verification','overdue'].includes((p.status||'').toLowerCase())).length,
      // Accumulated balance — sum of ALL unpaid dues (grace period adds up)
      unpaidBalance: rPayments
        .filter(p => ['unpaid','pending','pending_verification','overdue'].includes((p.status||'').toLowerCase()))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    };
  });

  // Unique streets for filter dropdown
  const streets = ['All', ...new Set(rows.map(r => r.street).filter(s => s && s !== '—').sort())];

  const filtered = rows.filter(r =>
    (streetFilter === 'All' || r.street === streetFilter) &&
    (standingFilter === 'All' || r.standing === standingFilter) &&
    (!search || r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.block.toLowerCase().includes(search.toLowerCase()) ||
    r.lot.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => (a.unpaidBalance > 0 ? 0 : 1) - (b.unpaidBalance > 0 ? 0 : 1));
  const { paginated: paginatedPayment, page: payPage, setPage: setPayPage, totalPages: payTotalPages } = usePagination(filtered, 5);

  const printLedger = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const rowsToUse = filtered.length > 0 ? filtered : rows;

    // ── Group residents by street — preserving the order they appear ──────────
    const streetGroups = [];
    const seen = {};
    rowsToUse.forEach(r => {
      const st = r.street || 'Unknown Street';
      if (!seen[st]) { seen[st] = true; streetGroups.push({ street: st, residents: [] }); }
      streetGroups.find(g => g.street === st).residents.push(r);
    });
    // Sort groups alphabetically by street name
    streetGroups.sort((a, b) => a.street.localeCompare(b.street));

    // ── Build table rows — street header + resident rows per group ────────────
    let globalIdx = 1;
    const tableRows = streetGroups.map(group => {
      const streetHeader = `
        <tr>
          <td colspan="8"
            style="background:#FFF200;color:#006837;font-weight:bold;font-size:12px;
                   padding:6px 10px;border:1px solid #006837;letter-spacing:0.5px;
                   text-transform:uppercase;">
            ${group.street}
          </td>
        </tr>`;
      const residentRows = group.residents.map(r => {
        const idx = globalIdx++;
        const isEven = idx % 2 === 0;
        const standingColor =
          r.standing === 'Good'           ? '#166534' :
          r.standing === 'Paid in Advance'? '#7e22ce' :
          r.standing === 'Overdue'        ? '#dc2626' :
          r.standing === 'Pending'        ? '#92400e' : '#64748b';
        return `
        <tr style="background:${isEven ? '#f0fdf4' : '#ffffff'};">
          <td style="padding:5px 8px;font-size:11px;text-align:center;border:1px solid #e2e8f0;">${idx}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.block}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.lot}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.full_name.split(' ').slice(-1)[0]}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.full_name.split(' ').slice(0,-1).join(' ')}</td>
          <td style="padding:5px 8px;font-size:11px;text-transform:capitalize;border:1px solid #e2e8f0;">${r.resident_type}</td>
          <td style="padding:5px 8px;font-size:11px;font-weight:bold;color:${standingColor};border:1px solid #e2e8f0;">${r.standing}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.lastPaidDate}</td>
          <td style="padding:5px 8px;font-size:11px;font-weight:bold;color:${r.unpaidBalance > 0 ? '#dc2626' : '#166534'};text-align:right;border:1px solid #e2e8f0;">${r.unpaidBalance > 0 ? '₱' + r.unpaidBalance.toLocaleString('en-PH') : '—'}</td>
        </tr>`;
      }).join('');
      return streetHeader + residentRows;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Monthly Dues Ledger — ${today}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      h2 { text-align: center; font-size: 15px; font-weight: bold; margin-bottom: 4px; }
      p.subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #006837; }
      th { background: #006837; color: #FFF200; padding: 7px 8px; font-size: 11px; font-weight: bold; border: 1px solid #004d29; text-align: left; }
      @media print { body { margin: 8px; } @page { size: landscape; margin: 10mm; } }
    </style>
    </head><body>
    <h2>Updated Monthly Dues Payment as of ${today}</h2>
    <p class="subtitle">Chateau Real Executive Village Homeowners Association Inc. (CREVHAI) — Standing Ledger</p>
    <table>
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Block</th>
          <th>Lot</th>
          <th>Last Name</th>
          <th>First Name</th>
          <th>Status</th>
          <th>Standing</th>
          <th>Date of Last Payment</th>
          <th>Balance Owed</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    </body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=750');
    w.document.write(html);
    w.document.close();
    w.focus();
    // Trigger the print dialog but DON'T auto-close the tab afterward —
    // closing unconditionally also closes the tab if the person clicks
    // "Cancel" in the print dialog, losing the ledger. The person can close
    // the tab themselves once they're done (same behavior as the SOA printer).
    w.onload = () => { w.print(); };
  };

  const goodCount    = rows.filter(r => r.standing === 'Good').length;
  const advanceCount = rows.filter(r => r.standing === 'Paid in Advance').length;
  const overdueCount = rows.filter(r => r.standing === 'Overdue').length;
  const pendingCount = rows.filter(r => r.standing === 'Pending').length;
  const noRecord     = rows.filter(r => r.standing === 'No Record').length;


  // ── Export to CSV — matches physical ledger column order ─────────────────
  const exportToCSV = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const headers = ['Block','Lot','Street','Last Name','First Name','Status','Standing','Date of Last Payment','Unpaid Dues'];

    const csvRows = [
      // Title row like the physical ledger
      [`Updated Monthly Dues Payment as of ${today}`],
      [],
      headers,
      ...filtered.map(r => {
        // Split full_name into Last, First if possible (assumes "First Last" format)
        const parts     = r.full_name.split(' ');
        const lastName  = parts.length > 1 ? parts[parts.length - 1] : r.full_name;
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
        return [
          r.block,
          r.lot,
          r.street,
          lastName,
          firstName,
          r.resident_type,
          r.standing,
          r.lastPaidDate,
          r.unpaidCount > 0 ? `${r.unpaidCount} unpaid` : 'Good',
        ];
      }),
    ];

    const csvContent = csvRows
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Monthly_Dues_Standing_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <TableProperties size={15} className="text-[#006837]" />
              Monthly Dues Standing Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Mirrors the physical ledger — one row per resident, showing current standing and last payment date
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all shrink-0"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={printLedger}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0"
          >
            <Printer size={13} /> Print Ledger
          </button>
        </div>

        {/* Mini KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          {[
            { label: 'Good Standing',   value: goodCount,    color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'Paid in Advance', value: advanceCount, color: 'bg-purple-50 text-purple-700 border-purple-100'    },
            { label: 'Overdue',         value: overdueCount, color: 'bg-red-50 text-red-600 border-red-100'            },
            { label: 'Pending',         value: pendingCount, color: 'bg-amber-50 text-amber-700 border-amber-100'      },
            { label: 'No Record',       value: noRecord,     color: 'bg-slate-100 text-slate-500 border-slate-200'     },
          ].map(k => (
            <div key={k.label} className={`p-3 rounded-xl border text-center ${k.color}`}>
              <p className="text-xl font-black">{k.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search resident, block, lot…"
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
          </div>
          <select
            value={streetFilter}
            onChange={e => setStreetFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer shrink-0"
          >
            {streets.map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All Streets' : s}</option>
            ))}
          </select>
          <select
            value={standingFilter}
            onChange={e => setStandingFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer shrink-0"
          >
            <option value="All">All Standings</option>
            <option value="Good">Good</option>
            <option value="Paid in Advance">Paid in Advance</option>
            <option value="Overdue">Overdue</option>
            <option value="Pending">Pending</option>
            <option value="No Record">No Record</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Resident','Block','Lot','Street','Type','Standing','Last Payment','Unpaid Dues'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-300 text-sm">No residents found</td></tr>
            ) : paginatedPayment.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    {r.full_name}
                    {r.isDuplicate && <DuplicateBadge />}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{r.block}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{r.lot}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-[120px] truncate">{r.street}</td>
                <td className="px-4 py-3 text-sm text-slate-500 capitalize">{r.resident_type}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${r.standingColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      r.standing === 'Good' ? 'bg-emerald-400' :
                      r.standing === 'Paid in Advance' ? 'bg-purple-400' :
                      r.standing === 'Overdue' ? 'bg-red-400' :
                      r.standing === 'Pending' ? 'bg-amber-400' : 'bg-slate-300'
                    }`} />
                    {r.standing}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{r.lastPaidDate}</td>
                <td className="px-4 py-3">
                  {r.unpaidBalance > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black text-red-600">
                        ₱{r.unpaidBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-red-400 font-semibold">
                        {r.unpaidCount} month{r.unpaidCount !== 1 ? 's' : ''} overdue
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-600 font-bold">Settled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <>
          <PaginationBar page={payPage} totalPages={payTotalPages} setPage={setPayPage} total={filtered.length} rowsPerPage={10} />
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{filtered.length} of {rows.length} residents</p>
          </div>
        </>
      )}
    </div>
  );
};

export default StandingLedger;
