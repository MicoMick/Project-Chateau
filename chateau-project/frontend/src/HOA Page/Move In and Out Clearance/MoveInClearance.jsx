import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import {
  ClipboardList, Check, X, CheckCircle2, AlertCircle, RefreshCw, Search, Eye,
} from 'lucide-react';
import { StatusPill } from './moveInClearanceHelpers';
import ClearanceDetailModal from './ClearanceDetailModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Toast = ({ toast }) => {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border
      animate-in fade-in slide-in-from-top-4 duration-300
      ${toast.type === 'success'
        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
        : 'bg-red-50 border-red-100 text-red-800'}`}>
      {toast.type === 'success'
        ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        : <AlertCircle  size={16} className="text-red-500 shrink-0"     />}
      <p className="text-sm font-bold">{toast.message}</p>
    </div>
  );
};

// ─── Reject Notes Modal ───────────────────────────────────────────────────────
const RejectModal = ({ request, onClose, onConfirm, loading }) => {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <X size={22} className="text-red-500" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-1">Reject Clearance?</h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          This will notify the resident that their clearance was rejected.
          You may add a note explaining why.
        </p>
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Admin Notes <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Missing barangay clearance document…"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] resize-none transition-all"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 cursor-pointer disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onConfirm(notes)} disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-100 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><RefreshCw size={13} className="animate-spin" /> Rejecting…</> : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Clearance Row ────────────────────────────────────────────────────────────
// Compact — full detail lives in ClearanceDetailModal so it always has room
// to breathe instead of being crammed into an expanding accordion.
const ClearanceRow = ({ item, onView, onApprove, onReject, actionLoadingId }) => {
  const residentName = item.profiles?.full_name || 'Unknown Resident';
  const isMoveIn      = !!item.move_in_date;
  const typeLabel     = isMoveIn ? 'MOVE IN' : 'MOVE OUT';
  const isLoading     = actionLoadingId === item.id;
  const headerLabel   = `${residentName.toUpperCase()} — ${typeLabel} APPROVAL`;

  return (
    <div className={`border rounded-2xl bg-white shadow-sm transition-all duration-200
      ${item.status === 'approved' ? 'border-l-4 border-l-emerald-400 border-slate-100' :
        item.status === 'rejected' ? 'border-l-4 border-l-red-400 border-slate-100'    :
        'border-l-4 border-l-amber-400 border-slate-100'}`}>
      <div className="flex items-center gap-4 px-5 py-4 flex-wrap sm:flex-nowrap">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-[#006837]/10 text-[#006837] flex items-center justify-center font-black text-sm uppercase shrink-0">
          {residentName.charAt(0)}
        </div>

        {/* Label + meta */}
        <button onClick={() => onView(item)} className="flex-1 min-w-0 text-left cursor-pointer">
          <p className="text-sm font-black text-slate-900 truncate">{headerLabel}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full
              ${isMoveIn ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
              {typeLabel}
            </span>
            <span className="text-xs font-semibold text-slate-600 capitalize">
              {item.resident_type || 'Unknown type'}
            </span>
            <span className="text-xs text-slate-500">
              Submitted {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </button>

        {/* Status pill */}
        <StatusPill status={item.status} />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onView(item)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye size={15} />
          </button>
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => onReject(item)}
                disabled={isLoading}
                className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Reject"
              >
                <X size={15} />
              </button>
              <button
                onClick={() => onApprove(item)}
                disabled={isLoading}
                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Approve"
              >
                {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const MoveInClearance = () => {
  const [clearances,      setClearances]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [typeFilter,      setTypeFilter]      = useState('all');
  const [searchTerm,      setSearchTerm]      = useState('');
  const [toast,           setToast]           = useState({ show: false, message: '', type: 'success' });
  const [rejectTarget,    setRejectTarget]    = useState(null);
  const [viewingItem,     setViewingItem]     = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchClearances = async () => {
    setLoading(true);
    try {
      // Try with explicit FK hint first, fallback to simple join if it fails
      let { data, error } = await supabase
        .from('move_in_clearances')
        .select(`
          *,
          profiles!move_in_clearances_user_id_fkey (
            id, full_name, first_name, last_name, block, lot, street, email
          )
        `)
        .order('created_at', { ascending: false });

      // If FK hint fails, retry with simple join
      if (error || !data) {
        const retry = await supabase
          .from('move_in_clearances')
          .select(`*, profiles ( id, full_name, first_name, last_name, block, lot, street, email )`)
          .order('created_at', { ascending: false });
        data  = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      setClearances(data || []);
    } catch (e) {
      showToast('Failed to load clearances: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClearances(); }, []);

  // ── Auto-approve a resident's still-pending account when their Move In ───
  // clearance gets approved (mirrors the manual action in Account Approval /
  // Resident Management — saves the HOA an extra step).
  const autoApprovePendingAccount = async (profileId, residentName) => {
    if (!profileId) return;
    const { data: profile } = await supabase
      .from('profiles').select('account_status').eq('id', profileId).maybeSingle();
    if (profile?.account_status !== 'pending') return;

    const { error } = await supabase
      .from('profiles').update({ account_status: 'active' }).eq('id', profileId);
    if (error) return;

    await logAudit('APPROVE_ACCOUNT', `${residentName} — account auto-approved via Move In clearance approval`);
  };

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = async (item) => {
    setActionLoadingId(item.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Only set reviewed_by if the user's id exists in profiles (avoids FK 409)
      let reviewedBy = null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (prof) reviewedBy = user.id;
      }

      const { error } = await supabase
        .from('move_in_clearances')
        .update({
          status:      'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          admin_notes: null,
        })
        .eq('id', item.id);

      if (error) throw error;

      await logAudit(
        'APPROVE_CLEARANCE',
        `Approved ${item.move_in_date ? 'Move In' : 'Move Out'} clearance for: ${item.profiles?.full_name} (ID: ${item.id})`
      );

      // Move In approvals also auto-approve the resident's pending account
      if (item.move_in_date) {
        await autoApprovePendingAccount(item.profiles?.id, item.profiles?.full_name || 'Resident');
      }

      showToast(`Clearance approved for ${item.profiles?.full_name || 'resident'}.`);
      fetchClearances();
    } catch (e) {
      showToast('Failed to approve: ' + e.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Reject ───────────────────────────────────────────────────────────────
  const handleRejectConfirm = async (notes) => {
    if (!rejectTarget) return;
    setActionLoadingId(rejectTarget.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Only set reviewed_by if the user's id exists in profiles (avoids FK 409)
      let reviewedBy = null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (prof) reviewedBy = user.id;
      }

      const { error } = await supabase
        .from('move_in_clearances')
        .update({
          status:      'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          admin_notes: notes || null,
        })
        .eq('id', rejectTarget.id);

      if (error) throw error;

      await logAudit(
        'REJECT_CLEARANCE',
        `Rejected ${rejectTarget.move_in_date ? 'Move In' : 'Move Out'} clearance for: ${rejectTarget.profiles?.full_name} (ID: ${rejectTarget.id})`,
        'warning'
      );

      showToast(`Clearance rejected for ${rejectTarget.profiles?.full_name || 'resident'}.`);
      setRejectTarget(null);
      fetchClearances();
    } catch (e) {
      showToast('Failed to reject: ' + e.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Counts ────────────────────────────────────────────────────────────────
  const pendingCount  = clearances.filter(c => c.status === 'pending').length;
  const approvedCount = clearances.filter(c => c.status === 'approved').length;
  const rejectedCount = clearances.filter(c => c.status === 'rejected').length;

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = clearances.filter(c => {
    const name         = c.profiles?.full_name || '';
    const matchSearch  = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus  = statusFilter === 'all' || c.status === statusFilter;
    const matchType    = typeFilter === 'all' ||
      (typeFilter === 'move_in'  &&  c.move_in_date) ||
      (typeFilter === 'move_out' && !c.move_in_date);
    return matchSearch && matchStatus && matchType;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">
      <Toast toast={toast} />

      {/* View details modal */}
      <ClearanceDetailModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onApprove={(item) => { setViewingItem(null); handleApprove(item); }}
        onReject={(item) => { setViewingItem(null); setRejectTarget(item); }}
        actionLoading={actionLoadingId === viewingItem?.id}
      />

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
          loading={actionLoadingId === rejectTarget.id}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardList size={22} className="text-[#006837]" />
            Move In / Move Out Clearances
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review and approve CREVHAI clearance requests from residents
          </p>
        </div>
        <button onClick={fetchClearances} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending',  value: pendingCount,  color: 'text-amber-600',   bg: 'bg-amber-50',   dot: 'bg-amber-400'   },
          { label: 'Approved', value: approvedCount, color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-400' },
          { label: 'Rejected', value: rejectedCount, color: 'text-red-500',     bg: 'bg-red-50',     dot: 'bg-red-400'     },
        ].map(k => (
          <div key={k.label}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
                <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}>
                <span className={`w-3 h-3 rounded-full ${k.dot}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search resident name…"
            className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all shadow-sm" />
        </div>

        {/* Type filter */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
          {[
            { val: 'all',       label: 'All'       },
            { val: 'move_in',   label: 'Move In'   },
            { val: 'move_out',  label: 'Move Out'  },
          ].map(f => (
            <button key={f.val} onClick={() => setTypeFilter(f.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                ${typeFilter === f.val ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
          {['all','pending','approved','rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize whitespace-nowrap
                ${statusFilter === s ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 font-medium ml-auto">
          {filtered.length} clearance{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Row List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium animate-pulse">Loading clearances…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-16 text-slate-300">
          <ClipboardList size={40} className="mb-3" />
          <p className="text-sm font-semibold text-slate-500">
            {searchTerm ? 'No clearances match your search' : `No ${statusFilter === 'all' ? '' : statusFilter} clearances`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <ClearanceRow
              key={item.id}
              item={item}
              onView={setViewingItem}
              onApprove={handleApprove}
              onReject={(item) => setRejectTarget(item)}
              actionLoadingId={actionLoadingId}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-500 text-center pb-4">
          Showing {filtered.length} of {clearances.length} clearance requests
        </p>
      )}
    </div>
  );
};

export default MoveInClearance;
