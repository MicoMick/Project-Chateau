import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, RefreshCw, Zap } from 'lucide-react';
import { fmtCurrency, fmtDate, PaginationBar } from './auditorHelpers';

/**
 * DuesTab — the "Dues Collected" table, one row per resident. Payments for
 * residents in good standing are auto-verified server-side; only delinquent
 * residents need the manual Verify action here.
 *
 * Props:
 *  - pagination: the duesPag object from usePagination (paginated rows + page state)
 *  - residentCount: total resident rows (post-filter, pre-pagination) — footer count
 *  - duesTotal: total ₱ collected — footer total
 *  - verifyingId: user_id currently mid-verify, or null — disables that row's button
 *  - onVerify: (userId, fullName) => void
 */
const DuesTab = ({ pagination, residentCount, duesTotal, verifyingId, onVerify }) => (
  <>
    <table className="w-full text-left">
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr>{['Resident','Months Paid','Total Paid','Last Payment','Status','Action'].map(h => (
          <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
        ))}</tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {pagination.paginated.map(r => (
          <tr key={r.user_id} className="hover:bg-slate-50/80 transition-colors">
            <td className="px-5 py-4">
              <p className="text-sm font-bold text-slate-800">{r.full_name}</p>
              {r.hasAdvance && (
                <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  <Zap size={9} /> Paid in Advance ({fmtCurrency(r.advanceAmount)})
                </span>
              )}
            </td>
            <td className="px-5 py-4 text-sm text-slate-600">{r.count} month{r.count !== 1 ? 's' : ''}</td>
            <td className="px-5 py-4 text-sm font-black text-[#006837]">{fmtCurrency(r.total)}</td>
            <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">{fmtDate(r.last_paid)}</td>
            <td className="px-5 py-4">
              {r.isDelinquent
                ? <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100"><AlertTriangle size={10} /> Needs Review</span>
                : r.audited
                  ? <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle2 size={10} /> Verified</span>
                  : <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 border border-slate-200"><Clock size={10} /> Pending</span>}
            </td>
            <td className="px-5 py-4">
              {r.isDelinquent ? (
                <button
                  onClick={() => onVerify(r.user_id, r.full_name)}
                  disabled={verifyingId === r.user_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap">
                  {verifyingId === r.user_id
                    ? <><RefreshCw size={11} className="animate-spin" /> Verifying…</>
                    : <><CheckCircle2 size={11} /> Verify</>}
                </button>
              ) : r.audited ? (
                <span className="text-xs text-slate-300 font-semibold">—</span>
              ) : (
                <span className="text-xs text-slate-300 font-semibold italic">Auto-verifying…</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-slate-50 border-t-2 border-slate-200">
        <tr>
          <td colSpan={2} className="px-5 py-3 text-xs font-black text-slate-600 text-right">{residentCount} resident{residentCount !== 1 ? 's' : ''}</td>
          <td className="px-5 py-3 text-sm font-black text-[#006837]">{fmtCurrency(duesTotal)}</td>
          <td colSpan={3} />
        </tr>
      </tfoot>
    </table>
    <PaginationBar page={pagination.page} totalPages={pagination.totalPages} setPage={pagination.setPage} total={pagination.total} perPage={6} />
  </>
);

export default DuesTab;
