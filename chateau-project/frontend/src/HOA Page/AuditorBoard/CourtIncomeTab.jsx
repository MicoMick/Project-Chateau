import React from 'react';
import { fmtCurrency, fmtDate, PaginationBar } from './auditorHelpers';

/**
 * CourtIncomeTab — completed court/facility rental reservations.
 *
 * Props:
 *  - pagination: the courtPag object from usePagination
 *  - courtTotal: total ₱ rental income — footer total
 */
const CourtIncomeTab = ({ pagination, courtTotal }) => (
  <>
    <table className="w-full text-left">
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr>{['Date','Resident','Facility','Time Slot','Amount'].map(h => (
          <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
        ))}</tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {pagination.paginated.map(r => (
          <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
            <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{fmtDate(r.date)}</td>
            <td className="px-5 py-4 text-sm font-bold text-slate-800">{r.profiles?.full_name || '—'}</td>
            <td className="px-5 py-4 text-sm text-slate-600">{r.facilities?.name || '—'}</td>
            <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{r.start_time} – {r.end_time}</td>
            <td className="px-5 py-4 text-sm font-black text-teal-600">{fmtCurrency(r.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-slate-50 border-t-2 border-slate-200">
        <tr>
          <td colSpan={4} className="px-5 py-3 text-xs font-black text-slate-600 text-right">Total Court Income:</td>
          <td className="px-5 py-3 text-sm font-black text-teal-600">{fmtCurrency(courtTotal)}</td>
        </tr>
      </tfoot>
    </table>
    <PaginationBar page={pagination.page} totalPages={pagination.totalPages} setPage={pagination.setPage} total={pagination.total} perPage={6} />
  </>
);

export default CourtIncomeTab;
