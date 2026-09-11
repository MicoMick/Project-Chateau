import React from 'react';
import { CheckCircle2, AlertTriangle, ClipboardList, Eye, Printer } from 'lucide-react';
import { fmtDate, PaginationBar } from './auditorHelpers';

// Damage reports share the same status values as resident reports (see
// Residents Reports/reportsHelpers.jsx) since they land in the same
// 'reports' table and get reviewed the same way.
const DAMAGE_STATUS_CFG = {
  'Pending':     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'   },
  'In Progress': { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100'    },
  'Resolved':    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  'On Hold':     { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200'   },
  'Denied':      { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100'     },
};
const DamageStatusBadge = ({ status }) => {
  const cfg = DAMAGE_STATUS_CFG[status] || DAMAGE_STATUS_CFG['Pending'];
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {status || 'Pending'}
    </span>
  );
};

/**
 * FacilitiesTab — Chairs & Tents amenity reservations, split into
 * "Currently Borrowed", "Return History", and "Damage Reports" sub-tabs.
 *
 * Props:
 *  - subTab: 'current' | 'history' | 'damages'
 *  - setSubTab: (key) => void
 *  - currentCount, historyCount, damagesCount: counts shown on the sub-tab pills
 *  - currentPagination: the facilCurPag object from usePagination
 *  - historyPagination: the facilHistPag object from usePagination
 *  - damagesPagination: the damagesPag object from usePagination — rows are
 *    'reports' table records (category 'maintenance') filed via the Report
 *    Damage button below
 *  - onReportDamage: (reservationRow) => void — opens DamageReportModal
 *  - onViewDamage: (reportRow) => void — opens DamageReportDetailModal
 *  - onPrintDamageLog: () => void — prints the Damage Reports list
 *  - damageStatusFilter: 'All' | 'Pending' | 'In Progress' | 'Resolved' | 'On Hold' | 'Denied'
 *  - setDamageStatusFilter: (status) => void
 */
const FacilitiesTab = ({
  subTab, setSubTab, currentCount, historyCount, damagesCount,
  currentPagination, historyPagination, damagesPagination, onReportDamage, onViewDamage, onPrintDamageLog,
  damageStatusFilter, setDamageStatusFilter,
}) => (
  <>
    {/* Sub-tab bar */}
    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {[
          { key: 'current', label: 'Currently Borrowed', count: currentCount },
          { key: 'history', label: 'Return History',     count: historyCount },
          { key: 'damages', label: 'Damage Reports',      count: damagesCount },
        ].map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${subTab === st.key ? 'bg-[#006837] text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
            {st.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black
              ${subTab === st.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {st.count}
            </span>
          </button>
        ))}
      </div>
      {subTab === 'damages' && (
        <button onClick={onPrintDamageLog}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap">
          <Printer size={12} /> Print Damage Log
        </button>
      )}
    </div>

    {/* ── Currently Borrowed ── */}
    {subTab === 'current' && (
      <>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['Resident','Item','Qty','Requested On','Date','Status'].map(h => (
              <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentPagination.paginated.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-300 font-semibold">No items currently borrowed.</td></tr>
            ) : currentPagination.paginated.map(r => (
              <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-black shrink-0">
                      {r.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{r.profiles?.full_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{r.profiles?.email || ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-700">{r.facilities?.name || '—'}</td>
                <td className="px-5 py-4 text-sm text-slate-600 text-center">{r.quantity || '—'}</td>
                <td className="px-5 py-4 text-sm text-slate-400 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Borrowed
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={currentPagination.page} totalPages={currentPagination.totalPages} setPage={currentPagination.setPage} total={currentPagination.total} perPage={6} />
      </>
    )}

    {/* ── Return History ── */}
    {subTab === 'history' && (
      <>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['Resident','Item','Qty','Borrowed Date','Status','Report Damage'].map(h => (
              <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {historyPagination.paginated.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-300 font-semibold">No return history yet.</td></tr>
            ) : historyPagination.paginated.map(r => (
              <tr key={r.id} className="hover:bg-emerald-50/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-xs font-black shrink-0">
                      {r.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{r.profiles?.full_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{r.profiles?.email || ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-700">{r.facilities?.name || '—'}</td>
                <td className="px-5 py-4 text-sm text-slate-600 text-center">{r.quantity || '—'}</td>
                <td className="px-5 py-4 text-sm text-slate-400 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
                    <CheckCircle2 size={10} /> Returned
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button onClick={() => onReportDamage(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap">
                    <AlertTriangle size={11} /> Report Damage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={historyPagination.page} totalPages={historyPagination.totalPages} setPage={historyPagination.setPage} total={historyPagination.total} perPage={6} />
      </>
    )}

    {/* ── Damage Reports ── */}
    {subTab === 'damages' && (
      <>
        {/* Status filter */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-1.5 flex-wrap">
          {['All', ...Object.keys(DAMAGE_STATUS_CFG)].map(s => (
            <button key={s} onClick={() => setDamageStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                ${damageStatusFilter === s ? 'bg-[#006837] text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
              {s}
            </button>
          ))}
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['Reported On','Details','Status',''].map(h => (
              <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {damagesPagination.paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-14 text-center">
                  <ClipboardList size={28} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-semibold">
                    {damageStatusFilter === 'All' ? 'No damage reports filed yet.' : `No ${damageStatusFilter.toLowerCase()} damage reports.`}
                  </p>
                </td>
              </tr>
            ) : damagesPagination.paginated.map(r => (
              <tr key={r.id} className="hover:bg-red-50/20 transition-colors align-top">
                <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="px-5 py-4 text-sm text-slate-700 max-w-xl truncate">{r.description}</td>
                <td className="px-5 py-4"><DamageStatusBadge status={r.status} /></td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => onViewDamage(r)} title="View Details"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer">
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={damagesPagination.page} totalPages={damagesPagination.totalPages} setPage={damagesPagination.setPage} total={damagesPagination.total} perPage={6} />
      </>
    )}
  </>
);

export default FacilitiesTab;
