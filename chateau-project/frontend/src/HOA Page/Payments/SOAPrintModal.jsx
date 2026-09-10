import React from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { printSOA } from './printSOA';

const PRINT_OPTIONS = [
  { key: 'outstanding', label: 'Outstanding Charges Only',  desc: 'Unpaid dues breakdown — newest due shown first.' },
  { key: 'history',     label: 'Past Payment History Only', desc: 'Settled dues, oldest to most recent.' },
  { key: 'both',        label: 'Both',                      desc: 'Outstanding charges and past payment history together.' },
];

/**
 * SOAPrintModal — lets the Treasurer choose, right before printing, whether a
 * resident's Statement of Account shows outstanding charges only, past
 * payment history only, or both — then hands off to printSOA to build and
 * print it. Opened from the "SOA" button on a resident row in Payment.jsx.
 *
 * Rendered through a portal straight to <body>: a `fixed inset-0` overlay
 * nested this deep only covers the true viewport if every ancestor stays
 * free of transform/filter/contain/perspective/will-change. A portal makes
 * this overlay a direct child of <body>, so it's always guaranteed to be
 * truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - target: { resident, paidHistory } | null — null hides the modal
 *  - choice: 'outstanding' | 'history' | 'both' — the currently selected option
 *  - onChoiceChange: (key) => void
 *  - monthlyDue, qrCodeUrl: passed straight through to printSOA
 *  - onClose: () => void
 */
const SOAPrintModal = ({ target, choice, onChoiceChange, monthlyDue, qrCodeUrl, onClose }) => {
  if (!target) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0">
            <Printer size={18} className="text-[#006837]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Statement of Account</h2>
            <p className="text-xs text-slate-400">{target.resident.full_name}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed mb-4">What should this statement show?</p>

        <div className="space-y-2 mb-6">
          {PRINT_OPTIONS.map(opt => (
            <button key={opt.key} type="button" onClick={() => onChoiceChange(opt.key)}
              className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer
                ${choice === opt.key ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <p className={`text-sm font-bold ${choice === opt.key ? 'text-[#006837]' : 'text-slate-700'}`}>{opt.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
            Cancel
          </button>
          <button
            onClick={() => {
              printSOA(target.resident, target.paidHistory, choice, monthlyDue, qrCodeUrl);
              onClose();
            }}
            className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SOAPrintModal;
