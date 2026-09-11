import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, User, RefreshCw, CheckCircle2, History } from 'lucide-react';
import { supabase } from '../supabaseAdmin';

// The stored log entry keeps the resident's ID (see handleReviewDelinquentAccount
// in AuditorDashboard.jsx) — that's what lets history be scoped to the right
// resident even when two residents share the same name. It's just not
// something an Auditor needs to actually read, so this strips it back out
// for display, along with the boilerplate sentence, leaving just the note.
const parseReviewNote = (details) => {
  const idx = details.indexOf('):');
  if (idx === -1) return 'Reviewed — no notes added.';
  return details.slice(idx + 2).trim().replace(/\.$/, '');
};

/**
 * DelinquentReviewModal — opens when an Auditor clicks "Verify" on a
 * delinquent resident whose paid dues are already fully audited. There's
 * nothing left at the payment level to mark verified, but the resident is
 * still flagged delinquent, so clicking Verify used to be a silent dead
 * end (just a toast saying "already fully verified"). This gives that
 * click somewhere to go — log what was actually checked or done about the
 * account, so there's a permanent record instead of nothing happening.
 *
 * The log itself lives in system_logs, which only the Super Admin's System
 * Logs page can browse — Auditors don't get that page. So this modal also
 * fetches and shows this one resident's own past REVIEW_DELINQUENT_ACCOUNT
 * entries directly, scoped to just what an Auditor actually needs to see.
 *
 * Landscape layout on purpose: context + past review history on the left,
 * the new review note on the right — same side-by-side spread as the other
 * "Details" modals in this app.
 *
 * Props:
 *  - target: { userId, fullName } | null — null hides the modal
 *  - onClose: () => void
 *  - onSubmit: (userId, fullName, note) => Promise<boolean> — logs the
 *    review; the modal only closes if this resolves true
 */
const DelinquentReviewModal = ({ target, onClose, onSubmit }) => {
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!target) return;
    setNote('');
    setLoadingHistory(true);
    supabase
      .from('system_logs')
      .select('details, created_at, user_email')
      .eq('activity', 'REVIEW_DELINQUENT_ACCOUNT')
      .ilike('details', `%(ID: ${target.userId})%`)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory(data || []))
      .finally(() => setLoadingHistory(false));
  }, [target?.userId]);

  if (!target) return null;

  const handleSubmit = async () => {
    setSaving(true);
    const ok = await onSubmit(target.userId, target.fullName, note.trim());
    setSaving(false);
    if (ok) { setNote(''); onClose(); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-orange-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900">Review Delinquent Account</h2>
              <p className="text-xs text-slate-500 mt-0.5">Logs a permanent record — doesn't change payments or account status</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Landscape body — context + history left, new note right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto">

          {/* Left — who, why they're seeing this, and past reviews */}
          <div className="p-7 space-y-5">
            <div className="flex items-start gap-2.5">
              <User size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resident</p>
                <p className="text-sm font-bold text-slate-900">{target.fullName}</p>
              </div>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
              <p className="text-sm text-orange-800 leading-relaxed">
                Their paid dues are already fully verified — there's nothing new to mark. They're still flagged
                delinquent though, so note what you checked or did about the account.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History size={12} /> Past Reviews
              </p>
              {loadingHistory ? (
                <p className="text-sm text-slate-400 italic">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No past reviews logged for this resident yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed">{parseReviewNote(h.details)}</p>
                      <p className="text-xs font-bold text-slate-700 mt-1.5">
                        {h.user_email} — {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — the new review note */}
          <div className="p-7 space-y-5 bg-slate-50/50">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Review Notes <span className="text-slate-400 normal-case">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={6}
                placeholder="e.g. Contacted resident, payment plan agreed for Sept 30. Or: Escalated to Treasurer for collection."
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300/40 focus:border-orange-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-900 font-bold text-sm hover:bg-slate-200 cursor-pointer disabled:opacity-50 transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
            {saving ? <><RefreshCw size={13} className="animate-spin" /> Logging…</> : <><CheckCircle2 size={14} /> Log Review</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DelinquentReviewModal;
