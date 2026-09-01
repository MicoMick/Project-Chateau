import React from 'react';
import {
  X, Mail, Package, Hash, CalendarDays, CheckCircle2, XCircle,
  ShieldCheck, Camera, FileText,
} from 'lucide-react';
import { StatusPill, ConditionBadge, fmtDate } from './Borrowers';

/**
 * BorrowersDetailModal — the full-detail view opened by clicking a row in
 * Borrowers.jsx. Split out of Borrowers.jsx to keep that file focused on the
 * table/list itself.
 *
 * Props:
 *  - row: the reservation object currently selected (null hides the modal)
 *  - onClose: close the modal without acting
 *  - canManage: whether the current role may approve/reject/verify
 *  - onApprove, onReject: pending-request actions (id) => void
 *  - onVerifyReturn: opens the Verify Return modal for this row
 *  - onViewPhoto: opens the condition-photo lightbox for a given url
 */
const BorrowersDetailModal = ({ row, onClose, canManage, onApprove, onReject, onVerifyReturn, onViewPhoto }) => {
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-6 pt-5 pb-6 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <StatusPill status={row.status} />
            <button onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-xl text-white/80 hover:text-white cursor-pointer transition-all">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-2xl border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black uppercase shrink-0">
              {row.profiles?.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-xl font-black text-white leading-tight">{row.profiles?.full_name || '—'}</h2>
              <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                <Mail size={11} /> {row.profiles?.email || 'No email'}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-3 overflow-y-auto">
          {[
            { icon: Package,      label: 'Item',         value: row.facilities?.name || '—' },
            { icon: Hash,         label: 'Quantity',     value: row.quantity ? `${row.quantity} unit(s)` : '—' },
            { icon: CalendarDays, label: 'Requested On', value: fmtDate(row.created_at) },
            { icon: CalendarDays, label: 'Borrow Date',  value: fmtDate(row.date) },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <f.icon size={14} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{f.label}</p>
                <p className="text-sm font-bold text-slate-800 text-right">{f.value}</p>
              </div>
            </div>
          ))}

          {/* Date Returned — only applicable once an item was actually
              approved/borrowed. A Pending, Rejected, or Cancelled request
              was never borrowed, so "not returned yet" wouldn't make sense. */}
          {['Approved', 'Return Pending', 'Completed'].includes(row.status) && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <CheckCircle2 size={14} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Returned</p>
                {row.status === 'Completed'
                  ? <p className="text-sm font-bold text-emerald-600">{fmtDate(row.returned_at)}</p>
                  : row.status === 'Return Pending'
                    ? <span className="text-[10px] font-black px-2 py-1 rounded-full border uppercase tracking-wide bg-blue-50 text-blue-700 border-blue-200">Reported {fmtDate(row.returned_at)} — Pending Verification</span>
                    : <span className="text-[10px] font-black px-2 py-1 rounded-full border uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-200">Not Returned Yet</span>}
              </div>
            </div>
          )}

          {/* Condition photos — at borrow, and at return once processed */}
          {(row.borrow_condition_photo_url || row.return_condition_photo_url) && (
            <div className="flex gap-2">
              {row.borrow_condition_photo_url && (
                <button onClick={() => onViewPhoto(row.borrow_condition_photo_url)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <Camera size={13} /> At Borrow
                </button>
              )}
              {row.return_condition_photo_url && (
                <button onClick={() => onViewPhoto(row.return_condition_photo_url)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <Camera size={13} /> At Return
                </button>
              )}
            </div>
          )}

          {/* Return verification details — only once a return has been processed */}
          {(row.return_condition || row.return_notes) && (
            <div className="pt-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <ShieldCheck size={12} /> {row.status === 'Completed' ? 'Return Verification' : "Resident's Return Report"}
              </p>
              <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Condition</span>
                  <ConditionBadge r={row} />
                </div>
                {row.return_notes && (
                  <div className="p-3">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1.5">
                      <FileText size={12} /> Notes
                    </span>
                    <p className="text-sm text-slate-700">{row.return_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5 shrink-0">
          {canManage && row.status === 'Pending' && (
            <div className="flex gap-2.5">
              <button
                onClick={onApprove}
                disabled={(row.facilities?.amount ?? 0) < (row.quantity || 1)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <CheckCircle2 size={15} /> Approve
              </button>
              <button onClick={onReject}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-500/20 transition-all">
                <XCircle size={15} /> Reject
              </button>
            </div>
          )}
          {canManage && (row.status === 'Approved' || row.status === 'Return Pending') && (
            <button onClick={onVerifyReturn}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 transition-all">
              <ShieldCheck size={15} /> {row.status === 'Return Pending' ? 'Confirm Return' : 'Verify Return'}
            </button>
          )}
          <button onClick={onClose}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BorrowersDetailModal;
