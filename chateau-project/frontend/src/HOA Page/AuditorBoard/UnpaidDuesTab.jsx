import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { fmtCurrency, fmtMonth, PaginationBar } from './auditorHelpers';

/**
 * UnpaidDuesTab — consolidated unpaid/overdue accounts, one row per resident.
 * Residents whose account has been auto-flagged delinquent (see
 * profiles.account_status) get a "Needs Review" badge and sort to the top —
 * this is the only place that flag surfaces, since a fully delinquent
 * resident (never paid anything) never appears in Dues Collected at all.
 *
 * Props:
 *  - pagination: the unpaidPag object from usePagination
 *  - residentCount: total resident rows (post-filter, pre-pagination) — footer count
 *  - unpaidTotal: total ₱ outstanding — footer total
 */
const UnpaidDuesTab = ({ pagination, residentCount, unpaidTotal }) => (
  <>
    <table className="w-full text-left">
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr>{['Resident','Months Unpaid','Due Period','Total Balance','Status'].map(h => (
          <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
        ))}</tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {pagination.paginated.map(r => (
          <tr key={r.user_id} className={`hover:bg-amber-50/40 transition-colors ${r.isDelinquent ? 'bg-orange-50/40' : r.hasOverdue ? 'bg-red-50/20' : ''}`}>
            <td className="px-5 py-4 text-sm font-bold text-slate-800">{r.full_name}</td>
            <td className="px-5 py-4 text-sm text-slate-600">{r.months} month{r.months !== 1 ? 's' : ''}</td>
            <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
              {r.oldest === r.newest
                ? fmtMonth(r.oldest)
                : `${fmtMonth(r.oldest)} – ${fmtMonth(r.newest)}`}
            </td>
            <td className="px-5 py-4 text-sm font-black text-amber-700">{fmtCurrency(r.balance)}</td>
            <td className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {r.hasOverdue
                  ? <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Overdue
                    </span>
                  : <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Unpaid
                    </span>}
                {r.isDelinquent && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                    <AlertTriangle size={10} /> Needs Review
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-amber-50 border-t-2 border-amber-100">
        <tr>
          <td colSpan={3} className="px-5 py-3 text-xs font-black text-slate-600 text-right">{residentCount} resident{residentCount !== 1 ? 's' : ''}</td>
          <td className="px-5 py-3 text-sm font-black text-amber-700">{fmtCurrency(unpaidTotal)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
    <PaginationBar page={pagination.page} totalPages={pagination.totalPages} setPage={pagination.setPage} total={pagination.total} perPage={6} />
  </>
);

export default UnpaidDuesTab;
