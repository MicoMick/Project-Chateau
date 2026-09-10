import React from 'react';
import { Upload } from 'lucide-react';

// Shared between Facility.jsx (cards, Add forms, View modal) and
// FacilityEditModal.jsx (the "Edit Details" modal).

// Dark, readable form field styling — shared by the Add Facility, Add Item,
// and Edit Details modals so they all read the same way.
export const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all placeholder-slate-400";
export const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";

export const fmt12 = (t) => {
  if (!t) return '';
  if (t.includes('-')) return t.split('-').map(s => fmt12(s.trim())).join(' – ');
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

// ─── Liability agreement for borrowed Amenity Items ──────────────────────────
// Builds a condensed but on-point set of terms based on the item's name.
// Shown to homeowners whenever they view an Amenity Item, so the borrowing
// terms are always visible and consistent across every item of that type.
// Returns an array of {label, text} so it can render as clean bullet points.
export const getItemAgreement = (itemName = '') => {
  const name = itemName.toLowerCase();
  const noun = name.includes('chair') ? 'chair(s)'
             : name.includes('tent')  ? 'tent(s)'
             : 'item(s)';

  return [
    { label: 'Care & Use',  text: 'Received in good, working condition. For personal use only within the agreed event area — no lending to third parties.' },
    { label: 'Damage',      text: `Borrower is responsible for the ${noun} from pickup until returned. If damaged or broken, borrower must pay full replacement cost or provide an identical brand-new replacement.` },
    { label: 'Loss/Theft',  text: `Borrower is liable for any missing ${noun}. If lost or not returned, borrower must pay full retail cost or replace with a brand-new identical unit.` },
    { label: 'Return',      text: 'Must be returned clean and in good condition by the agreed deadline, properly stored/packed as issued.' },
  ];
};

// Flat single-line version — used only for storing in the DB `description` column
export const getItemAgreementText = (itemName = '') =>
  getItemAgreement(itemName).map(t => `${t.label}: ${t.text}`).join(' ');

// ─── Upload Zone ──────────────────────────────────────────────────────────────
export const UploadZone = ({ file, onFile, is360, onIs360, inputId, hint }) => (
  <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#006837]/40 transition-all">
    <input type="file" id={inputId} className="hidden" accept="image/*" onChange={e => onFile(e.target.files[0])} />
    <label htmlFor={inputId} className="flex flex-col items-center gap-2 cursor-pointer py-2">
      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
        <Upload size={18} className="text-[#006837]" />
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-600">{file ? file.name : hint || 'Upload Image'}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Click to browse</p>
      </div>
    </label>
    <div className="flex items-center gap-2 justify-center border-t border-slate-200 pt-3 mt-1">
      <input type="checkbox" id={`is360-${inputId}`} checked={is360} onChange={e => onIs360(e.target.checked)}
        className="w-4 h-4 rounded accent-[#006837] cursor-pointer" />
      <label htmlFor={`is360-${inputId}`} className="text-xs font-bold text-slate-600 cursor-pointer">This is a 360° image</label>
    </div>
  </div>
);
