import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import {
  ShieldCheck, Check, X, AlertTriangle, CheckCircle2,
  AlertCircle, RefreshCw, Clock, Filter, Search,
  CreditCard, User, Eye,
} from 'lucide-react';
import { actionIcon, actionColor, tableColor } from './pendingApprovalHelpers';
import RequestDetailModal from './RequestDetailModal';

// ─── Pagination hook ─────────────────────────────────────────────────────────
const usePagination = (items, rowsPerPage = 10) => {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
  // Reset to page 1 whenever the list changes (filter/search)
  React.useEffect(() => { setPage(1); }, [items.length]);
  const paginated = items.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  return { paginated, page, setPage, totalPages, total: items.length };
};

// ─── Pagination bar ───────────────────────────────────────────────────────────
const PaginationBar = ({ page, totalPages, setPage, total, rowsPerPage }) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * rowsPerPage + 1;
  const to   = Math.min(page * rowsPerPage, total);
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }
  return (
    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-slate-400 font-medium">
        Showing <span className="font-bold text-slate-600">{from}–{to}</span> of <span className="font-bold text-slate-600">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm font-bold transition-all">‹</button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={i} className="w-8 h-8 flex items-center justify-center text-slate-300 text-sm">…</span>
            : <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer
                  ${page === p ? 'bg-[#006837] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
        )}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm font-bold transition-all">›</button>
      </div>
    </div>
  );
};


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
        ? <CheckCircle2 size={16} className="text-emerald-500" />
        : <AlertCircle  size={16} className="text-red-500"     />}
      <p className="text-sm font-bold">{toast.message}</p>
    </div>
  );
};

// actionIcon, actionColor, tableColor moved to ./pendingApprovalHelpers —
// shared with the extracted RequestDetailModal so both agree on how an
// action type / target table is labeled and colored.

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

