import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, RefreshCw, Plus, Receipt } from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import { fmtCurrency } from './auditorHelpers';

const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837]";
const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5";
const CATEGORIES = ['Salaries', 'Utilities', 'Maintenance', 'Supplies', 'Events', 'Projects', 'Legal', 'Insurance', 'Other'];

/**
 * AddExpenseModal — records a new HOA expense, opened from the "Record New
 * Expenses" button on the Auditor Dashboard's Expenses tab.
 *
 * Landscape layout on purpose: what the expense is (description, category)
 * on the left, the transaction specifics (amount, date) on the right — same
 * side-by-side spread as the other modals in this app.
 *
 * Rendered through a portal straight to <body> — guarantees the backdrop is
 * always truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - onClose: () => void
 *  - onSave: () => void — refetches dashboard data and jumps the Expenses
 *    tab filter to "This Month" so the new entry is immediately visible
 *  - onError: (message) => void — surfaces a failure as a toast
 */
const AddExpenseModal = ({ onClose, onSave, onError }) => {
  const [form, setForm] = useState({ description: '', amount: '', category: 'Maintenance', expense_date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('hoa_expenses').insert([{
        description:  form.description,
        amount:       Number(form.amount),
        category:     form.category,
        expense_date: form.expense_date,
        recorded_by:  user?.id,
      }]);
      if (error) throw error;
      await logAudit('ADD_HOA_EXPENSE', `Auditor recorded expense: ${form.description} — ${fmtCurrency(form.amount)}`);
      onSave();
      onClose();
    } catch (e) { onError('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#006837]/10 flex items-center justify-center shrink-0">
              <Receipt size={18} className="text-[#006837]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900">Record HOA Expense</h2>
              <p className="text-xs text-slate-500 mt-0.5">Adds a new entry to Itemized Expenses</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Landscape body — what it is left, amount/date right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

          {/* Left — what the expense is */}
          <div className="p-7 space-y-5">
            <div>
              <label className={labelCls}>Description</label>
              <input className={inputCls} placeholder="e.g. Electricity bill — June"
                value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <div className="relative">
                <select className={inputCls + ' appearance-none pr-8 cursor-pointer'} value={form.category}
                  onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right — amount and date */}
          <div className="p-7 space-y-5 bg-slate-50/50">
            <div>
              <label className={labelCls}>Amount (₱)</label>
              <input type="number" className={inputCls} placeholder="0.00"
                value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls + ' cursor-pointer'}
                value={form.expense_date} onChange={e => setForm(p => ({...p, expense_date: e.target.value}))} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-bold cursor-pointer text-sm transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-2xl cursor-pointer text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
            {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <><Plus size={14} /> Record Expense</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AddExpenseModal;
