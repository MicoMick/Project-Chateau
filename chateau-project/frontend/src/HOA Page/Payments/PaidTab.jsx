import React, { useState } from 'react';
import { Search } from 'lucide-react';
import ResidentFilterSelect from '../Resident Management/ResidentFilterSelect';
import { monthsCoveredBy, buildFullAddress } from './paymentUtils';
import PaginationBar, { usePagination } from './PaginationBar';

// ─── Paid view — one row per resident who has at least one paid due ──────────
const PaidTab = ({ residentsList, payments, monthlyDue }) => {
  const [paidSearchTerm,     setPaidSearchTerm]     = useState('');
  const [paidResidentFilter, setPaidResidentFilter] = useState('All');

  const paidRows = residentsList.map(r => {
    const rPayments  = payments.filter(p => p.user_id === r.id);
    const paidList   = rPayments.filter(p => (p.status || '').toLowerCase() === 'paid')
      .sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0));
    const totalPaid  = paidList.reduce((s, p) => s + Number(p.amount || 0), 0);
    const lastPaid   = paidList[0]?.paid_at || null;
    const stillUnpaid = rPayments.filter(p =>
      ['unpaid','overdue','pending','pending_verification'].includes((p.status || '').toLowerCase())
    ).length;
    // A single paid row's amount can cover more than one month at once (an
    // advance payment), so the real month count is the sum of months each
    // row covers, not the number of rows.
    const paidMonths = paidList.reduce((s, p) => s + monthsCoveredBy(p.amount, monthlyDue), 0);
    const hasAdvancePayment = paidList.some(p => monthsCoveredBy(p.amount, monthlyDue) > 1);
    return {
      user_id:    r.id,
      full_name:  r.full_name || '—',
      street:     r.street || 'N/A',
      fullAddress: buildFullAddress(r.block, r.lot, r.street),
      totalPaid,
      paidMonths,
      lastPaid,
      stillUnpaid,
      hasAdvancePayment,
    };
  }).filter(r => r.paidMonths > 0);

  const filteredPaid = paidRows.filter(r => {
    const nameMatch     = r.full_name.toLowerCase().includes(paidSearchTerm.toLowerCase());
    const residentMatch = paidResidentFilter === 'All' || r.user_id === paidResidentFilter;
    return nameMatch && residentMatch;
  }).sort((a, b) => (a.stillUnpaid > 0 ? 0 : 1) - (b.stillUnpaid > 0 ? 0 : 1));

  const { paginated: paginatedPaid, page: paidPage, setPage: setPaidPage, totalPages: paidTotalPages } =
    usePagination(filteredPaid, 5);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input type="text" placeholder="Search resident…" value={paidSearchTerm}
              onChange={e => setPaidSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
          </div>
          <ResidentFilterSelect
            value={paidResidentFilter}
            onChange={setPaidResidentFilter}
            options={residentsList.map(r => ({ value: r.id, label: r.full_name }))}
            className="w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Name','Street','Total Paid','Months Paid','Last Payment','Standing'].map(h => (
                <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredPaid.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-300 text-sm">No paid records found</td></tr>
            ) : paginatedPaid.map(r => (
              <tr key={r.user_id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${r.stillUnpaid === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-sm font-bold text-slate-800">{r.full_name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 max-w-[180px] truncate">{r.street}</td>
                <td className="px-5 py-4">
                  <span className="text-sm font-black text-emerald-600">
                    ₱{r.totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                  {r.paidMonths} month{r.paidMonths !== 1 ? 's' : ''}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                  {r.lastPaid ? new Date(r.lastPaid).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.stillUnpaid === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Fully Settled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Has Unpaid
                      </span>
                    )}
                    {r.hasAdvancePayment && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Paid in Advance
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredPaid.length > 0 && (
        <>
          <PaginationBar page={paidPage} totalPages={paidTotalPages} setPage={setPaidPage} total={filteredPaid.length} rowsPerPage={10} />
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{filteredPaid.length} resident{filteredPaid.length !== 1 ? 's' : ''} with paid records</p>
          </div>
        </>
      )}
    </div>
  );
};

export default PaidTab;
