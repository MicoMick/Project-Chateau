import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, FileText, Package, User } from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';

const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300/30 focus:border-red-400";
const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";

/**
 * DamageReportModal — files a maintenance report for an amenity item
 * returned in poor condition, opened from the "Report Damage" button on the
 * Facilities & Amenities tab's Return History table.
 *
 * Landscape layout on purpose: the item/borrower context and condition
 * picker on the left, the actual report content (description + estimated
 * cost) on the right — same side-by-side spread as the other "Details"
 * modals in this app.
 *
 * Rendered through a portal straight to <body> — guarantees the backdrop is
 * always truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - target: the reservation row (with joined facilities/profiles), or null
 *  - onClose: () => void
 *  - onSave: () => void — refetches dashboard data after a successful report
 *  - onError: (message) => void — surfaces a failure as a toast
 */
const DamageReportModal = ({ target, onClose, onSave, onError }) => {
  const [form, setForm] = useState({
    condition:   'Fair',
    description: '',
    estimate:    '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      const itemName   = target.facilities?.name || 'Unknown item';
      const borrower   = target.profiles?.full_name || 'Unknown resident';
      const detail     = `${itemName} returned by ${borrower} — Condition: ${form.condition}. ${form.description}${form.estimate ? ` Estimated repair cost: ₱${form.estimate}.` : ''}`;
      const { error } = await supabase.from('reports').insert([{
        // reports.user_id has a foreign key to profiles — the Auditor filing
        // this (an admin account) has no profiles row, so it can't be the
        // one attributed here. Attribute it to the borrower's own profile
        // instead — it's their item and the report is about them anyway.
        user_id:     target.user_id,
        category:    'maintenance',
        status:      'Pending',
        description: detail,
        created_at:  new Date().toISOString(),
      }]);
      if (error) throw error;
      await logAudit('DAMAGE_REPORT', detail);
      onSave();
      onClose();
    } catch (e) { onError('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-red-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900 truncate">Report Damage / Poor Condition</h2>
              <p className="text-xs text-slate-500 mt-0.5">Filing a maintenance report for a returned amenity item</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Landscape body — item context + condition left, report content right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

          {/* Left — item context + condition */}
          <div className="p-7 space-y-5">
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Package size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item</p>
                  <p className="text-sm font-bold text-slate-900">{target.facilities?.name || 'Unknown item'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <User size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Borrowed By</p>
                  <p className="text-sm font-bold text-slate-900">{target.profiles?.full_name || 'Unknown resident'}</p>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Condition When Returned</label>
              <div className="flex gap-2">
                {['Fair', 'Needs Repair', 'Lost/Damaged'].map(c => (
                  <button key={c} onClick={() => set('condition', c)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black border-2 cursor-pointer transition-all
                      ${form.condition === c
                        ? c === 'Lost/Damaged' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-amber-50 border-amber-400 text-amber-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{c}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Right — report content */}
          <div className="p-7 space-y-5 bg-slate-50/50">
            <div>
              <label className={labelCls}>Damage Description</label>
              <textarea rows={5} className={inputCls + ' resize-none'} placeholder="Describe the damage or condition in detail…"
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Estimated Repair Cost (₱) — Optional</label>
              <input type="number" min="0" className={inputCls} placeholder="0.00"
                value={form.estimate} onChange={e => set('estimate', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-bold cursor-pointer text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.description.trim()}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl cursor-pointer text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
            {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <><FileText size={14} /> File Report</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DamageReportModal;
