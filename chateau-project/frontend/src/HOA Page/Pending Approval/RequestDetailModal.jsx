import React from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Briefcase, Clock, FileText } from 'lucide-react';
import { actionIcon, actionColor, tableColor } from './pendingApprovalHelpers';

// Fields shown with a friendly label + formatted value in the "What's being
// requested" panel. Anything in requested_data NOT listed here still shows up
// via the generic fallback below it, so a new field added elsewhere never
// silently disappears from this view.
const FIELD_LABELS = {
  reference_no:       'Reference No.',
  amount:              'Amount',
  status:               'New Status',
  paid_at:              'Paid At',
  payer_reference_no:  'Payer Reference No.',
  due_date:             'Due Date',
};

const formatFieldValue = (key, value) => {
  if (value == null || value === '') return '—';
  if (key === 'amount') return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  if (key === 'paid_at' || key === 'due_date') {
    const d = new Date(value);
    return isNaN(d) ? String(value) : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  return String(value);
};

/**
 * RequestDetailModal — the full "View Details" breakdown for one approval
 * request, opened from the eye icon on a PendingApproval.jsx table row.
 * The row's Details column truncates long content (settlement notes, JSON
 * payloads) to keep the table scannable, so this modal exists to show the
 * complete, untruncated picture before a President approves/rejects.
 *
 * Landscape layout on purpose: a two-column spread (request metadata on the
 * left, the actual requested changes on the right) reads faster for this
 * kind of side-by-side comparison than a tall single-column stack would.
 *
 * Rendered through a portal straight to <body> — same reasoning as every
 * other modal in this app: guarantees the backdrop is always truly
 * viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - request: the approval_requests row, or null to hide the modal
 *  - onClose: () => void
 *  - onApprove, onReject: (request) => void — only rendered for PENDING requests
 */
const RequestDetailModal = ({ request, onClose, onApprove, onReject }) => {
  if (!request) return null;
  // requested_by_role / requested_by_name are captured on the row at request
  // creation time (see Payment.jsx) rather than looked up here — RLS on the
  // admins table only lets an admin read their own row (or a super_admin
  // read any), so a live cross-admin lookup at review time would silently
  // return nothing whenever the reviewer isn't the requester themself.
  const isPending = request.status === 'PENDING';
  const data = request.requested_data || {};
  const knownEntries  = Object.entries(data).filter(([k]) => k !== 'details' && FIELD_LABELS[k] !== undefined);
  const otherEntries  = Object.entries(data).filter(([k]) => k !== 'details' && FIELD_LABELS[k] === undefined);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#006837]/10 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[#006837]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Request Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">Full breakdown before you approve or reject this request</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Landscape body — metadata left, requested changes right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto">

          {/* Left — request metadata */}
          <div className="p-7 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${actionColor(request.action_type)}`}>
                {actionIcon(request.action_type)}
                {request.action_type}
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg capitalize ${tableColor(request.target_table)}`}>
                {request.target_table || '—'}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                ${request.status === 'PENDING'  ? 'bg-amber-50 text-amber-700 border-amber-100'   :
                  request.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                   'bg-red-50 text-red-600 border-red-100'}`}>
                {request.status}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Briefcase size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested By</p>
                  <p className="text-sm font-bold text-slate-900 capitalize">
                    {request.requested_by_role ? request.requested_by_role.replace(/_/g, ' ') : '—'}
                  </p>
                  {request.requested_by_name && (
                    <p className="text-xs text-slate-500">{request.requested_by_name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested On</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {new Date(request.created_at).toLocaleString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {data.details && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes / Justification</p>
                <p className="text-sm text-slate-900 leading-relaxed p-3.5 bg-slate-50 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {data.details}
                </p>
              </div>
            )}
          </div>

          {/* Right — the actual requested change */}
          <div className="p-7 space-y-3 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">What's Being Requested</p>
            {knownEntries.length === 0 && otherEntries.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No additional data attached to this request.</p>
            ) : (
              <div className="space-y-2">
                {[...knownEntries, ...otherEntries].map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-white rounded-xl border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 shrink-0">{FIELD_LABELS[key] || key}</span>
                    <span className="text-sm font-bold text-slate-900 text-right break-all">{formatFieldValue(key, value)}</span>
                  </div>
                ))}
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
              <button onClick={() => onReject(request)}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold cursor-pointer transition-all flex items-center justify-center gap-2">
                <X size={15} /> Reject
              </button>
              <button onClick={() => onApprove(request)}
                className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2">
                <Check size={15} /> Approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RequestDetailModal;
