import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Edit2, Trash2, History, Eye } from 'lucide-react';
import { monthsCoveredBy, formatMonthCoverage } from './paymentUtils';

/**
 * MonthlyDueDetailsModal — the "View Detail" modal opened from a resident's
 * row in the Transactions table. Read-only overview of every month owed or
 * paid for that resident, with per-month Edit / Void / Request-Settlement
 * actions and a hand-off to Review Proof when a submitted payment is
 * awaiting verification.
 *
 * A due can only become 'paid' through the proof-of-verification step (or a
 * President-approved historical settlement) — this modal never sets 'paid'
 * itself; every mutating action is delegated to a callback prop so Payment.jsx
 * keeps sole ownership of that state.
 *
 * Rendered through a portal straight to <body>: a `fixed inset-0` overlay
 * nested this deep only covers the true viewport if every ancestor stays
 * free of transform/filter/contain/perspective/will-change; any one of those
 * (now or added later) silently shrinks it to that ancestor's box instead,
 * leaving part of the real page uncovered/undimmed behind it. A portal makes
 * the overlay a direct child of <body>, so it's always guaranteed to be truly
 * viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - breakdownPayments: the anchor list the "View Detail" button seeded this
 *      with (a resident's unpaid list, or their full history if settled) —
 *      only used to find the resident's user_id and, as a fallback, their name.
 *  - allPayments: the full `payments` list from Payment.jsx, filtered here by
 *      user_id to get this resident's complete billing history.
 *  - residentsList: used as a fallback to resolve the resident's display name
 *      when a payment row's own `profiles` join wasn't populated.
 *  - monthlyDue: current monthly due amount, needed to work out how many
 *      months a given payment's amount covers (advance payments).
 *  - onEditMonth(payment): open Edit Transaction for this one month.
 *  - onVoidMonth(payment): open the Void confirmation for this one month.
 *  - onRequestSettlement(payment): open the historical-settlement request
 *      form for this one month (only ever offered for 'pending' — i.e.
 *      back-filled pre-app — months).
 *  - onReviewProof(pendingPayment): open Review Proof for the month currently
 *      awaiting the resident's submitted proof, if any.
 */
