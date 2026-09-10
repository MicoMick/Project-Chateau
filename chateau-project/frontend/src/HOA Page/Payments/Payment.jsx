import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, CreditCard, AlertCircle, CheckCircle2, DollarSign,
  Edit2, X, Loader2,
  LayoutList, TableProperties, Printer, Mail,
  Eye, FileText, XCircle, QrCode, Upload, RefreshCw, ZoomIn, ZoomOut, History,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import ChateauLogo from '../../assets/ChataueLogo.png';
import ResidentFilterSelect from '../Resident Management/ResidentFilterSelect';
import {
  MONTHLY_DUE_DEFAULT, buildLineItemBreakdown, localToday, monthsCoveredBy, formatMonthCoverage,
  buildFullAddress, buildNameCounts, normalizeName,
} from './paymentUtils';
import SOAPrintModal from './SOAPrintModal';
import SendSOAModal from './SendSOAModal';
import MonthlyDueDetailsModal from './MonthlyDueDetailsModal';
import DuplicateBadge from './DuplicateBadge';
import PaginationBar, { usePagination } from './PaginationBar';
import StandingLedger from './StandingLedger';
import PaidTab from './PaidTab';


// ─── Helpers ──────────────────────────────────────────────────────────────────
// MONTHLY_DUE_DEFAULT, buildLineItemBreakdown, localToday, monthsCoveredBy, and
// formatMonthCoverage now live in ./paymentUtils — shared with printSOA.js and
// the extracted SOAPrintModal / MonthlyDueDetailsModal, so every file agrees on
// how a month's due amount and coverage are computed.
const RequireRole = ({ userRole, allowedRoles, children }) => {
  if (allowedRoles.includes(userRole) || userRole === 'super_admin') return children;
  return null;
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const getMonthYear = (date) => {
  const d = new Date(date);
  return { month: d.getMonth(), year: d.getFullYear() };
};

// ─── Reference number generator ───────────────────────────────────────────────
// Generates a per-resident, per-month ref like SOA-202607-1F7A7D — same format
// as the Statement of Account's own reference number, so both match.
const generateRefNo = (month, year, userId) => {
  const mm = String(month + 1).padStart(2, '0');
  const uid = (userId || 'XXXXXX').slice(0, 6).toUpperCase();
  return `SOA-${year}${mm}-${uid}`;
};

// stripLabel, normalizeName, buildNameCounts, buildFullAddress moved to
// ./paymentUtils — DuplicateBadge to ./DuplicateBadge.jsx — shared with the
// extracted StandingLedger and PaidTab so every file agrees on how an
// address is formatted and a duplicate name is detected.
// localToday moved to ./paymentUtils. printSOA moved to ./printSOA.js — used
// exclusively by SOAPrintModal now.


// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, iconColor, bgColor }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between flex-1 hover:shadow-md transition-shadow">
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{title}</p>
      <h3 className="text-3xl font-black text-slate-900 mt-0.5">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl ${bgColor}`}>
      <Icon size={24} className={iconColor} />
    </div>
  </div>
);

// ─── TransactionModal ─────────────────────────────────────────────────────────
const TransactionModal = ({ status, message, onClose }) => {
  if (!status) return null;
  const configs = {
    loading: { icon: <Loader2 className="w-12 h-12 text-[#006837] animate-spin" />, title: 'Processing…',   bg: 'bg-[#006837]/10' },
    success: { icon: <CheckCircle2 className="w-12 h-12 text-emerald-600" />,        title: 'Success!',      bg: 'bg-emerald-50'    },
    error:   { icon: <AlertCircle  className="w-12 h-12 text-red-600" />,            title: 'Action Failed', bg: 'bg-red-50'        },
  };
  const cur = configs[status];
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className={`w-20 h-20 ${cur.bg} rounded-full flex items-center justify-center mx-auto mb-5`}>{cur.icon}</div>
        <h3 className="text-xl font-black text-slate-900 mb-2">{cur.title}</h3>
        <p className="text-slate-500 text-sm mb-7">{message}</p>
        {status !== 'loading' && (
          <button onClick={onClose}
            className="w-full py-3.5 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-2xl transition-all cursor-pointer">
            Continue
          </button>
        )}
      </div>
    </div>
  );
};

// ─── ModalOverlay ─────────────────────────────────────────────────────────────
const ModalOverlay = ({ title, subtitle, isOpen, onClose, children, actionLabel, onAction }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-7">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">{title}</h2>
              <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"><X size={18} /></button>
          </div>
          <div className="space-y-5">{children}</div>
          <div className="flex gap-3 mt-8">
            <button onClick={onClose}
              className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer">
              Cancel
            </button>
            <button onClick={onAction}
              className="flex-1 px-5 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer">
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Main Payment Component ───────────────────────────────────────────────────
const Payment = () => {
  const [searchTerm,       setSearchTerm]       = useState('');
  const [statusFilter,     setStatusFilter]     = useState('All');
  const [residentFilter,   setResidentFilter]   = useState('All');
  const [activeView,       setActiveView]       = useState('transactions'); // 'transactions' | 'paid' | 'standing'

  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false);

  // ── Proof-of-payment verification (resident-submitted, status 'pending_verification') ──
  const [proofReviewPayment, setProofReviewPayment] = useState(null); // the payment row being reviewed
  const [proofReviewImage,   setProofReviewImage]   = useState(null); // proof_url shown in lightbox
  const [proofReviewZoomed,  setProofReviewZoomed]  = useState(false); // toggled by clicking the proof image
  const [verifyingPaymentId, setVerifyingPaymentId]  = useState(null);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false); // "make sure it's finalized" step, gated by a countdown
  const [approveCountdown,     setApproveCountdown]     = useState(0);
  const [selectedPayment,       setSelectedPayment]       = useState(null);
  const [isConfirmVoidOpen,     setIsConfirmVoidOpen]     = useState(false);
  const [isUnpaidBreakdownOpen, setIsUnpaidBreakdownOpen] = useState(false);
  const [breakdownPayments,     setBreakdownPayments]     = useState([]);
  const [residentsList,     setResidentsList]     = useState([]);

  // ── Historical settlement (pre-app dues paid in real life, no in-app proof) ──
  // A Treasurer can't mark these paid directly — that's the same abuse risk as
  // marking any due paid without proof. Instead this sends a request to
  // approval_requests, which only takes effect once the President approves it
  // in Pending Approval — same two-step pattern already used for Void.
  const [historicalSettlementPayment, setHistoricalSettlementPayment] = useState(null);
  const [historicalNote,              setHistoricalNote]              = useState('');

  const [transaction,          setTransaction]          = useState({ status: null, message: '' });
  const [editFormData,         setEditFormData]         = useState({ amount: '', status: '', due_date: '', reference_no: '', paid_at: '', payer_reference_no: '' });
  const [payments,             setPayments]             = useState([]);
  const [loading,              setLoading]              = useState(true);

  const currentUserRole = localStorage.getItem('userRole') || 'resident';

  // ── Configurable monthly due (Treasurer/President only) ─────────────────────
  // Stored in hoa_settings (single row, id=1). Falls back to MONTHLY_DUE_DEFAULT
  // until the fetch below resolves, and again if the table doesn't exist yet.
  const [monthlyDue,           setMonthlyDue]           = useState(MONTHLY_DUE_DEFAULT);
  const [isEditDueOpen,        setIsEditDueOpen]        = useState(false);
  const [editDueValue,         setEditDueValue]         = useState('');
  const [savingDue,            setSavingDue]            = useState(false);

  // ── GCash QR code (Treasurer/President only) ─────────────────────────────────
  // Also stored on the hoa_settings single row, as photo_url — an image in
  // the public 'hoa-qr-codes' storage bucket. Shown on the printed/emailed SOA
  // so residents can scan-to-pay.
  const [qrCodeUrl,            setQrCodeUrl]            = useState(null);
  const [uploadingQr,          setUploadingQr]          = useState(false);
  const [isQrModalOpen,        setIsQrModalOpen]        = useState(false);

  const fetchMonthlyDue = async () => {
    try {
      const { data, error } = await supabase.from('hoa_settings').select('monthly_due_amount, photo_url').eq('id', 1).single();
      if (!error && data) {
        if (data.monthly_due_amount != null) setMonthlyDue(Number(data.monthly_due_amount));
        setQrCodeUrl(data.photo_url || null);
      }
    } catch (_e) {
      // hoa_settings not set up yet — keep the defaults.
    }
  };

  const handleUploadQrCode = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please upload an image file (PNG or JPG).'); return; }
    setUploadingQr(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `gcash-qr-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('hoa-qr-codes').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('hoa-qr-codes').getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateErr } = await supabase.from('hoa_settings').update({
        photo_url: publicUrl,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      }).eq('id', 1);
      if (updateErr) throw updateErr;

      setQrCodeUrl(publicUrl);
      await logAudit('UPDATE_QR_CODE', 'Updated the GCash payment QR code shown on the Statement of Account.');
    } catch (e) {
      alert('Failed to upload QR code: ' + e.message);
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSaveMonthlyDue = async () => {
    const newAmount = Number(editDueValue);
    if (!newAmount || newAmount <= 0) { alert('Enter a valid amount greater than 0.'); return; }
    setSavingDue(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('hoa_settings').update({
        monthly_due_amount: newAmount,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      }).eq('id', 1);
      if (error) throw error;
      setMonthlyDue(newAmount);
      await logAudit('UPDATE_MONTHLY_DUE', `Monthly due changed from ₱${monthlyDue} to ₱${newAmount}.`);
      setIsEditDueOpen(false);
    } catch (e) {
      alert('Failed to update monthly due: ' + e.message);
    } finally {
      setSavingDue(false);
    }
  };

  // ── Approve or reject a resident-submitted proof of payment ─────────────────
  // Payment rows land in status 'pending_verification' once a resident submits
  // payer_reference_no + proof_url (+ submitted_at) from the mobile app.
  const handleVerifyPayment = async (payment, decision) => {
    if (!payment) return;
    setVerifyingPaymentId(payment.id);
    try {
      let updates;
      if (decision === 'approve') {
        updates = {
          status: 'paid',
          paid_at: payment.submitted_at || new Date().toISOString(),
        };
        // Advance payments submitted from the mobile app land here without a
        // HOA reference number — only the per-month generator normally
        // assigns one. Backfill it now so the SOA / payment history always
        // shows a HOA REF # instead of "—".
        if (!payment.reference_no) {
          const { month, year } = getMonthYear(payment.due_date || new Date());
          updates.reference_no = generateRefNo(month, year, payment.user_id);
        }
      } else {
        // Reject — revert to unpaid/overdue (based on due date) and clear the
        // submission so the resident can resubmit a corrected proof.
        const isPastDue = payment.due_date && new Date(payment.due_date) < new Date();
        updates = {
          status: isPastDue ? 'overdue' : 'unpaid',
          payer_reference_no: null,
          proof_url: null,
          submitted_at: null,
        };
      }
      const { error } = await supabase.from('payments').update(updates).eq('id', payment.id);
      if (error) throw error;

      const residentName = residentsList.find(r => r.id === payment.user_id)?.full_name || 'Resident';
      const monthsCovered = monthsCoveredBy(payment.amount, monthlyDue);
      const advanceNote = monthsCovered > 1 ? ` (covers ${monthsCovered} months — advance payment)` : '';
      await logAudit(
        decision === 'approve' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
        `${decision === 'approve' ? 'Approved' : 'Rejected'} submitted proof of payment for ${residentName} — ₱${Number(payment.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}${advanceNote}, due ${payment.due_date || '—'}.`,
      );

      // ── Auto-reactivate if approving cleared the resident's last unpaid due ──
      if (decision === 'approve') {
        const { data: residentData } = await supabase
          .from('profiles').select('id, full_name, account_status')
          .eq('id', payment.user_id).single();

        if (residentData?.account_status === 'delinquent') {
          const { data: stillUnpaid } = await supabase
            .from('payments').select('id')
            .eq('user_id', payment.user_id)
            .in('status', ['unpaid', 'overdue', 'pending', 'pending_verification'])
            .limit(1);

          if (!stillUnpaid?.length) {
            await supabase.from('profiles')
              .update({ account_status: 'active' }).eq('id', payment.user_id);
            await logAudit('AUTO_REACTIVATE',
              `${residentData.full_name} auto-reactivated — all dues are now paid.`);
            fetchResidentsList();
          }
        }
      }

      await fetchPayments();
      setProofReviewPayment(null);
    } catch (e) {
      alert('Failed to update payment: ' + e.message);
    } finally {
      setVerifyingPaymentId(null);
    }
  };

  // ── Bulk-send SOA emails to every resident with an outstanding balance ──
  // Calls the 'send-soa-emails' Supabase Edge Function (see
  // supabase/functions/send-soa-emails/index.ts). Requires RESEND_API_KEY
  // to be set as an Edge Function secret before this will actually deliver mail.
  const [sendingSOA,        setSendingSOA]        = useState(false);
  const [showSendConfirm,   setShowSendConfirm]   = useState(false);
  const [sendSOAResult,     setSendSOAResult]     = useState(null);
  const [sendSOAViewMode,   setSendSOAViewMode]   = useState('both'); // 'outstanding' | 'history' | 'both' — applied to bulk email

  // ── Per-resident SOA print — content filter modal ──────────────────────────
  // Lets the treasurer choose, right before printing, whether the statement
  // shows outstanding charges only or past payment history only.
  const [soaPrintTarget, setSoaPrintTarget] = useState(null); // { resident, paidHistory } | null
  const [soaPrintChoice, setSoaPrintChoice] = useState('outstanding'); // 'outstanding' | 'history' | 'both'

  const handleSendAllSOA = async () => {
    setSendingSOA(true);
    setSendSOAResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-soa-emails', {
        body: { viewMode: sendSOAViewMode },
      });
      if (error) throw error;
      setSendSOAResult({ type: 'success', ...data });
      await logAudit('BULK_SEND_SOA', `Sent ${data.sent || 0} SOA email(s), ${data.failed || 0} failed.`);
    } catch (e) {
      setSendSOAResult({ type: 'error', error: e.message });
    } finally {
      setSendingSOA(false);
      setShowSendConfirm(false);
    }
  };

  const fetchAll = () => { fetchPayments(); fetchResidentsList(); fetchMonthlyDue(); };

  useEffect(() => { fetchAll(); }, []);

  // ── "Make sure it's finalized" countdown for the Approve confirmation ────────
  // Forces a short pause before Approve is clickable, so a treasurer can't
  // reflexively double-click through the confirmation without a beat to
  // actually re-check the proof.
  useEffect(() => {
    if (!isApproveConfirmOpen) return;
    setApproveCountdown(5);
    const interval = setInterval(() => {
      setApproveCountdown(c => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isApproveConfirmOpen]);

  // ── Extracted: generate dues for current month ──────────────────────────────
  // Called automatically on the 1st, OR manually via the demo test button.
  // force=true skips the "already generated this month" check.
  //
  // statement_date = the day the bill is issued (today, when this runs)
  // due_date       = the deadline to pay — last day of the SAME month
  // This keeps "when was I billed" clearly separate from "when must I pay".
  const runGenerateDues = async (force = false) => {
    const today          = new Date();
    today.setHours(0, 0, 0, 0);
    const month          = today.getMonth();
    const year           = today.getFullYear();
    const statementDate  = localToday();                                   // today — when the bill is issued
    const monthEnd        = new Date(year, month + 1, 0).toISOString().split('T')[0]; // due date — end of month
    const monthStart      = new Date(year, month,     1).toISOString().split('T')[0];

    const { data: residentsRaw } = await supabase
      .from('profiles').select('id, full_name, resident_type')
      .eq('account_status', 'active').order('full_name');
    // Tenants aren't billed for HOA dues — only owners/residents are (see fetchResidentsList above).
    const residents = (residentsRaw || []).filter(r => (r.resident_type || '').toLowerCase() !== 'tenant');
    if (!residents?.length) return { skipped: true, reason: 'No active residents found.' };

    // Per-resident idempotency — a resident who already has a payment row for
    // this month (e.g. paid in advance, or back-filled as 'pending' on
    // approval) must be skipped individually, not used to bail out of billing
    // everyone else. This used to check "does ANY row exist this month" and
    // skip the WHOLE batch if so, which silently left every other resident
    // unbilled for the month whenever even one resident already had a row.
    let residentsNeeding = residents;
    if (!force) {
      // Lower bound only — a row's due_date is the LAST month an advance
      // payment covers (see monthsCoveredBy/formatMonthCoverage further down
      // this component), so a resident who prepaid Aug+Sep in July has ONE
      // row with due_date = Sep 30. Adding an upper bound of monthEnd would
      // put that row outside August's window and wrongly bill them again for
      // a month they already paid for.
      const { data: existingFromThisMonthOn } = await supabase
        .from('payments').select('user_id, amount, due_date')
        .gte('due_date', monthStart);
      const currentIdx = year * 12 + month;
      const alreadyBilled = new Set();
      (existingFromThisMonthOn || []).forEach(p => {
        if (!p.due_date) return;
        const d = new Date(p.due_date);
        const dueIdx = d.getFullYear() * 12 + d.getMonth();
        const covered = monthsCoveredBy(p.amount, monthlyDue);
        const startIdx = dueIdx - (covered - 1);
        if (startIdx <= currentIdx && currentIdx <= dueIdx) alreadyBilled.add(p.user_id);
      });
      residentsNeeding = residents.filter(r => !alreadyBilled.has(r.id));
      if (!residentsNeeding.length) return { skipped: true, reason: 'Already generated for this month.' };
    }

    const lineItems = buildLineItemBreakdown(monthlyDue);

    const rows = residentsNeeding.map(r => ({
      user_id:        r.id,
      amount:         monthlyDue,
      statement_date: statementDate,
      due_date:       monthEnd,
      status:         'unpaid',
      reference_no:   generateRefNo(month, year, r.id),
      line_items:     lineItems,
    }));

    const { error } = await supabase.from('payments').insert(rows);
    if (error) return { success: false, error: error.message };

    await logAudit('AUTO_MONTHLY_DUE',
      `Generated ₱${monthlyDue} monthly dues for ${rows.length} residents — ${MONTHS[month]} ${year}. Statement: ${statementDate}, Due: ${monthEnd}.`);
    fetchPayments();
    return { success: true, count: rows.length, month: MONTHS[month], year };
  };

  // ── Back-fill past dues for a resident with NO payment records at all ────────
  // Mirrors AccountApproval.jsx's backfillPastDues, but callable on-demand
  // from this page. A brand-new resident normally gets Jan→current-month dues
  // generated the moment their account is approved — but if that step was
  // skipped, failed silently, or their account predates the feature, they're
  // left with zero payment rows and show up here as "No Record" with no way
  // to open their detail view. This regenerates the missing months (as
  // 'pending', same as a fresh approval) so View Detail always has something
  // to show. Months after the current one are left alone — those keep coming
  // from the regular auto-generate-dues job, not from here.
  const backfillPastDuesForResident = async (residentId) => {
    try {
      const lineItems = buildLineItemBreakdown(monthlyDue);
      const now = new Date();
      const year = now.getFullYear();
      const currentMonth = now.getMonth();

      const { data: existing } = await supabase.from('payments').select('due_date').eq('user_id', residentId);
      const existingMonths = new Set((existing || []).map(p => (p.due_date || '').slice(0, 7)));

      const rows = [];
      for (let m = 0; m <= currentMonth; m++) {
        const lastDay = new Date(year, m + 1, 0).getDate();
        const dueDate = `${year}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        if (existingMonths.has(dueDate.slice(0, 7))) continue;
        rows.push({
          user_id:        residentId,
          amount:         monthlyDue,
          statement_date: `${year}-${String(m + 1).padStart(2, '0')}-01`,
          due_date:       dueDate,
          status:         'pending',
          reference_no:   generateRefNo(m, year, residentId),
          line_items:     lineItems,
        });
      }
      if (!rows.length) return [];

      const { data: inserted, error } = await supabase.from('payments').insert(rows).select();
      if (error) throw error;

      const residentName = residentsList.find(res => res.id === residentId)?.full_name || 'Resident';
      await logAudit('BACKFILL_DUES',
        `${residentName} — back-filled ${rows.length} past due(s) as Pending (${MONTHS[0]}–${MONTHS[currentMonth]} ${year}) for Treasurer verification`);

      return inserted || [];
    } catch (e) {
      console.error('Back-filling past dues failed:', e.message);
      return [];
    }
  };

  // ── Balance-based delinquency check ──────────────────────────────────────
  // Flags any active resident whose total unpaid balance is ≥ ₱450 (3 months).
  // The graceDays param is kept for backward-compat but no longer used.
  const runDelinquencyCheck = async (graceDays = null) => {
    const DELINQUENT_THRESHOLD = monthlyDue * 3; // 3 months unpaid, at the current due amount

    // Fetch all unpaid payments grouped by resident.
    // 'pending' is excluded — those are unverified back-filled dues on newly
    // approved residents (see AccountApproval.jsx) and shouldn't by themselves
    // flip a brand-new resident straight to delinquent before the Treasurer
    // has had a chance to verify whether they were already paid.
    const { data: unpaidPayments, error: fetchErr } = await supabase
      .from('payments')
      .select('user_id, amount')
      .in('status', ['unpaid', 'overdue', 'pending_verification']);

    if (fetchErr || !unpaidPayments?.length) return { success: true, count: 0 };

    // Sum balance per resident — flag those >= threshold
    const balanceMap = {};
    unpaidPayments.forEach(p => {
      balanceMap[p.user_id] = (balanceMap[p.user_id] || 0) + Number(p.amount || 0);
    });

    const eligibleIds = Object.entries(balanceMap)
      .filter(([, bal]) => bal >= DELINQUENT_THRESHOLD)
      .map(([id]) => id);

    if (!eligibleIds.length) return { success: true, count: 0 };

    // Only flag those who are currently active (don't re-flag already delinquent)
    const { data: activeResidents } = await supabase
      .from('profiles').select('id, full_name')
      .in('id', eligibleIds).eq('account_status', 'active');

    if (!activeResidents?.length) return { success: true, count: 0 };

    const idsToFlag = activeResidents.map(r => r.id);
    const { error } = await supabase.from('profiles')
      .update({ account_status: 'delinquent' }).in('id', idsToFlag);

    if (error) return { success: false, error: error.message };

    await logAudit('AUTO_DELINQUENT',
      `Marked ${idsToFlag.length} resident(s) as delinquent — unpaid balance ≥ ₱${DELINQUENT_THRESHOLD}. Residents: ${activeResidents.map(r => r.full_name).join(', ')}`);
    return { success: true, count: idsToFlag.length, names: activeResidents.map(r => r.full_name) };
  };

  // NOTE: Monthly dues generation + delinquency checks used to auto-run here
  // on every Payments page load. That's now handled server-side by the
  // `generate-monthly-dues` Edge Function, scheduled via Supabase Cron to run
  // every midnight (PHT) — independent of whether anyone opens this page.
  // runGenerateDues() and runDelinquencyCheck() below are kept for the manual
  // "force generate" test button and other UI actions that still call them directly.

  const fetchResidentsList = async () => {
    try {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, phone, block, lot, street, resident_type')
        .order('full_name');
      // Tenants aren't billed for HOA dues — exclude them from every table on this page.
      const owners = (data || []).filter(r => (r.resident_type || '').toLowerCase() !== 'tenant');
      setResidentsList(owners);
    } catch (e) { console.error(e.message); }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data: pData, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (!pData?.length) { setPayments([]); return; }

      // Auto-overdue check
      // 'pending' is excluded on purpose — it's used for back-filled dues on
      // newly-approved residents (see AccountApproval.jsx's backfillPastDues),
      // which represent unverified history rather than a confirmed missed
      // payment. They stay 'pending' until the Treasurer verifies/edits them,
      // instead of silently flipping to 'overdue' once their due date passes.
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const toOverdue = pData.filter(p => p.status !== 'paid' && p.status !== 'overdue' && p.status !== 'pending_verification' && p.status !== 'pending' && p.due_date && new Date(p.due_date) < today).map(p => p.id);
      if (toOverdue.length) {
        await supabase.from('payments').update({ status: 'overdue' }).in('id', toOverdue);
        await logAudit('SYSTEM_AUTO_UPDATE', `Auto-updated ${toOverdue.length} payment(s) to Overdue.`);
        toOverdue.forEach(id => { const p = pData.find(x => x.id === id); if (p) p.status = 'overdue'; });
      }

      const userIds = [...new Set(pData.map(p => p.user_id).filter(Boolean))];
      let profiles  = [];
      if (userIds.length) {
        const { data: pr } = await supabase.from('profiles').select('id, full_name, address, street, email, phone').in('id', userIds);
        profiles = pr || [];
      }
      setPayments(pData.map(p => ({ ...p, profiles: profiles.find(pr => pr.id === p.user_id) || null })));
    } catch (e) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value,
      // Auto-fill paid_at with today when status is switched to 'paid'
      // Clear it if status is switched away from 'paid'
      ...(name === 'status' && value === 'paid' && !prev.paid_at
        ? { paid_at: localToday() }
        : name === 'status' && value !== 'paid'
        ? { paid_at: '' }
        : {}),
    }));
  };

  const submitEditTransaction = async () => {
    if (!selectedPayment) return;
    if (editFormData.status === 'paid' && !editFormData.payer_reference_no?.trim()) {
      setTransaction({ status: 'error', message: 'Please enter the resident\'s payment reference number (GCash/bank transfer #) before marking as paid.' });
      return;
    }
    setTransaction({ status: 'loading', message: 'Updating transaction…' });
    try {
      const payload = {
        amount: editFormData.amount ? Number(editFormData.amount) : null,
        status: editFormData.status, due_date: editFormData.due_date || null, reference_no: editFormData.reference_no || null,
        paid_at: editFormData.status === 'paid' ? (editFormData.paid_at ? new Date(editFormData.paid_at).toISOString() : new Date().toISOString()) : null,
        payer_reference_no: editFormData.status === 'paid' ? (editFormData.payer_reference_no?.trim() || null) : null,
      };

      const { error } = await supabase.from('payments').update(payload).eq('id', selectedPayment.id);
      if (error) throw error;
      await logAudit('EDIT_PAYMENT', `Updated Ref: ${payload.reference_no || selectedPayment.reference_no} → ${payload.status}.`);

      // ── Auto-reactivate delinquent resident if all dues are now paid ────
      // Only runs when the payment being updated is marked as 'paid'
      if (payload.status === 'paid' && selectedPayment.user_id) {
        // Check if the resident is currently delinquent
        const { data: residentData } = await supabase
          .from('profiles')
          .select('id, full_name, account_status')
          .eq('id', selectedPayment.user_id)
          .single();

        if (residentData?.account_status === 'delinquent') {
          // Check if this resident still has any remaining unpaid dues
          const { data: remainingUnpaid } = await supabase
            .from('payments')
            .select('id')
            .eq('user_id', selectedPayment.user_id)
            .in('status', ['unpaid', 'overdue', 'pending', 'pending_verification'])
            .neq('id', selectedPayment.id) // exclude the one we just paid
            .limit(1);

          // No more unpaid dues — reactivate the account
          if (!remainingUnpaid?.length) {
            const { error: reactivateErr } = await supabase
              .from('profiles')
              .update({ account_status: 'active' })
              .eq('id', selectedPayment.user_id);

            if (!reactivateErr) {
              await logAudit(
                'AUTO_REACTIVATE',
                `${residentData.full_name} auto-reactivated — all dues are now paid.`
              );
              setIsEditTransactionOpen(false);
              fetchPayments();
              setTransaction({
                status: 'success',
                message: `Payment recorded. ${residentData.full_name}'s account has been automatically reactivated — all dues are now settled.`,
              });
              return;
            }
          }
        }
      }
      // ────────────────────────────────────────────────────────────────────

      setIsEditTransactionOpen(false);
      fetchPayments();
      setTransaction({ status: 'success', message: 'Transaction updated successfully.' });
    } catch (e) { setTransaction({ status: 'error', message: 'Failed: ' + e.message }); }
  };

  const handleVoidTransaction = async () => {
    if (!selectedPayment) return;
    setIsConfirmVoidOpen(false);
    if (currentUserRole === 'super_admin') {
      setTransaction({ status: 'loading', message: 'Voiding transaction…' });
      try {
        const { error } = await supabase.from('payments').delete().eq('id', selectedPayment.id);
        if (error) throw error;
        await logAudit('VOID_PAYMENT', `Voided Ref: ${selectedPayment.reference_no}.`);
        fetchPayments();
        setTransaction({ status: 'success', message: 'Transaction voided.' });
      } catch (e) { setTransaction({ status: 'error', message: 'Failed: ' + e.message }); }
    } else {
      setTransaction({ status: 'loading', message: 'Submitting void request…' });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Self-read of our own admins row — RLS on 'admins' only allows an
        // admin to read their own row (or a super_admin to read any), so this
        // is captured now rather than looked up cross-admin when the
        // President reviews it later (see RequestDetailModal.jsx).
        const { data: ownAdmin } = user?.id
          ? await supabase.from('admins').select('role, display_name').eq('id', user.id).maybeSingle()
          : { data: null };
        const { error } = await supabase.from('approval_requests').insert([{
          target_table: 'payments', target_id: selectedPayment.id, action_type: 'DELETE',
          requested_data: { reference_no: selectedPayment.reference_no, amount: selectedPayment.amount },
          status: 'PENDING', requested_by: user?.id || null,
          requested_by_role: ownAdmin?.role || null, requested_by_name: ownAdmin?.display_name || null,
        }]);
        if (error) throw error;
        await logAudit('REQUEST_VOID_PAYMENT', `Void request for Ref: ${selectedPayment.reference_no}.`);
        setTransaction({ status: 'success', message: 'Void request sent to the President for approval.' });
      } catch (e) { setTransaction({ status: 'error', message: 'Failed: ' + e.message }); }
    }
  };

  // ── Historical settlement request ─────────────────────────────────────────
  // For a 'pending' due (back-filled — see backfillPastDuesForResident above)
  // that the resident actually already paid in real life before the app
  // existed. There's no in-app proof to submit for a month that already
  // happened, so this can't go through the normal proof-of-payment flow — but
  // a Treasurer also can't just flip it to 'paid' directly (that's exactly the
  // one-click abuse risk the Edit Transaction form already refuses to allow).
  // Instead this sends a request to approval_requests; it only takes effect
  // once the President reviews the note and approves it in Pending Approval.
  const requestHistoricalSettlement = async () => {
    if (!historicalSettlementPayment) return;
    const note = historicalNote.trim();
    if (note.length < 10) {
      setTransaction({ status: 'error', message: 'Please describe how this was verified (OR#, ledger entry, date paid, etc.) — at least a sentence.' });
      return;
    }
    setTransaction({ status: 'loading', message: 'Submitting settlement request…' });
    try {
      const p = historicalSettlementPayment;
      const residentName = (Array.isArray(p.profiles) ? p.profiles[0]?.full_name : p.profiles?.full_name)
        || residentsList.find(r => r.id === p.user_id)?.full_name || 'Resident';
      const monthLabel = formatMonthCoverage(p.due_date, monthsCoveredBy(p.amount, monthlyDue));

      const { data: { user } } = await supabase.auth.getUser();
      // Self-read of our own admins row — see the matching comment in
      // handleVoidTransaction above.
      const { data: ownAdmin } = user?.id
        ? await supabase.from('admins').select('role, display_name').eq('id', user.id).maybeSingle()
        : { data: null };
      const { error } = await supabase.from('approval_requests').insert([{
        target_table: 'payments', target_id: p.id, action_type: 'UPDATE',
        requested_data: {
          status: 'paid',
          paid_at: new Date().toISOString(),
          payer_reference_no: 'Historical/Manual settlement — pre-app payment',
          reference_no: p.reference_no,
          amount: p.amount,
          // Display-only for the Pending Approval review table — stripped
          // before the actual payments update runs (see PendingApproval.jsx).
          details: `${residentName} — ${monthLabel}: ${note}`,
        },
        status: 'PENDING', requested_by: user?.id || null,
        requested_by_role: ownAdmin?.role || null, requested_by_name: ownAdmin?.display_name || null,
      }]);
      if (error) throw error;

      await logAudit('REQUEST_HISTORICAL_SETTLEMENT',
        `Requested historical settlement for ${residentName} — ${monthLabel}: ${note}`);
      setHistoricalSettlementPayment(null);
      setHistoricalNote('');
      setTransaction({ status: 'success', message: 'Sent to the President for approval. It stays Pending until then.' });
    } catch (e) {
      setTransaction({ status: 'error', message: 'Failed: ' + e.message });
    }
  };

  // ── Resident-based table rows — one row per resident, always ─────────────────
  // Amount = unpaid balance (grows as months are generated, resets to ₱0 when paid).
  // Paid receipts are NOT shown as separate rows — the table is resident-centric.
  const mainNameCounts = buildNameCounts(residentsList);
  const residentRows = residentsList.map(r => {
    const rPayments = payments.filter(p => p.user_id === r.id);
    const unpaidList = rPayments.filter(p =>
      ['unpaid','overdue','pending','pending_verification'].includes((p.status || '').toLowerCase())
    ).sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

    const balance = unpaidList.reduce((s, p) => s + Number(p.amount || 0), 0);
    const months  = unpaidList.length;
    const oldest  = unpaidList[0]?.due_date || null;
    const newest  = unpaidList[unpaidList.length - 1]?.due_date || null;

    // Determine standing badge
    const hasAnyPayment = rPayments.length > 0;
    let standing = 'No Record';
    if (hasAnyPayment) {
      standing = months > 0 ? 'Unpaid' : 'Settled';
    }

    // The specific unpaid month (if any) currently awaiting treasurer/president
    // review — resident already submitted payer_reference_no + proof_url.
    const pendingVerification = unpaidList.find(p => (p.status || '').toLowerCase() === 'pending_verification') || null;

    // A resident "paid in advance" if any single payment row's amount covers
    // more than one month at once (e.g. ₱300 against a ₱150 due). Flagged
    // separately from pendingAdvanceVerification so the filter can surface
    // advance payers regardless of status, while the notification badge only
    // counts ones still awaiting the Treasurer's review.
    const hasAdvancePayment = rPayments.some(p => monthsCoveredBy(p.amount, monthlyDue) > 1);
    const pendingAdvanceVerification = pendingVerification && monthsCoveredBy(pendingVerification.amount, monthlyDue) > 1
      ? pendingVerification : null;

    return {
      _residentRow: true,
      user_id:      r.id,
      full_name:    r.full_name || '—',
      isDuplicate:  mainNameCounts[normalizeName(r.full_name)] > 1,
      street:       r.street || 'N/A',
      fullAddress:  buildFullAddress(r.block, r.lot, r.street),
      block:        r.block || '',
      lot:          r.lot   || '',
      balance,
      months,
      oldest,
      newest,
      standing,
      unpaidList,
      allPayments: rPayments,
      pendingVerification,
      hasAdvancePayment,
      pendingAdvanceVerification,
    };
  });

  // Apply search + resident filter to resident rows
  const consolidatedPayments = residentRows.filter(r => {
    const nameMatch = r.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const residentMatch = residentFilter === 'All' || r.user_id === residentFilter;
    const statusMatch = statusFilter === 'All'
      || (statusFilter === 'Paid'    && r.standing === 'Settled')
      || (statusFilter === 'Unpaid'  && r.unpaidList.some(p => (p.status || '').toLowerCase() === 'unpaid'))
      || (statusFilter === 'Overdue' && r.unpaidList.some(p => (p.status || '').toLowerCase() === 'overdue'))
      || (statusFilter === 'Pending' && r.unpaidList.some(p => (p.status || '').toLowerCase() === 'pending'))
      || (statusFilter === 'PendingVerification' && !!r.pendingVerification)
      || (statusFilter === 'Advance' && r.hasAdvancePayment);
    return nameMatch && residentMatch && statusMatch;
  }).sort((a, b) => (a.months > 0 ? 0 : 1) - (b.months > 0 ? 0 : 1));

  const { paginated: paginatedPayments, page: transPage, setPage: setTransPage, totalPages: transTotalPages } = usePagination(consolidatedPayments, 5);

  // Notification badge — advance payments still awaiting Treasurer verification.
  const advancePendingResidents = residentRows.filter(r => r.pendingAdvanceVerification);

  const totalCollected = payments.filter(p => p.status?.toLowerCase() === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount   = payments.filter(p => ['pending','unpaid'].includes(p.status?.toLowerCase())).length;
  const pendingVerificationCount = payments.filter(p => p.status?.toLowerCase() === 'pending_verification').length;
  const overdueCount   = payments.filter(p => p.status?.toLowerCase() === 'overdue').length;
  const paidCount      = payments.filter(p => p.status?.toLowerCase() === 'paid').length;


  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
        <p className="text-[#006837] font-semibold animate-pulse">Loading payment data…</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen space-y-6">

      <TransactionModal status={transaction.status} message={transaction.message}
        onClose={() => { setTransaction({ status: null, message: '' }); fetchPayments(); }} />

      {/* ── Monthly Due Details ── */}
      <MonthlyDueDetailsModal
        isOpen={isUnpaidBreakdownOpen}
        onClose={() => setIsUnpaidBreakdownOpen(false)}
        breakdownPayments={breakdownPayments}
        allPayments={payments}
        residentsList={residentsList}
        monthlyDue={monthlyDue}
        onEditMonth={(p) => {
          setSelectedPayment(p);
          setEditFormData({ amount: p.amount || '', status: p.status || 'unpaid', due_date: p.due_date?.split('T')[0] || '', reference_no: p.reference_no || '', paid_at: p.paid_at?.split('T')[0] || '', payer_reference_no: p.payer_reference_no || '' });
          setIsUnpaidBreakdownOpen(false);
          setIsEditTransactionOpen(true);
        }}
        onVoidMonth={(p) => {
          setSelectedPayment(p);
          setIsUnpaidBreakdownOpen(false);
          setIsConfirmVoidOpen(true);
        }}
        onRequestSettlement={(p) => {
          setHistoricalSettlementPayment(p);
          setHistoricalNote('');
          setIsUnpaidBreakdownOpen(false);
        }}
        onReviewProof={(pendingPayment) => {
          setIsUnpaidBreakdownOpen(false);
          setProofReviewPayment(pendingPayment);
        }}
      />

      {/* ── Void confirm ── */}
      <ModalOverlay
        isOpen={isConfirmVoidOpen} onClose={() => setIsConfirmVoidOpen(false)}
        title="Request Void Approval"
        subtitle="This requires President approval before the transaction is removed."
        actionLabel="Submit Request"
        onAction={handleVoidTransaction}
      >
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3">
          <AlertCircle size={18} />
          <p className="text-sm font-semibold">
            The President will review and approve this deletion.
          </p>
        </div>
      </ModalOverlay>

      {/* ── Historical settlement request (pre-app due, paid in real life) ── */}
      <ModalOverlay
        isOpen={!!historicalSettlementPayment} onClose={() => setHistoricalSettlementPayment(null)}
        title="Request Historical Settlement"
        subtitle="This requires President approval before the month is marked Paid."
        actionLabel="Send for Approval"
        onAction={requestHistoricalSettlement}
      >
        <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl flex items-start gap-3">
          <History size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">
            Only use this for dues from before the app existed, paid in real life (cash/manual) with no in-app proof to submit.
            The Treasurer can't mark a due Paid directly — the President must confirm it first, the same way Void requests work.
          </p>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            How was this verified? <span className="text-red-500">*required</span>
          </label>
          <textarea
            value={historicalNote}
            onChange={e => setHistoricalNote(e.target.value)}
            rows={3}
            placeholder="e.g. OR#1042, paid cash to the previous Treasurer on Jan 5 2026, confirmed against the physical ledger"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20"
          />
        </div>
      </ModalOverlay>

      {/* ── Edit transaction ── */}
      <ModalOverlay isOpen={isEditTransactionOpen} onClose={() => setIsEditTransactionOpen(false)}
        title="Edit Transaction" subtitle="Update resident payment details"
        actionLabel="Update Transaction" onAction={submitEditTransaction}>
        <div className="grid gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Resident</label>
            <input readOnly value={(Array.isArray(selectedPayment?.profiles) ? selectedPayment?.profiles[0]?.full_name : selectedPayment?.profiles?.full_name) || 'Unknown'}
              className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl cursor-not-allowed text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
            {/* 'pending' and 'pending_verification' are deliberately NOT
                manually selectable here. Both are status values that other
                flows treat as proof a real event already happened elsewhere:
                'pending' = the automated historical backfill ran at account
                approval, 'pending_verification' = the resident actually
                submitted a reference # + proof photo through the app. Letting
                a treasurer relabel any ordinary due into either one by hand
                would let them open the settlement-request flow, or the Review
                Proof modal's Approve button, on a due with nothing real to
                review — a one-click path to marking a due Paid with no
                payment behind it. Reverting back to Unpaid stays available as
                a normal correction. */}
            <select name="status" value={editFormData.status} onChange={handleEditChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer">
              <option value="unpaid">Unpaid</option>
              {editFormData.status === 'pending' && (
                <option value="pending" disabled>Pending (backfilled — not manually settable)</option>
              )}
              {editFormData.status === 'pending_verification' && (
                <option value="pending_verification" disabled>Pending Verification (resident-submitted — not manually settable)</option>
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Due Date</label>
              <input type="date" name="due_date" value={editFormData.due_date} readOnly disabled
                title="Due date is set automatically and can't be edited here"
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-sm cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reference No.</label>
              <input type="text" name="reference_no" value={editFormData.reference_no} readOnly disabled placeholder="Ref Number"
                title="Reference number is set automatically and can't be edited here"
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-sm cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">View of Proof of Payment</label>
            {selectedPayment?.proof_url ? (
              <button type="button"
                onClick={() => { setProofReviewImage(selectedPayment.proof_url); setProofReviewZoomed(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                <Eye size={13} /> View Proof of Payment
              </button>
            ) : (
              <div className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-sm text-center cursor-not-allowed">
                No proof submitted
              </div>
            )}
          </div>
          {editFormData.status === 'paid' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Resident's Payment Ref # <span className="text-red-500">*required</span>
                </label>
                <input type="text" name="payer_reference_no" value={editFormData.payer_reference_no || ''} onChange={handleEditChange}
                  placeholder="GCash ref # or bank transfer #"
                  className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-800 placeholder-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/30 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Paid</label>
                <input type="date" name="paid_at" value={editFormData.paid_at || localToday()} readOnly disabled
                  title="Date paid is set automatically to today and can't be edited here"
                  className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl cursor-not-allowed" />
              </div>
            </>
          )}
        </div>
      </ModalOverlay>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CreditCard size={22} className="text-[#006837]" /> Monthly Dues Management
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage dues, issue bills, and track resident standing</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Due</span>
            <span className="text-sm font-black text-slate-800">₱{monthlyDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            <RequireRole userRole={currentUserRole} allowedRoles={['treasurer','president']}>
              <button onClick={() => { setEditDueValue(String(monthlyDue)); setIsEditDueOpen(true); }}
                title="Edit monthly due"
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#006837] cursor-pointer transition-all">
                <Edit2 size={13} />
              </button>
            </RequireRole>
          </div>
          <button onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-[#006837] rounded-xl transition-all cursor-pointer">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="GCash QR" className="w-6 h-6 rounded object-cover border border-slate-200" />
            ) : (
              <QrCode size={16} className="text-slate-400" />
            )}
            <span className="text-xs font-bold text-slate-600">Upload QR Code</span>
          </button>
          <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
            <button onClick={() => setShowSendConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all cursor-pointer">
              <Mail size={13} /> Send SOA to All
            </button>
          </RequireRole>
          {/* View toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
            <button onClick={() => setActiveView('transactions')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${activeView === 'transactions' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutList size={13} /> Transactions
            </button>
            <button onClick={() => setActiveView('paid')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${activeView === 'paid' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <CheckCircle2 size={13} /> Paid
            </button>
            <button onClick={() => setActiveView('standing')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${activeView === 'standing' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <TableProperties size={13} /> Standing Ledger
            </button>
          </div>
        </div>
      </div>

      {/* ── Edit Monthly Due modal (Treasurer/President only) ── */}
      <ModalOverlay
        title="Edit Monthly Due"
        subtitle="This changes the amount used for future dues generation — past invoices already issued are not affected."
        isOpen={isEditDueOpen}
        onClose={() => setIsEditDueOpen(false)}
        actionLabel={savingDue ? 'Saving…' : 'Save'}
        onAction={savingDue ? undefined : handleSaveMonthlyDue}>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1.5 block">New Monthly Due Amount (₱)</label>
          <input type="number" min="1" step="0.01" value={editDueValue} onChange={e => setEditDueValue(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837]"
            placeholder="150.00" />
          <p className="text-xs text-slate-400 mt-2">
            Current: ₱{monthlyDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. The breakdown (Security Guard,
            Electricity, Street Sweepers, Water) will be re-proportioned against the new amount for dues generated from now on.
          </p>
        </div>
      </ModalOverlay>

      {/* ── GCash QR Code modal — view for everyone, upload for Treasurer/President ── */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[10700] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsQrModalOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0">
                    <QrCode size={18} className="text-[#006837]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Upload QR Code</h2>
                    <p className="text-xs text-slate-400">Shown on every printed &amp; emailed Statement of Account</p>
                  </div>
                </div>
                <button onClick={() => setIsQrModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"><X size={16} /></button>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center justify-center mb-4 min-h-[180px]">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="GCash payment QR code" className="max-w-full max-h-52 rounded-xl object-contain" />
                ) : (
                  <div className="text-center text-slate-300">
                    <QrCode size={40} className="mx-auto mb-2" />
                    <p className="text-xs font-semibold">No QR code uploaded yet</p>
                  </div>
                )}
              </div>

              <RequireRole userRole={currentUserRole} allowedRoles={['treasurer','president']}>
                <label className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold cursor-pointer transition-all
                  ${uploadingQr ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#006837] hover:bg-[#004d29] text-white shadow-lg shadow-[#006837]/20'}`}>
                  <Upload size={15} />
                  {uploadingQr ? 'Uploading…' : qrCodeUrl ? 'Replace QR Code' : 'Upload QR Code'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingQr}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadQrCode(f); e.target.value = ''; }} />
                </label>
                <p className="text-[10px] text-slate-400 mt-2 text-center">PNG or JPG. Upload the screenshot of your QR code.</p>
              </RequireRole>
            </div>
          </div>
        </div>
      )}

      {/* ── Proof of payment review modal (Treasurer/President only) ── */}
      {proofReviewPayment && createPortal(
        <div className="fixed inset-0 z-[10500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setProofReviewPayment(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Review Proof of Payment</h2>
                  <p className="text-xs text-slate-400">
                    {residentsList.find(r => r.id === proofReviewPayment.user_id)?.full_name || 'Resident'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 mb-4">
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Due Period</span>
                  <span className="text-sm font-bold text-slate-800">
                    {proofReviewPayment.due_date ? new Date(proofReviewPayment.due_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Amount</span>
                  <span className="text-sm font-bold text-slate-800">
                    ₱{Number(proofReviewPayment.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Resident's Ref #</span>
                  <span className="text-sm font-bold text-slate-800">{proofReviewPayment.payer_reference_no || '—'}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Submitted</span>
                  <span className="text-sm font-bold text-slate-800">
                    {proofReviewPayment.submitted_at ? new Date(proofReviewPayment.submitted_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                  </span>
                </div>
                {proofReviewPayment.proof_url && (
                  <div className="p-3">
                    <button onClick={() => { setProofReviewImage(proofReviewPayment.proof_url); setProofReviewZoomed(false); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                      <Eye size={13} /> View Proof of Payment
                    </button>
                  </div>
                )}
              </div>

              <div className={`mb-4 p-3 rounded-2xl flex items-start gap-2.5 ${
                proofReviewPayment.proof_url ? 'bg-amber-50 border border-amber-100' : 'bg-red-50 border border-red-100'
              }`}>
                <AlertCircle size={16} className={`shrink-0 mt-0.5 ${proofReviewPayment.proof_url ? 'text-amber-500' : 'text-red-500'}`} />
                <p className={`text-xs font-semibold ${proofReviewPayment.proof_url ? 'text-amber-700' : 'text-red-700'}`}>
                  {proofReviewPayment.proof_url
                    ? 'Make sure to check the proof of payment — click "View Proof of Payment" above to open the image before approving.'
                    : 'No proof photo or reference number is on file for this due — there\'s nothing here to verify, so Approve is disabled.'}
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setProofReviewPayment(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => handleVerifyPayment(proofReviewPayment, 'reject')}
                  disabled={verifyingPaymentId === proofReviewPayment.id}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <XCircle size={15} /> Reject
                </button>
                <button
                  onClick={() => setIsApproveConfirmOpen(true)}
                  disabled={verifyingPaymentId === proofReviewPayment.id || !proofReviewPayment.proof_url}
                  title={!proofReviewPayment.proof_url ? 'No proof photo on file for this due — nothing to approve' : undefined}
                  className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle2 size={15} /> {verifyingPaymentId === proofReviewPayment.id ? 'Saving…' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── "Make sure it's finalized" confirmation, gated by a short countdown ── */}
      {isApproveConfirmOpen && proofReviewPayment && createPortal(
        <div className="fixed inset-0 z-[10550] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Confirm Approval</h3>
              <p className="text-sm text-slate-500 mb-6">
                Make sure it's finalized — once approved, this payment is marked <span className="font-bold text-slate-700">Paid</span> and can only be changed by editing or voiding the transaction afterward.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsApproveConfirmOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsApproveConfirmOpen(false);
                    handleVerifyPayment(proofReviewPayment, 'approve');
                  }}
                  disabled={approveCountdown > 0 || verifyingPaymentId === proofReviewPayment.id}
                  className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle2 size={15} /> {approveCountdown > 0 ? `Approve (${approveCountdown})` : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Proof of payment lightbox — stays in-app; image is click-to-zoom ──── */}
      {proofReviewImage && createPortal(
        <div className="fixed inset-0 z-[10600] flex items-center justify-center p-4"
          onClick={() => { setProofReviewImage(null); setProofReviewZoomed(false); }}>
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
          <div className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col transition-all duration-200
              ${proofReviewZoomed ? 'max-w-5xl max-h-[94vh]' : 'max-w-lg max-h-[85vh]'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-600" /> Proof of Payment
              </p>
              <div className="flex items-center gap-1.5">
                {!/\.pdf($|\?)/i.test(proofReviewImage) && (
                  <button onClick={() => setProofReviewZoomed(z => !z)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
                    title={proofReviewZoomed ? 'Zoom out' : 'Zoom in'}>
                    {proofReviewZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                  </button>
                )}
                <button onClick={() => { setProofReviewImage(null); setProofReviewZoomed(false); }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-4 flex items-center justify-center bg-slate-50 flex-1">
              {/\.pdf($|\?)/i.test(proofReviewImage)
                ? <iframe src={proofReviewImage} title="Proof of payment (PDF)" className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white" />
                : <img src={proofReviewImage} alt="Proof of payment" onClick={() => setProofReviewZoomed(z => !z)}
                    className={`rounded-lg object-contain transition-all duration-200 cursor-zoom-in
                      ${proofReviewZoomed ? 'max-w-none max-h-none w-auto cursor-zoom-out' : 'max-w-full max-h-[65vh]'}`} />}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Send SOA confirmation modal ── */}
      <SendSOAModal
        isOpen={showSendConfirm}
        viewMode={sendSOAViewMode}
        onViewModeChange={setSendSOAViewMode}
        sending={sendingSOA}
        result={sendSOAResult}
        onSend={handleSendAllSOA}
        onClose={() => { setShowSendConfirm(false); setSendSOAResult(null); }}
      />

      {/* ── Per-resident SOA print — content choice modal ── */}
      <SOAPrintModal
        target={soaPrintTarget}
        choice={soaPrintChoice}
        onChoiceChange={setSoaPrintChoice}
        monthlyDue={monthlyDue}
        qrCodeUrl={qrCodeUrl}
        onClose={() => setSoaPrintTarget(null)}
      />

      {/* ── KPI cards ── */}
      <div className="flex flex-wrap gap-4">
        <StatCard title="Total Collected"  value={`₱${totalCollected.toLocaleString()}`} icon={DollarSign}  iconColor="text-[#006837]" bgColor="bg-[#006837]/10" />
        <StatCard title="Pending Payments" value={pendingCount}                           icon={CreditCard}  iconColor="text-blue-600"  bgColor="bg-blue-50"       />
        <StatCard title="Overdue"          value={overdueCount}                           icon={AlertCircle} iconColor="text-red-600"   bgColor="bg-red-50"        />
        <StatCard title="Paid This Month"  value={paidCount}                              icon={CheckCircle2}iconColor="text-emerald-600"bgColor="bg-emerald-50"    />
      </div>

      {/* ── Standing Ledger view ── */}
      {activeView === 'standing' && (
        <StandingLedger residentsList={residentsList} payments={payments} monthlyDue={monthlyDue} />
      )}

      {/* ── Paid view — one row per resident who has at least one paid due ── */}
      {activeView === 'paid' && (
        <PaidTab residentsList={residentsList} payments={payments} monthlyDue={monthlyDue} />
      )}

      {/* ── Transactions view ── */}
      {activeView === 'transactions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px] flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Search payments…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
              </div>
              <ResidentFilterSelect
                value={residentFilter}
                onChange={setResidentFilter}
                options={residentsList.map(r => ({ value: r.id, label: r.full_name }))}
                className="w-40"
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer">
                <option value="All">All Status</option>
                <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                  <option value="PendingVerification">Pending Verification</option>
                </RequireRole>
                <option value="Pending">On Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Unpaid">Unpaid</option>
                <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                  <option value="Advance">Paid in Advance</option>
                </RequireRole>
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {advancePendingResidents.length > 0 && (
                <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                  <button
                    onClick={() => setProofReviewPayment(advancePendingResidents[0].pendingAdvanceVerification)}
                    className="relative flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold rounded-xl transition-all cursor-pointer">
                    <AlertCircle size={13} />
                    Advance Payment{advancePendingResidents.length !== 1 ? 's' : ''} to Verify
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-purple-600 text-white text-[10px] font-black rounded-full">
                      {advancePendingResidents.length}
                    </span>
                  </button>
                </RequireRole>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Name','Street','Unpaid Balance','Due Period','Status',''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {consolidatedPayments.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-300 text-sm">No residents found</td></tr>
                ) : paginatedPayments.map(r => {
                  const hasBalance = r.balance > 0;
                  return (
                    <tr key={r.user_id}
                      className={`hover:bg-slate-50/60 transition-colors ${hasBalance ? 'bg-red-50/30' : ''}`}>

                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${hasBalance ? 'bg-red-400' : 'bg-emerald-400'}`} />
                          <span className="text-sm font-bold text-slate-800">{r.full_name}</span>
                          {r.isDuplicate && <DuplicateBadge />}
                        </div>
                      </td>

                      {/* Street */}
                      <td className="px-5 py-4 text-sm text-slate-500 max-w-[180px] truncate">{r.street}</td>

                      {/* Unpaid Balance — ₱0.00 when settled */}
                      <td className="px-5 py-4">
                        {hasBalance ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-red-600">
                              ₱{r.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-red-400 font-semibold">
                              {r.months} month{r.months !== 1 ? 's' : ''} unpaid
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-emerald-600">₱0.00</span>
                            <span className="text-[10px] text-emerald-500 font-semibold">Settled</span>
                          </div>
                        )}
                      </td>

                      {/* Due Period */}
                      <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                        {hasBalance && r.oldest && r.newest
                          ? r.oldest === r.newest
                            ? new Date(r.oldest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                            : `${new Date(r.oldest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${new Date(r.newest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                          : '—'}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4">
                        {r.pendingVerification ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            Pending Verification
                          </span>
                        ) : hasBalance ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Unpaid Balance
                          </span>
                        ) : r.standing === 'Settled' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            No Record
                          </span>
                        )}
                      </td>

                      {/* Actions — Pay/Edit when balance exists, Statement always available */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const paidHistory = payments
                                .filter(p => p.user_id === r.user_id && (p.status || '').toLowerCase() === 'paid')
                                .sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0));
                              setSoaPrintChoice('outstanding');
                              setSoaPrintTarget({ resident: r, paidHistory });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[#006837] hover:text-[#006837] text-slate-500 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                            title="Print Statement of Account">
                            <Printer size={12} /> SOA
                          </button>
                          {r.pendingVerification && (
                            <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                              <button
                                onClick={() => setProofReviewPayment(r.pendingVerification)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap">
                                <Eye size={12} /> Review Proof
                              </button>
                            </RequireRole>
                          )}
                          <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                            <button
                              onClick={async () => {
                                let anchorList = r.unpaidList.length ? r.unpaidList : r.allPayments;
                                // Brand-new account with zero payment rows at all ("No Record") —
                                // generate Jan→current-month dues on the fly so there's something
                                // to review, instead of the button doing nothing.
                                if (r.standing === 'No Record') {
                                  anchorList = await backfillPastDuesForResident(r.user_id);
                                  fetchPayments();
                                }
                                setBreakdownPayments(anchorList.map(p => ({
                                  ...p,
                                  profiles: payments.find(x => x.id === p.id)?.profiles
                                    ?? residentsList.find(res => res.id === r.user_id) ?? null,
                                })));
                                setIsUnpaidBreakdownOpen(true);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                                hasBalance
                                  ? 'bg-[#006837] hover:bg-[#004d29] text-white'
                                  : 'bg-white border border-slate-200 hover:border-[#006837] hover:text-[#006837] text-slate-500'
                              }`}>
                              <Eye size={12} /> View Detail
                            </button>
                          </RequireRole>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {consolidatedPayments.length > 0 && (
            <>
              <PaginationBar page={transPage} totalPages={transTotalPages} setPage={setTransPage} total={consolidatedPayments.length} rowsPerPage={10} />
              <div className="px-5 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">{consolidatedPayments.length} resident{consolidatedPayments.length !== 1 ? 's' : ''}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Payment;