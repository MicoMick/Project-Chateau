import React from 'react';
import { createPortal } from 'react-dom';
import { Mail } from 'lucide-react';

const VIEW_MODE_OPTIONS = [
  { key: 'outstanding', label: 'Outstanding Charges Only' },
  { key: 'history',     label: 'Past Payment History Only' },
  { key: 'both',        label: 'Both' },
];

/**
 * SendSOAModal — confirmation before bulk-emailing a Statement of Account to
 * every resident who currently has an outstanding balance. The actual send
 * (handleSendAllSOA in Payment.jsx) calls the 'send-soa-emails' Supabase Edge
 * Function; this modal only collects the content choice and confirms intent.
 *
 * Rendered through a portal straight to <body>, same reason as SOAPrintModal
 * — guarantees the overlay is always truly viewport-relative.
 *
 * Props:
 *  - isOpen: boolean
 *  - viewMode: 'outstanding' | 'history' | 'both'
 *  - onViewModeChange: (key) => void
 *  - sending: boolean — disables the Send button and shows a spinner
 *  - result: { type: 'success', sent, failed } | { type: 'error', error } | null
 *  - onSend: () => void
 *  - onClose: () => void
 */
const SendSOAModal = ({ isOpen, viewMode, onViewModeChange, sending, result, onSend, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Mail size={18} className="text-blue-600" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Send SOA to All Residents?</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          This will email a Statement of Account to every resident who currently has an outstanding balance.
          Residents who are fully settled will not receive an email. This action is logged in the audit trail.
        </p>

        <div className="mb-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">What should the email include?</p>
          <div className="flex gap-2">
            {VIEW_MODE_OPTIONS.map(opt => (
              <button key={opt.key} type="button" onClick={() => onViewModeChange(opt.key)}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                  ${viewMode === opt.key
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-semibold ${
            result.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {result.type === 'success'
              ? `✓ Sent ${result.sent} email(s)${result.failed ? `, ${result.failed} failed` : ''}.`
              : `Failed: ${result.error}`}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
            Cancel
          </button>
          <button onClick={onSend} disabled={sending}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {sending ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</> : <><Mail size={15} /> Send Now</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SendSOAModal;