const MonthlyDueDetailsModal = ({
  isOpen, onClose,
  breakdownPayments, allPayments, residentsList, monthlyDue,
  onEditMonth, onVoidMonth, onRequestSettlement, onReviewProof,
}) => {
  if (!isOpen) return null;

  // Full billing history (paid + unpaid) for whoever the modal is open for,
  // newest month first — so past settled months (Jan–Jun, etc.) stay visible
  // below the current unpaid/pending one instead of disappearing entirely.
  const breakdownUserId = breakdownPayments[0]?.user_id;
  const breakdownFullHistory = breakdownUserId
    ? allPayments
        .filter(p => p.user_id === breakdownUserId)
        .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))
    : breakdownPayments;

  // Summary banner must only total what's still actually owed. breakdownPayments
  // is sometimes seeded with a settled resident's FULL history (see the "View
  // Detail" button for settled rows) just to anchor breakdownUserId above — it
  // is not safe to sum directly, or paid months would inflate "Total Unpaid
  // Balance"/"Months Unpaid".
  const breakdownUnpaidOnly = breakdownFullHistory.filter(p =>
    ['unpaid', 'overdue', 'pending', 'pending_verification'].includes((p.status || '').toLowerCase())
  );

  // A due can only become 'paid' through the proof-of-verification step — a
  // month only reaches 'pending_verification' once the resident has actually
  // submitted a payer_reference_no + proof_url. This modal is a read-only
  // overview of what's owed; it hands off to Review Proof, never sets 'paid' itself.
  const breakdownPendingPayment = breakdownPayments.find(
    p => (p.status || '').toLowerCase() === 'pending_verification'
  ) || null;

  const breakdownMonthsUnpaid = breakdownUnpaidOnly.reduce((s, p) => s + monthsCoveredBy(p.amount, monthlyDue), 0);
  const breakdownAdvanceMonths = breakdownUnpaidOnly
    .filter(p => monthsCoveredBy(p.amount, monthlyDue) > 1)
    .reduce((s, p) => s + monthsCoveredBy(p.amount, monthlyDue), 0);

  const p0 = breakdownPayments[0];
  const residentName = !p0
    ? 'Resident'
    : p0.profiles
      ? (Array.isArray(p0.profiles) ? p0.profiles[0] : p0.profiles)?.full_name || 'Resident'
      : residentsList.find(r => r.id === p0.user_id)?.full_name || 'Resident';

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10">
        <div className="p-7">

          {/* Header */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Monthly Due Details</h2>
              <p className="text-slate-400 text-sm mt-0.5">{residentName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"><X size={18} /></button>
          </div>

          {/* Summary banner — green when fully settled, red when balance is owed */}
          <div className={`border rounded-2xl p-4 mb-5 flex items-center justify-between ${
            breakdownUnpaidOnly.length ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${breakdownUnpaidOnly.length ? 'text-red-400' : 'text-emerald-500'}`}>Total Unpaid Balance</p>
              <p className={`text-2xl font-black ${breakdownUnpaidOnly.length ? 'text-red-600' : 'text-emerald-600'}`}>
                ₱{breakdownUnpaidOnly.reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${breakdownUnpaidOnly.length ? 'text-red-400' : 'text-emerald-500'}`}>Months Unpaid</p>
              <p className={`text-2xl font-black ${breakdownUnpaidOnly.length ? 'text-red-600' : 'text-emerald-600'}`}>{breakdownMonthsUnpaid}</p>
              {breakdownAdvanceMonths > 0 && (
                <p className="inline-flex items-center gap-1 mt-1 text-xs font-black px-2 py-1 rounded-lg bg-purple-100 text-purple-700 border border-purple-200">
                  {breakdownAdvanceMonths} Months Advance
                </p>
              )}
            </div>
          </div>

          {/* Full billing history — unpaid/pending months plus past settled ones, scrolls past ~4 rows */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 mb-5">
            {breakdownFullHistory.map((p, i) => {
              const st = (p.status || '').toLowerCase();
              const badgeColor = st === 'paid'
                ? 'bg-emerald-100 text-emerald-600'
                : st === 'pending_verification'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-red-100 text-red-500';
              const rowMonths = monthsCoveredBy(p.amount, monthlyDue);
              return (
              <div key={p.id} className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <span className={`w-5 h-5 rounded-full ${badgeColor} text-[10px] font-black flex items-center justify-center shrink-0`}>{i + 1}</span>
                  <div>
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
                      {formatMonthCoverage(p.due_date, rowMonths)}
                      {st === 'pending_verification' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Pending Verification</span>
                      )}
                      {st === 'paid' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Paid</span>
                      )}
                    </span>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {st === 'paid'
                        ? `Paid ${p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}`
                        : <>Billed {p.statement_date ? new Date(p.statement_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          {' · '}Due {p.due_date ? new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</>}
                    </p>
                    {rowMonths > 1 && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs font-black px-2 py-1 rounded-lg bg-purple-100 text-purple-700 border border-purple-300">
                        {rowMonths} Months Advance
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-800">₱{Number(p.amount).toLocaleString()}</span>
                  <button onClick={() => onEditMonth(p)}
                    className="text-[#006837] bg-[#006837]/10 hover:bg-[#006837]/20 p-1.5 rounded-lg transition-all cursor-pointer" title="Edit this month only">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => onVoidMonth(p)}
                    className="text-red-500 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-all cursor-pointer" title="Void this month only">
                    <Trash2 size={13} />
                  </button>
                  {st === 'pending' && (
                    <button onClick={() => onRequestSettlement(p)}
                      className="text-amber-600 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-lg transition-all cursor-pointer"
                      title="Already paid in real life, before the app — request historical settlement">
                      <History size={13} />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* Verification status banner */}
          {breakdownPendingPayment ? (
            <div className="mb-5 p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5">
              <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-blue-700">
                The resident has submitted proof of payment for one of these months. Review it to approve or reject — a due can only become <span className="font-black">Paid</span> through that step.
              </p>
            </div>
          ) : (
            <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5">
              <AlertCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-slate-500">
                Waiting on the resident to pay and submit proof (GCash/bank transfer #). These months can't be marked as paid until then.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
              Cancel
            </button>
            <button
              onClick={() => onReviewProof(breakdownPendingPayment)}
              disabled={!breakdownPendingPayment}
              title={!breakdownPendingPayment ? 'No submitted payment to review yet' : undefined}
              className="flex-1 px-5 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <Eye size={16} />
              {breakdownPendingPayment ? 'Review Payment Proof' : 'Awaiting Resident Payment'}
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default MonthlyDueDetailsModal;
