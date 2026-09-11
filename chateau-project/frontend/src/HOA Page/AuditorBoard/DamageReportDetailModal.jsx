import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import { fmtDate } from './auditorHelpers';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Resolved', 'On Hold', 'Denied'];

const STATUS_CFG = {
  'Pending':     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100'   },
  'In Progress': { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100'    },
  'Resolved':    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  'On Hold':     { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200'   },
  'Denied':      { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100'     },
};

const inputCls = "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837]";
const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";

/**
 * DamageReportDetailModal — the "View Details" breakdown for one damage
 * report, opened from the Damage Reports sub-tab on the Facilities &
 * Amenities tab. This is also where a report gets closed out once the
 * resident has paid for or replaced the item — pick "Resolved" as the new
 * status, describe how it was settled in Resolution Notes, and save; the
 * note is appended to the report's record so there's a permanent trail of
 * how and when it was closed.
 *
 * Landscape layout on purpose: the original report (what was found, when)
 * on the left, the status/resolution action on the right — same side-by-side
 * spread as the other "Details" modals in this app.
 *
 * Rendered through a portal straight to <body> — guarantees the backdrop is
 * always truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - report: the reports table row (category 'maintenance'), or null to hide
 *  - onClose: () => void
 *  - onSave: (reportId, newStatus, resolutionNote) => Promise<boolean> —
 *    persists the change; the modal only closes if this resolves true
 */
const DamageReportDetailModal = ({ report, onClose, onSave }) => {
  const [status, setStatus]   = useState('Pending');
  const [note,   setNote]     = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!report) return;
    setStatus(report.status || 'Pending');
    setNote('');
  }, [report?.id]);

  if (!report) return null;

  const cfg = STATUS_CFG[report.status] || STATUS_CFG['Pending'];

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(report.id, status, note.trim());
    setSaving(false);
    if (ok) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-red-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900">Damage Report Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">Reported {fmtDate(report.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Landscape body — original report left, status/resolution right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto">

          {/* Left — the original report */}
          <div className="p-7 space-y-5">
            <div className="flex items-start gap-2.5">
              <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reported On</p>
                <p className="text-sm font-semibold text-slate-900">
                  {new Date(report.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Current Status</p>
              <span className={`inline-flex items-center text-xs font-black px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                {report.status || 'Pending'}
              </span>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Report Details</p>
              <p className="text-sm text-slate-900 leading-relaxed p-3.5 bg-slate-50 rounded-xl border border-slate-100 whitespace-pre-wrap">
                {report.description}
              </p>
            </div>
          </div>

          {/* Right — status update / resolution */}
          <div className="p-7 space-y-5 bg-slate-50/50">
            <div>
              <label className={labelCls}>Update Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className={inputCls + ' cursor-pointer'}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Resolution Notes</label>
              <textarea rows={6} className={inputCls + ' resize-none'}
                placeholder="e.g. Resident paid ₱500 via GCash on Sept 12 to cover the repair. Or: Item replaced with a brand-new tent on pickup."
                value={note} onChange={e => setNote(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1.5">
                Describe how this was settled — payment received, item replaced, etc. This is added to the report's record, not sent to the resident.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-bold cursor-pointer transition-all">
            Close
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {saving
              ? <><RefreshCw size={15} className="animate-spin" /> Saving…</>
              : <><CheckCircle2 size={15} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DamageReportDetailModal;