const ConfirmDialog = ({ data, onConfirm, onCancel, loading }) => {
  if (!data) return null;
  const isApprove = data.action === 'approve';
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4
          ${isApprove ? 'bg-emerald-50' : 'bg-red-50'}`}>
          {isApprove
            ? <Check size={22} className="text-emerald-600" />
            : <X     size={22} className="text-red-500"     />}
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2">
          {isApprove ? 'Approve Request?' : 'Reject Request?'}
        </h3>
        <p className="text-sm text-slate-500 mb-2 leading-relaxed">
          {isApprove
            ? 'This will execute the action immediately and cannot be undone.'
            : 'The request will be marked as rejected and no action will be taken.'}
        </p>
        {data.request && (
          <div className="p-3 bg-slate-50 rounded-xl mb-6 text-xs text-slate-600 space-y-1">
            <p><span className="font-bold">Type:</span> {data.request.action_type} on {data.request.target_table}</p>
            {data.request.requested_data?.reference_no && (
              <p><span className="font-bold">Ref:</span> {data.request.requested_data.reference_no}</p>
            )}
            {data.request.requested_data?.amount && (
              <p><span className="font-bold">Amount:</span> ₱{Number(data.request.requested_data.amount).toLocaleString()}</p>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 cursor-pointer disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-3 rounded-2xl text-white font-bold text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2
              ${isApprove
                ? 'bg-[#006837] hover:bg-[#004d29] shadow-lg shadow-[#006837]/20'
                : 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100'}`}>
            {loading
              ? <><RefreshCw size={13} className="animate-spin" /> Processing…</>
              : isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PendingApproval = () => {
  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [actionLoading,setActionLoading]= useState(false);
  const [confirmData,  setConfirmData]  = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [toast,        setToast]        = useState({ show: false, message: '', type: 'success' });
  const [searchTerm,   setSearchTerm]   = useState('');
  const [typeFilter,   setTypeFilter]   = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('approval_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'ALL') q = q.eq('status', statusFilter);

      const { data, error } = await q;
      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      showToast('Failed to load requests: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [statusFilter]);

  // ── Approve ────────────────────────────────────────────────────────────────
  const executeApprove = async () => {
    const request = confirmData?.request;
    if (!request) return;
    setActionLoading(true);
    try {
      if (request.target_table === 'payments' && request.action_type === 'DELETE') {
        // Void a payment — delete the row
        const { error: delErr } = await supabase
          .from('payments')
          .delete()
          .eq('id', request.target_id);
        if (delErr) throw delErr;

      } else if (request.action_type === 'UPDATE' && request.requested_data) {
        // Generic UPDATE — applies to profiles (profile edits) and payments
        // (e.g. a Treasurer's "historical settlement" request, marking a
        // pre-app due paid once the President confirms it). `details` is a
        // display-only field for this review table (see the Details column
        // below) — it isn't a real column on either table, so it must never
        // be sent in the actual update or Postgrest rejects the whole request.
        const { details, ...updateFields } = request.requested_data;
        const { error: upErr } = await supabase
          .from(request.target_table)
          .update(updateFields)
          .eq('id', request.target_id);
        if (upErr) throw upErr;

        // Marking a payment 'paid' here (historical settlement) bypasses the
        // normal Edit Transaction flow, which also auto-reactivates a
        // delinquent resident once their last unpaid due is cleared — so
        // mirror that here too, or a resident could stay wrongly flagged
        // delinquent even after every due is settled.
        if (request.target_table === 'payments' && updateFields.status === 'paid') {
          const { data: paymentRow } = await supabase
            .from('payments').select('user_id').eq('id', request.target_id).single();
          if (paymentRow?.user_id) {
            const { data: residentData } = await supabase
              .from('profiles').select('id, full_name, account_status').eq('id', paymentRow.user_id).single();
            if (residentData?.account_status === 'delinquent') {
              const { data: remainingUnpaid } = await supabase
                .from('payments').select('id')
                .eq('user_id', paymentRow.user_id)
                .in('status', ['unpaid', 'overdue', 'pending', 'pending_verification'])
                .neq('id', request.target_id)
                .limit(1);
              if (!remainingUnpaid?.length) {
                await supabase.from('profiles').update({ account_status: 'active' }).eq('id', paymentRow.user_id);
                await logAudit('AUTO_REACTIVATE', `${residentData.full_name} auto-reactivated — all dues are now settled.`);
              }
            }
          }
        }

      } else if (request.action_type === 'DELETE') {
        // Generic delete on any table
        const { error: delErr } = await supabase
          .from(request.target_table)
          .delete()
          .eq('id', request.target_id);
        if (delErr) throw delErr;
      }

      // Mark as APPROVED
      const { error: markErr } = await supabase
        .from('approval_requests')
        .update({ status: 'APPROVED' })
        .eq('id', request.id);
      if (markErr) throw markErr;

      await logAudit(
        'APPROVE_REQUEST',
        `President approved ${request.action_type} request ID: ${request.id} on ${request.target_table}`
      );
      showToast('Request approved and action executed.');
      setConfirmData(null);
      fetchRequests();
    } catch (e) {
      showToast('Failed to approve: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject ─────────────────────────────────────────────────────────────────
  const executeReject = async () => {
    const request = confirmData?.request;
    if (!request) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('approval_requests')
        .update({ status: 'REJECTED' })
        .eq('id', request.id);
      if (error) throw error;

      await logAudit(
        'REJECT_REQUEST',
        `President rejected ${request.action_type} request ID: ${request.id}`,
        'warning'
      );
      showToast('Request rejected.');
      setConfirmData(null);
      fetchRequests();
    } catch (e) {
      showToast('Failed to reject: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Counts ─────────────────────────────────────────────────────────────────
  const pendingCount  = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length;

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = requests.filter(r => {
    const matchSearch = !searchTerm ||
      (r.target_table  || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.action_type   || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.target_id     || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(r.requested_data || {}).toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'ALL' || r.action_type === typeFilter;
    return matchSearch && matchType;
  });
  const { paginated: paginatedPending, page: pendPage, setPage: setPendPage, totalPages: pendTotalPages, total: filteredTotal } = usePagination(filtered, 10);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">
      <Toast toast={toast} />

      <ConfirmDialog
        data={confirmData}
        onConfirm={confirmData?.action === 'approve' ? executeApprove : executeReject}
        onCancel={() => setConfirmData(null)}
        loading={actionLoading}
      />

      <RequestDetailModal
        request={viewingRequest}
        onClose={() => setViewingRequest(null)}
        onApprove={(req) => { setViewingRequest(null); setConfirmData({ action: 'approve', request: req }); }}
        onReject={(req) => { setViewingRequest(null); setConfirmData({ action: 'reject', request: req }); }}
      />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck size={22} className="text-[#006837]" />
            Pending Approvals
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Review and action all requests submitted by other admins
          </p>
        </div>
        <button onClick={fetchRequests} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer disabled:opacity-50">
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k.label}</p>
                <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}>
                <span className={`w-3 h-3 rounded-full ${k.dot}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          {/* Status tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
            {['ALL','PENDING','APPROVED','REJECTED'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                  ${statusFilter === s ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Action type filter */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer">
            <option value="ALL">All Types</option>
            <option value="DELETE">DELETE</option>
            <option value="UPDATE">UPDATE</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search table, type, ref…"
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium animate-pulse">Loading requests…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <Clock size={36} className="mb-2" />
              <p className="text-sm font-semibold text-slate-400">
                {searchTerm ? 'No requests match your search' : `No ${statusFilter.toLowerCase()} requests`}
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Action','Table','Details','Requested','Status',''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedPending.map(req => {
                  const isPending = req.status === 'PENDING';
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">

                      {/* Action type */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${actionColor(req.action_type)}`}>
                          {actionIcon(req.action_type)}
                          {req.action_type}
                        </span>
                      </td>

                      {/* Target table */}
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg capitalize ${tableColor(req.target_table)}`}>
                          {req.target_table || '—'}
                        </span>
                      </td>

                      {/* Request details */}
                      <td className="px-5 py-4 max-w-[280px]">
                        {req.requested_data ? (
                          <div className="space-y-1">
                            {req.requested_data.reference_no && (
                              <p className="text-sm font-bold text-slate-800 truncate">
                                Ref: {req.requested_data.reference_no}
                              </p>
                            )}
                            {req.requested_data.amount && (
                              <p className="text-sm font-semibold text-slate-600">
                                ₱{Number(req.requested_data.amount).toLocaleString()}
                              </p>
                            )}
                            {req.requested_data.details && (
                              <p className="text-sm text-slate-600 truncate" title={req.requested_data.details}>{req.requested_data.details}</p>
                            )}
                            {!req.requested_data.reference_no && !req.requested_data.amount && (
                              <p className="text-sm text-slate-500 truncate font-mono">{req.target_id?.slice(0, 16)}…</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm font-mono text-slate-500">{req.target_id?.slice(0, 20)}…</p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>

                      {/* Status pill */}
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                          ${req.status === 'PENDING'  ? 'bg-amber-50 text-amber-700 border-amber-100'   :
                            req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        'bg-red-50 text-red-600 border-red-100'}`}>
                          {req.status}
                        </span>
                      </td>

                      {/* Actions — View is always available; Approve/Reject only for PENDING */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setViewingRequest(req)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          {isPending && (
                            <>
                              <button
                                onClick={() => setConfirmData({ action: 'reject', request: req })}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors cursor-pointer"
                                title="Reject"
                              >
                                <X size={15} />
                              </button>
                              <button
                                onClick={() => setConfirmData({ action: 'approve', request: req })}
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors cursor-pointer"
                                title="Approve"
                              >
                                <Check size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <>
            <PaginationBar page={pendPage} totalPages={pendTotalPages} setPage={setPendPage} total={filtered.length} rowsPerPage={10} />
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                {filtered.length} request{filtered.length !== 1 ? 's' : ''}
                {statusFilter !== 'ALL' ? ` • ${statusFilter}` : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PendingApproval;
