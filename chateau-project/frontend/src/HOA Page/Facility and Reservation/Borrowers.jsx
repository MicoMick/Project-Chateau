import React, { useState } from 'react';
import {
  Search, Package, Clock, CheckCircle2, ShieldCheck,
  AlertTriangle, X, Wrench, Loader2, XCircle, Camera, ZoomIn, ZoomOut,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import BorrowersDetailModal from './BorrowersDetailModal';

// ─── Pagination ───────────────────────────────────────────────────────────────
const usePagination = (items, rowsPerPage = 10) => {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { setPage(1); }, [items.length]);
  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
  const paginated  = items.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  return { paginated, page, setPage, totalPages, total: items.length };
};

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
                  ${page === p ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
        )}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm font-bold transition-all">›</button>
      </div>
    </div>
  );
};

// ─── Formatters ───────────────────────────────────────────────────────────────
export const fmtDate = (d) => {
  if (!d) return 'N/A';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:          { label: 'Pending',          dot: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 border-amber-200'      },
  approved:         { label: 'Approved',         dot: 'bg-[#006837]',   pill: 'bg-emerald-50 text-[#006837] border-emerald-200'  },
  'approved and paid':{ label: 'Approved & Paid',dot: 'bg-teal-500',    pill: 'bg-teal-50 text-teal-700 border-teal-200'         },
  'return pending': { label: 'Return Pending',   dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200'         },
  completed:        { label: 'Completed',        dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200'         },
  rejected:         { label: 'Rejected',         dot: 'bg-red-500',     pill: 'bg-red-50 text-red-600 border-red-200'            },
  cancelled:        { label: 'Cancelled',        dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-500 border-slate-200'     },
};
const getStatus = (s) => STATUS[(s || '').toLowerCase()] || { label: s || '—', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-500 border-slate-200' };

export const StatusPill = ({ status }) => {
  const st = getStatus(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide ${st.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  );
};

// ─── KPI Card — mirrors the Facility Reservations stat cards so the two
// tables read as one system even though Borrowers keeps its own stats. ──────
const KpiCard = ({ label, value, icon: Icon, color, bg }) => (
  <div className="w-full text-left p-5 rounded-2xl border-2 bg-white border-slate-100">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">{label}</p>
        <p className="text-3xl font-black text-slate-800">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
        <Icon size={18} className={color} />
      </div>
    </div>
  </div>
);

// ─── Condition badge — shown once a return has been verified ────────────────
export const ConditionBadge = ({ r }) => {
  if (!r.returned_at && !r.return_condition) return <span className="text-xs text-slate-300">—</span>;
  const missing = r.return_missing_qty || 0;
  const damaged = r.return_condition === 'Damaged';
  if (!damaged && missing === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide bg-emerald-50 text-emerald-700 border-emerald-200">
        <ShieldCheck size={10} /> Verified Good
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1 items-start">
      {damaged && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide bg-red-50 text-red-600 border-red-200">
          <Wrench size={10} /> Damaged
        </span>
      )}
      {missing > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-200">
          <AlertTriangle size={10} /> {missing} missing
        </span>
      )}
    </div>
  );
};

/**
 * Borrowers — the dedicated table for reservations tied to an Amenity Item
 * (borrowed, not rented — e.g. Chairs, Tents). Kept separate from the
 * Facility Reservations table in Reservation.jsx since items never go
 * through the cash-payment confirmation step facilities do.
 *
 * Returning an item goes through a short verification step first — the
 * officer confirms the item came back fixed/undamaged and that nothing is
 * missing before it's restocked, instead of blindly trusting "returned".
 *
 * Props:
 *  - reservations: array (already fetched + joined with facilities + profiles in Reservation.jsx)
 *  - search, setSearch: lifted search state
 *  - tab, setTab: 'current' | 'history' | 'declined'
 *  - returning, setReturning: id of the row currently being marked returned
 *  - currentUserRole: role string for gating the "Mark Returned" action
 *  - onRefresh: refetch callback after a status change
 */
const Borrowers = ({ reservations, search, setSearch, tab, setTab, returning, setReturning, currentUserRole, onRefresh, updateStatus }) => {
  const [verifyTarget,     setVerifyTarget]     = useState(null); // reservation currently being verified
  const [verifyCondition,  setVerifyCondition]  = useState('Good'); // 'Good' | 'Damaged'
  const [verifyMissingQty, setVerifyMissingQty] = useState(0);
  const [verifyNotes,      setVerifyNotes]      = useState('');
  const [verifyPhotoFile,  setVerifyPhotoFile]  = useState(null); // optional — staff-attached return photo
  const [photoPreview,     setPhotoPreview]     = useState(null); // borrow_condition_photo_url shown in lightbox
  const [photoZoomed,      setPhotoZoomed]      = useState(false);
  const [selectedRow,      setSelectedRow]      = useState(null); // reservation shown in the row detail modal

  const amenityItems    = reservations.filter(r => r.facilities?.category === 'Amenity Item');
  const pendingItems    = amenityItems.filter(r => r.status === 'Pending');
  const currentBorrowed = amenityItems.filter(r => r.status === 'Approved');
  const pendingReturns  = amenityItems.filter(r => r.status === 'Return Pending');
  const history         = amenityItems.filter(r => r.status === 'Completed');
  const declined        = amenityItems.filter(r => ['Rejected', 'Cancelled'].includes(r.status));

  const term    = search.toLowerCase();
  const filterR = (r) =>
    (r.profiles?.full_name || '').toLowerCase().includes(term) ||
    (r.facilities?.name    || '').toLowerCase().includes(term);

  const listByTab = {
    pending: pendingItems, current: currentBorrowed, pendingReturn: pendingReturns,
    history, declined,
  };
  const list = (listByTab[tab] || pendingItems).filter(filterR);
  const { paginated, page, setPage, totalPages, total } = usePagination(list, 10);

  // Pre-fill from the resident's own return report when there is one (they
  // already told us the condition/missing count/notes) — the admin's job
  // here is to confirm or correct it, not start from a blank form.
  const openVerify = (res) => {
    setVerifyTarget(res);
    setVerifyCondition(res.return_condition || 'Good');
    setVerifyMissingQty(res.return_missing_qty || 0);
    setVerifyNotes(res.return_notes || '');
    setVerifyPhotoFile(null);
  };

  // ── Confirm the return — only units that are both accounted for AND in
  // good condition go back into available stock. Damaged units still count
  // as "returned" (they're physically back) but aren't usable, so they're
  // excluded from the restock the same way missing units are.
  const submitVerifiedReturn = async () => {
    const res = verifyTarget;
    if (!res) return;
    const borrowedQty = res.quantity || 1;
    const missingQty  = Math.min(Math.max(0, Number(verifyMissingQty) || 0), borrowedQty);
    const usableQty    = verifyCondition === 'Good' ? Math.max(0, borrowedQty - missingQty) : 0;

    setReturning(res.id);
    try {
      let returnPhotoUrl = null;
      if (verifyPhotoFile) {
        const ext = verifyPhotoFile.name.split('.').pop() || 'jpg';
        const path = `${res.user_id}/reservations/return-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('borrow-condition-photos').upload(path, verifyPhotoFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('borrow-condition-photos').getPublicUrl(path);
        returnPhotoUrl = publicUrl;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('reservations').update({
        status: 'Completed',
        return_condition:   verifyCondition,
        return_missing_qty: missingQty,
        return_notes:        verifyNotes.trim() || null,
        returned_at:          new Date().toISOString(),
        verified_by:          user?.id || null,
        ...(returnPhotoUrl ? { return_condition_photo_url: returnPhotoUrl } : {}),
      }).eq('id', res.id);
      if (error) throw error;

      const currentAmount = res.facilities?.amount ?? 0;
      const newAmount = currentAmount + usableQty;
      await supabase.from('facilities').update({
        amount: newAmount,
        status: newAmount > 0 ? 'Available' : 'Not Available',
      }).eq('id', res.facility_id);

      const flags = [
        verifyCondition === 'Damaged' ? 'damaged' : 'good condition',
        missingQty > 0 ? `${missingQty} unit(s) missing` : 'nothing missing',
      ].join(', ');
      logAudit('BORROWED_ITEM_RETURNED',
        `Verified return of ${res.facilities?.name} from ${res.profiles?.full_name} — ${flags}. ${usableQty} unit(s) restocked.`);
      setVerifyTarget(null);
      onRefresh();
    } catch (e) { alert('Failed: ' + e.message); }
    finally { setReturning(null); }
  };

  const allowedToReturn = ['president','vice_president','secretary','treasurer','super_admin'];

  return (
    <div className="space-y-4">
      {/* Stat cards — item borrowing stats, separate from Facility Reservations */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Items"        value={amenityItems.length}       icon={Package}       color="text-slate-600" bg="bg-slate-100" />
        <KpiCard label="Pending Requests"   value={pendingItems.length}       icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50" />
        <KpiCard label="Currently Borrowed" value={currentBorrowed.length}    icon={Clock}        color="text-amber-600" bg="bg-amber-50"  />
        <KpiCard label="Pending Returns"    value={pendingReturns.length}     icon={ShieldCheck}  color="text-blue-600"  bg="bg-blue-50"   />
        <KpiCard label="Returned"           value={history.length}            icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" />
        <KpiCard label="Rejected/Cancelled" value={declined.length}           icon={XCircle}      color="text-red-500"   bg="bg-red-50"    />
      </div>

      {/* Sub-tab + search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
          <button onClick={() => setTab('pending')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${tab === 'pending' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <AlertTriangle size={12} /> Pending ({pendingItems.length})
          </button>
          <button onClick={() => setTab('current')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${tab === 'current' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Clock size={12} /> Currently Borrowed ({currentBorrowed.length})
          </button>
          <button onClick={() => setTab('pendingReturn')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${tab === 'pendingReturn' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <ShieldCheck size={12} /> Pending Returns ({pendingReturns.length})
          </button>
          <button onClick={() => setTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${tab === 'history' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <CheckCircle2 size={12} /> Return History ({history.length})
          </button>
          <button onClick={() => setTab('declined')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
              ${tab === 'declined' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <XCircle size={12} /> Rejected/Cancelled ({declined.length})
          </button>
        </div>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search resident or item…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#006837]/20 w-56" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{[
              'Resident', 'Item', 'Qty', 'Requested On', 'Borrow Date',
              ...(['current', 'pendingReturn', 'history'].includes(tab) ? ['Date Returned'] : []),
              'Status',
              ...(['pending', 'current', 'pendingReturn'].includes(tab) ? ['Action'] : tab === 'history' ? ['Condition'] : []),
            ].map(h => (
              <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginated.length === 0 ? (
              <tr><td colSpan={tab === 'pending' ? 7 : tab === 'declined' ? 6 : 8} className="py-16 text-center">
                <Package size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-sm font-bold text-slate-400">
                  {tab === 'pending' ? 'No pending requests' : tab === 'current' ? 'No items currently borrowed' : tab === 'pendingReturn' ? 'No returns awaiting verification' : tab === 'history' ? 'No return history yet' : 'No rejected or cancelled requests'}
                </p>
              </td></tr>
            ) : paginated.map(r => (
              <tr key={r.id} onClick={() => setSelectedRow(r)}
                className="hover:bg-slate-50/80 transition-colors cursor-pointer group">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-black uppercase shrink-0">
                      {r.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{r.profiles?.full_name || '—'}</p>
                      <p className="text-[10px] text-slate-400">{r.profiles?.email || ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{r.facilities?.name || '—'}</span>
                    {r.borrow_condition_photo_url && (
                      <button onClick={() => { setPhotoPreview(r.borrow_condition_photo_url); setPhotoZoomed(false); }}
                        title="View condition photo submitted at borrow time"
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 cursor-pointer transition-all">
                        <Camera size={12} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 text-center">{r.quantity || '—'}</td>
                <td className="px-5 py-4 text-sm text-slate-400 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                {['current', 'pendingReturn', 'history'].includes(tab) && (
                  <td className="px-5 py-4 whitespace-nowrap">
                    {r.status === 'Completed'
                      ? <span className="flex items-center gap-1 text-sm text-emerald-600 font-semibold"><CheckCircle2 size={12} /> {fmtDate(r.returned_at)}</span>
                      : r.status === 'Return Pending'
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border uppercase tracking-wide bg-blue-50 text-blue-700 border-blue-200"><ShieldCheck size={10} /> Reported {fmtDate(r.returned_at)}</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border uppercase tracking-wide bg-amber-50 text-amber-700 border-amber-200"><Clock size={10} /> Not Returned Yet</span>}
                  </td>
                )}
                <td className="px-5 py-4">
                  <StatusPill status={r.status} />
                </td>
                {tab === 'pending' ? (
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    {allowedToReturn.includes(currentUserRole) && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateStatus(r.id, 'Approved')}
                          disabled={(r.facilities?.amount ?? 0) < (r.quantity || 1)}
                          title={(r.facilities?.amount ?? 0) < (r.quantity || 1) ? 'Not enough stock to approve' : 'Approve'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                          <CheckCircle2 size={12} /> Approve
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, 'Rejected')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap">
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                ) : tab === 'current' || tab === 'pendingReturn' ? (
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    {allowedToReturn.includes(currentUserRole) && (
                      <button onClick={() => openVerify(r)} disabled={returning === r.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 whitespace-nowrap">
                        {returning === r.id
                          ? <><span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" /> Saving…</>
                          : <><ShieldCheck size={12} /> {tab === 'pendingReturn' ? 'Confirm Return' : 'Verify Return'}</>}
                      </button>
                    )}
                  </td>
                ) : tab === 'history' ? (
                  <td className="px-5 py-4"><ConditionBadge r={r} /></td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} setPage={setPage} total={total} rowsPerPage={10} />
      </div>

      {/* ── Row detail modal ────────────────────────────────────────────────── */}
      <BorrowersDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        canManage={allowedToReturn.includes(currentUserRole)}
        onApprove={() => { updateStatus(selectedRow.id, 'Approved'); setSelectedRow(null); }}
        onReject={() => { updateStatus(selectedRow.id, 'Rejected'); setSelectedRow(null); }}
        onVerifyReturn={() => { openVerify(selectedRow); setSelectedRow(null); }}
        onViewPhoto={url => { setPhotoPreview(url); setPhotoZoomed(false); }}
      />

      {/* ── Verify Return modal ─────────────────────────────────────────────── */}
      {verifyTarget && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !returning && setVerifyTarget(null)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">{verifyTarget.status === 'Return Pending' ? 'Confirm Return' : 'Verify Return'}</h2>
                  <p className="text-xs text-slate-400">{verifyTarget.facilities?.name} · {verifyTarget.profiles?.full_name}</p>
                </div>
              </div>
              <button onClick={() => !returning && setVerifyTarget(null)} className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {verifyTarget.status === 'Return Pending' && (
                <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <ShieldCheck size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 font-semibold">
                    The resident already reported this return — the fields below are pre-filled from what they submitted. Review and confirm, or correct anything before saving.
                  </p>
                </div>
              )}

              {verifyTarget.return_condition_photo_url && (
                <button onClick={() => { setPhotoPreview(verifyTarget.return_condition_photo_url); setPhotoZoomed(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-blue-200 hover:border-blue-400 text-blue-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                  <Camera size={13} /> View Resident's Return Photo
                </button>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Units Borrowed</span>
                <span className="text-sm font-bold text-slate-800">{verifyTarget.quantity || 1} unit(s)</span>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Is the item fixed / undamaged?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setVerifyCondition('Good')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border-2 transition-all cursor-pointer
                      ${verifyCondition === 'Good' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <ShieldCheck size={16} /> Good
                  </button>
                  <button onClick={() => setVerifyCondition('Damaged')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border-2 transition-all cursor-pointer
                      ${verifyCondition === 'Damaged' ? 'bg-red-50 border-red-400 text-red-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <Wrench size={16} /> Damaged
                  </button>
                </div>
              </div>

              {/* Missing units */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Missing units (not returned)
                </label>
                <input type="number" min="0" max={verifyTarget.quantity || 1} value={verifyMissingQty}
                  onChange={e => setVerifyMissingQty(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all" />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Out of {verifyTarget.quantity || 1} unit(s) borrowed. Missing or damaged units won't be added back to available stock.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes (optional)</label>
                <textarea rows={2} value={verifyNotes} onChange={e => setVerifyNotes(e.target.value)}
                  placeholder="e.g. one chair leg bent, tent pole missing…"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all placeholder-slate-400" />
              </div>

              {/* Staff-attached return photo — optional, for when the
                  resident didn't submit one themselves (or as a second one) */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  {verifyTarget.return_condition_photo_url ? "Replace Resident's Photo (optional)" : 'Return Photo (optional)'}
                </label>
                <label className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm cursor-pointer hover:border-blue-300 transition-all">
                  <Camera size={16} className={verifyPhotoFile ? 'text-blue-600' : 'text-slate-400'} />
                  <span className={`flex-1 truncate ${verifyPhotoFile ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                    {verifyPhotoFile ? verifyPhotoFile.name : 'Attach a photo of the item as returned'}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => setVerifyPhotoFile(e.target.files[0] || null)} />
                </label>
              </div>

              {(verifyCondition === 'Damaged' || Number(verifyMissingQty) > 0) && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-semibold">
                    This return will be flagged for follow-up with the borrower and won't fully restock the item.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setVerifyTarget(null)} disabled={returning === verifyTarget.id}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer transition-all disabled:opacity-50">
                Cancel
              </button>
              <button onClick={submitVerifiedReturn} disabled={returning === verifyTarget.id}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50">
                {returning === verifyTarget.id
                  ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                  : <><CheckCircle2 size={15} /> Confirm Return</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Condition photo lightbox ────────────────────────────────────────── */}
      {photoPreview && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4"
          onClick={() => { setPhotoPreview(null); setPhotoZoomed(false); }}>
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
          <div className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col transition-all duration-200
              ${photoZoomed ? 'max-w-5xl max-h-[94vh]' : 'max-w-lg max-h-[85vh]'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <Camera size={14} className="text-blue-600" /> Condition Photo
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPhotoZoomed(z => !z)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
                  title={photoZoomed ? 'Zoom out' : 'Zoom in'}>
                  {photoZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                </button>
                <button onClick={() => { setPhotoPreview(null); setPhotoZoomed(false); }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-4 flex items-center justify-center bg-slate-50 flex-1">
              <img src={photoPreview} alt="Item condition" onClick={() => setPhotoZoomed(z => !z)}
                className={`rounded-lg object-contain transition-all duration-200 cursor-zoom-in
                  ${photoZoomed ? 'max-w-none max-h-none w-auto cursor-zoom-out' : 'max-w-full max-h-[65vh]'}`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Borrowers;
