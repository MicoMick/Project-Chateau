import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Tag, Calendar, ImageIcon, Maximize2, Video, FileText, Send, ChevronDown,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { RequireRole, StatusPill } from './reportsHelpers';

/**
 * ReportDetailModal — the full "View & Respond" breakdown for one resident
 * report, opened from the row menu on a Reports.jsx table row. Owns its own
 * status/feedback-draft/previous-responses state so it stays self-contained —
 * Reports.jsx only needs to know which report is being viewed and how to
 * actually persist a sent response.
 *
 * Landscape layout on purpose: the report's own content (who/what/when,
 * attached photo/video, the resident's message) on the left, the review side
 * (past responses + the feedback form) on the right — reads faster
 * side-by-side than one long stacked column, same as the other "View
 * Details" modals in this app.
 *
 * Rendered through a portal straight to <body> — guarantees the backdrop is
 * always truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - report: the report row, or null to hide the modal
 *  - currentUserRole: string — gates who can see the feedback form
 *  - onClose: () => void
 *  - onSend: (report, newStatus, message) => Promise<boolean> — persists the
 *    status change + notification; the modal clears its draft and refreshes
 *    the response history only if this resolves true
 */
const ReportDetailModal = ({ report, currentUserRole, onClose, onSend }) => {
  const [selectedStatus,  setSelectedStatus]  = useState('Pending');
  const [feedbackText,    setFeedbackText]    = useState('');
  const [previousFeedback,setPreviousFeedback]= useState([]);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [sending,         setSending]         = useState(false);

  const fetchPreviousFeedback = async (reportId) => {
    try {
      const { data } = await supabase
        .from('notifications').select('message, created_at')
        .eq('report_id', reportId).order('created_at', { ascending: false });
      setPreviousFeedback(data || []);
    } catch (e) { console.error('Error fetching feedback:', e.message); }
  };

  useEffect(() => {
    if (!report) return;
    setSelectedStatus(report.status);
    setFeedbackText('');
    setIsImageExpanded(false);
    fetchPreviousFeedback(report.id);
  }, [report?.id]);

  if (!report) return null;

  const handleSend = async () => {
    if (!feedbackText.trim()) return;
    setSending(true);
    const ok = await onSend(report, selectedStatus, feedbackText);
    setSending(false);
    if (ok) {
      setFeedbackText('');
      fetchPreviousFeedback(report.id);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
            <div>
              <h2 className="text-lg font-black text-slate-900">{report.category}</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">{report.rptNo}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusPill status={selectedStatus} />
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Landscape body — report content left, review side right */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto">

            {/* Left — the report itself */}
            <div className="p-7 space-y-5">
              <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-1.5"><User size={14} className="text-slate-400" />{report.resident}</span>
                <span className="flex items-center gap-1.5"><Tag size={14} className="text-slate-400" />{report.category}</span>
                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" />{report.date}</span>
              </div>

              {report.imageUrl && (
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ImageIcon size={13} /> Attached Photo
                  </p>
                  <div onClick={() => setIsImageExpanded(true)}
                    className="relative cursor-pointer w-full h-52 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={report.imageUrl} alt="Report attachment" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white/90 p-2.5 rounded-full shadow-lg"><Maximize2 size={18} className="text-slate-900" /></div>
                    </div>
                  </div>
                </div>
              )}

              {report.videoUrl && (
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Video size={13} /> Attached Video
                  </p>
                  <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-900">
                    <video src={report.videoUrl} controls className="w-full max-h-[280px] object-contain">
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={13} /> Resident's Message
                </p>
                <div className="bg-slate-50 rounded-2xl p-4 text-sm font-medium text-slate-900 leading-relaxed border border-slate-100">
                  {report.description}
                </div>
              </div>
            </div>

            {/* Right — response history + feedback form */}
            <div className="p-7 space-y-5 bg-slate-50/50">
              {previousFeedback.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Previous Responses</p>
                  <div className="space-y-2">
                    {previousFeedback.map((fb, i) => (
                      <div key={i} className="bg-white border border-[#006837]/15 rounded-2xl p-3.5">
                        <p className="text-sm text-slate-800 leading-relaxed">{fb.message}</p>
                        <p className="text-xs text-slate-500 mt-1.5">
                          {new Date(fb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <RequireRole userRole={currentUserRole} allowedRoles={['president','secretary','vice_president','board_member']}>
                <div className="space-y-3">
                  <p className="text-sm font-black text-slate-900">Send Feedback to Resident</p>
                  <div className="relative w-full sm:w-52">
                    <select
                      value={selectedStatus}
                      onChange={e => setSelectedStatus(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900
                        focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] cursor-pointer transition-all"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Denied">Denied</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <textarea
                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] resize-none transition-all"
                    rows={4}
                    placeholder="Write your feedback or response to the resident…"
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                  />
                  <button onClick={handleSend} disabled={sending}
                    className="flex items-center gap-2 bg-[#006837] hover:bg-[#004d29] text-white px-6 py-3 rounded-xl
                      text-sm font-bold transition-all shadow-lg shadow-[#006837]/20 active:scale-95 cursor-pointer disabled:opacity-50">
                    {sending
                      ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</>
                      : <><Send size={15} /> Send Feedback</>}
                  </button>
                </div>
              </RequireRole>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded image lightbox */}
      {isImageExpanded && report.imageUrl && (
        <div className="fixed inset-0 z-[260] bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsImageExpanded(false)}>
          <button className="absolute top-6 right-6 text-white/70 hover:text-white cursor-pointer"><X size={28} /></button>
          <img src={report.imageUrl} alt="Expanded" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
        </div>
      )}
    </>,
    document.body
  );
};

export default ReportDetailModal;
