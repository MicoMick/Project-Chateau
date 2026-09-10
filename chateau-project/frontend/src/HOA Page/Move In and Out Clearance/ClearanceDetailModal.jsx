import React from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ClipboardList, CheckCircle2, Calendar } from 'lucide-react';
import { StatusPill, DocLink, getRequirements } from './moveInClearanceHelpers';

/**
 * ClearanceDetailModal — the full "View Details" breakdown for one Move
 * In/Out clearance request, opened from the eye icon on a MoveInClearance.jsx
 * row. The row itself only shows a compact header; every field — resident
 * info, submitted documents, requirements checklist, review notes — lives
 * here so it can be laid out with enough room to actually read.
 *
 * Landscape layout on purpose: resident info + requirements checklist on the
 * left, submitted documents + review outcome on the right — the same
 * side-by-side spread used by RequestDetailModal.jsx in Pending Approval, for
 * the same reason (faster to scan than one long stacked column).
 *
 * Rendered through a portal straight to <body> — guarantees the backdrop is
 * always truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - item: the move_in_clearances row (with joined `profiles`), or null to hide
 *  - onClose: () => void
 *  - onApprove, onReject: (item) => void — only rendered for PENDING items
 *  - actionLoading: boolean — disables the footer buttons while a request is in flight
 */
const ClearanceDetailModal = ({ item, onClose, onApprove, onReject, actionLoading }) => {
  if (!item) return null;

  const residentName = item.profiles?.full_name || 'Unknown Resident';
  const isOwner       = (item.resident_type || '').toLowerCase() === 'owner';
  const isMoveIn      = !!item.move_in_date;
  const typeLabel     = isMoveIn ? 'Move In' : 'Move Out';
  const isPending     = item.status === 'pending';
  const requirements  = getRequirements(isMoveIn, isOwner);

  const documents = [
    item.proof_of_ownership_url && { label: 'Proof of Ownership', value: item.proof_of_ownership_url },
    item.barangay_clearance_url && { label: 'Barangay Clearance', value: item.barangay_clearance_url },
    item.contract_copy_url      && { label: 'Contract Copy',      value: item.contract_copy_url },
  ].filter(Boolean);

  const address = [
    item.profiles?.block && `Block ${item.profiles.block}`,
    item.profiles?.lot   && `Lot ${item.profiles.lot}`,
    item.profiles?.street,
  ].filter(Boolean).join(', ') || 'Chateau Real, Buenavista III, General Trias, Cavite';

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#006837]/10 text-[#006837] flex items-center justify-center font-black text-base uppercase shrink-0">
              {residentName.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900 truncate">{residentName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">CREVHAI Move In / Move Out Clearance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Badges */}
        <div className="px-7 pt-4 flex flex-wrap items-center gap-2 shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full
            ${isMoveIn ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
            {typeLabel}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">
            {item.resident_type || 'Unknown type'}
          </span>
          <StatusPill status={item.status} />
        </div>

        {/* Landscape body — resident info + checklist left, documents + outcome right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto mt-4">

          {/* Left — resident info + requirements */}
          <div className="p-7 space-y-5">
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <ClipboardList size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address</p>
                  <p className="text-sm font-semibold text-slate-900">{address}</p>
                </div>
              </div>
              {isMoveIn && (
                <div className="flex items-start gap-2.5">
                  <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Move In Date</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(item.move_in_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date Submitted</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Requirements Checklist</p>
              <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                {requirements.map(req => (
                  <div key={req} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    {req}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — documents + review outcome */}
          <div className="p-7 space-y-5 bg-slate-50/50">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Submitted Documents</p>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No documents submitted yet.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.label} className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-white rounded-xl border border-slate-100">
                      <span className="text-sm font-semibold text-slate-700">{doc.label}</span>
                      <DocLink value={doc.value} label={doc.label} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isPending && (
              <div className={`p-4 rounded-2xl border
                ${item.status === 'approved' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2
                  ${item.status === 'approved' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {item.status === 'approved' ? 'Approved' : 'Rejected'}
                </p>
                {item.reviewed_at && (
                  <p className="text-sm font-semibold text-slate-800">
                    Reviewed on {new Date(item.reviewed_at).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                )}
                {item.admin_notes && (
                  <p className="text-sm text-slate-800 mt-1.5 leading-relaxed">
                    <span className="font-bold">Notes: </span>{item.admin_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-bold cursor-pointer transition-all">
            Close
          </button>
          {isPending && (
            <>
              <button onClick={() => onReject(item)} disabled={actionLoading}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                <X size={15} /> Reject
              </button>
              <button onClick={() => onApprove(item)} disabled={actionLoading}
                className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {actionLoading
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing…</>
                  : <><Check size={15} /> Approve</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ClearanceDetailModal;
