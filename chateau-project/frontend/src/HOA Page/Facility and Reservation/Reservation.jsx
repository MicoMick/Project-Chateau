import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, CheckCircle2, XCircle, Search, Users, Trash2,
  Eye, X, Mail, User, AlertTriangle, Loader2, Filter, Package,
  DollarSign, CalendarDays, MapPin, ChevronRight, RefreshCw, RotateCcw, FileText,
  ZoomIn, ZoomOut,
} from 'lucide-react';
import Borrowers from './Borrowers';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import CalendarReserve from './CalendarReserve';
import ResidentFilterSelect from '../Resident Management/ResidentFilterSelect';

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


// ─── Role guard ───────────────────────────────────────────────────────────────
const RequireRole = ({ userRole, allowedRoles, children }) => {
  if (allowedRoles.includes(userRole) || userRole === 'super_admin') return children;
  return null;
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt12 = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};

const fmtDate = (d) => {
  if (!d) return 'N/A';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:          { label: 'Pending',          dot: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 border-amber-200',           gradient: 'from-amber-400 to-amber-500'    },
  approved:         { label: 'Approved',         dot: 'bg-[#006837]',   pill: 'bg-emerald-50 text-[#006837] border-emerald-200',       gradient: 'from-[#006837] to-[#34a853]'   },
  'approved and paid':{ label: 'Approved & Paid',dot: 'bg-teal-500',    pill: 'bg-teal-50 text-teal-700 border-teal-200',              gradient: 'from-teal-500 to-teal-600'      },
  completed:        { label: 'Completed',        dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200',              gradient: 'from-blue-500 to-blue-600'      },
  rejected:         { label: 'Rejected',         dot: 'bg-red-500',     pill: 'bg-red-50 text-red-600 border-red-200',                 gradient: 'from-red-500 to-red-600'        },
  cancelled:        { label: 'Cancelled',        dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-500 border-slate-200',          gradient: 'from-slate-400 to-slate-500'    },
};

const getStatus = (s) => STATUS[(s || '').toLowerCase()] || { label: s || '—', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-500 border-slate-200', gradient: 'from-slate-400 to-slate-500' };

const StatusPill = ({ status }) => {
  const st = getStatus(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide ${st.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  );
};

// ─── Payment status config (fee / proof-of-payment workflow) ─────────────────
const PAYMENT_STATUS = {
  paid:     { label: 'Paid',     pill: 'bg-emerald-50 text-[#006837] border-emerald-200' },
  pending:  { label: 'Pending',  pill: 'bg-amber-50 text-amber-700 border-amber-200'      },
  rejected: { label: 'Rejected', pill: 'bg-red-50 text-red-600 border-red-200'            },
};
const getPaymentStatus = (s) => PAYMENT_STATUS[(s || '').toLowerCase()] || null;

const PaymentStatusPill = ({ status }) => {
  const st = getPaymentStatus(status);
  if (!st) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide ${st.pill}`}>
      {st.label}
    </span>
  );
};

const fmtPeso = (n) => (n === null || n === undefined || n === '') ? '—' : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
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


// ─── Type badge — Facility vs Item ─────────────────────────────────────────────
const TypeBadge = ({ type }) => (
  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide
    ${type === 'Item' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-[#006837]/10 text-[#006837] border-[#006837]/20'}`}>
    {type === 'Item' ? <Package size={11} /> : <MapPin size={11} />}
    {type}
  </span>
);

// ─── ReservationsTable — shared table for the Facility and Item reservation lists ──
const ReservationsTable = ({
  type, title, icon: Icon, list, paginated, page, setPage, totalPages, total, rowsPerPage,
  loading, currentUserRole, updateStatus, setSelectedRes, setDeleteTarget,
}) => {
  const isItem = type === 'Item';
  const headers = isItem
    ? ['Resident', 'Type', 'Name', 'Qty', 'Date', 'Status', 'Requested On', 'Actions']
    : ['Resident', 'Type', 'Name', 'Date', 'Time Slot', 'Status', 'Requested On', 'Actions'];

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <Icon size={16} className={isItem ? 'text-blue-600' : 'text-[#006837]'} />
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400 font-semibold">({total})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {headers.map(h => (
                <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={headers.length} className="py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
                  <p className="text-sm text-[#006837] font-semibold animate-pulse">Loading reservations…</p>
                </div>
              </td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={headers.length} className="py-16 text-center">
                <Icon size={36} className="mx-auto text-slate-200 mb-2" />
                <p className="text-sm font-bold text-slate-400">No {isItem ? 'item' : 'facility'} reservations found</p>
                <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filter</p>
              </td></tr>
            ) : paginated.map(res => {
              const st = getStatus(res.status);
              return (
                <tr key={res.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => setSelectedRes(res)}>
                  {/* Resident */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${st.gradient} flex items-center justify-center text-white text-xs font-black uppercase shrink-0`}>
                        {res.profiles?.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{res.profiles?.full_name || '—'}</p>
                        <p className="text-[10px] text-slate-400">{res.profiles?.email || ''}</p>
                      </div>
                    </div>
                  </td>
                  {/* Type */}
                  <td className="px-5 py-4">
                    <TypeBadge type={isItem ? 'Item' : 'Facility'} />
                  </td>
                  {/* Name */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      {isItem ? <Package size={12} className="text-slate-400 shrink-0" /> : <MapPin size={12} className="text-slate-400 shrink-0" />}
                      <span className="text-sm text-slate-600 font-medium">{res.facilities?.name || '—'}</span>
                    </div>
                  </td>
                  {/* Qty — item table only */}
                  {isItem && (
                    <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{res.quantity ? `${res.quantity} unit(s)` : '—'}</td>
                  )}
                  {/* Date */}
                  <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{fmtDate(res.date)}</td>
                  {/* Time Slot — facility table only */}
                  {!isItem && (
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-600">{fmt12(res.start_time)} – {fmt12(res.end_time)}</span>
                      </div>
                    </td>
                  )}
                  {/* Status */}
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusPill status={res.status} />
                      {res.proof_url && (res.payment_status || '').toLowerCase() === 'pending' && (
                        <span title="Proof of payment awaiting review"
                          className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 uppercase tracking-wide">
                          <DollarSign size={9} /> Review
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Requested On */}
                  <td className="px-5 py-4 text-sm text-slate-400 whitespace-nowrap">{fmtDate(res.created_at)}</td>
                  {/* Actions */}
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelectedRes(res)} title="View"
                        className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all cursor-pointer">
                        <Eye size={15} />
                      </button>
                      <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','treasurer','board_member']}>
                        {res.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => updateStatus(res.id, 'Approved')}
                              disabled={isItem && (res.facilities?.amount ?? 0) < (res.quantity || 1)}
                              title={isItem && (res.facilities?.amount ?? 0) < (res.quantity || 1) ? 'Not enough stock to approve' : 'Approve'}
                              className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-[#006837] rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                              <CheckCircle2 size={15} />
                            </button>
                            <button onClick={() => updateStatus(res.id, 'Rejected')} title="Reject"
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all cursor-pointer">
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                        {res.status === 'Approved and Paid' && (
                          <button onClick={() => updateStatus(res.id, 'Completed')} title="Mark Completed"
                            className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all cursor-pointer">
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        <button onClick={() => setDeleteTarget(res.id)} title="Delete"
                          className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all cursor-pointer">
                          <Trash2 size={15} />
                        </button>
                      </RequireRole>
                      {/* Confirm Cash Payment — facility rentals only; items are borrowed, not rented, so no rental payment to confirm */}
                      {!isItem && (
                        <RequireRole userRole={currentUserRole} allowedRoles={['treasurer','president','board_member']}>
                          {res.status === 'Approved' && (
                            <button onClick={() => updateStatus(res.id, 'Approved and Paid')} title="Confirm Cash Payment"
                              className="p-2 hover:bg-teal-50 text-slate-400 hover:text-teal-600 rounded-lg transition-all cursor-pointer">
                              <DollarSign size={15} />
                            </button>
                          )}
                        </RequireRole>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loading && total > 0 && (
        <PaginationBar page={page} totalPages={totalPages} setPage={setPage} total={total} rowsPerPage={rowsPerPage} />
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Reservation = () => {
  const [reservations,      setReservations]      = useState([]);
  const [residentsList,     setResidentsList]      = useState([]);
  const [loading,           setLoading]            = useState(true);
  const [search,            setSearch]             = useState('');
  const [statusFilter,      setStatusFilter]       = useState('all');
  const [residentFilter,    setResidentFilter]     = useState('All');
  const [selectedRes,       setSelectedRes]        = useState(null);
  const [isCalendarOpen,    setIsCalendarOpen]     = useState(false);
  const [deleteTarget,      setDeleteTarget]       = useState(null);
  const [pageTab,           setPageTab]            = useState('reservations'); // 'reservations' | 'borrowers'
  const [borrowerSearch,    setBorrowerSearch]     = useState('');
  const [borrowerTab,       setBorrowerTab]        = useState('pending'); // 'pending' | 'current' | 'history' | 'declined'
  const [returning,         setReturning]          = useState(null);
  const [proofPreview,      setProofPreview]       = useState(null); // proof_url currently shown in lightbox
  const [proofZoomed,       setProofZoomed]        = useState(false); // toggled by clicking the proof image
  const [payingId,          setPayingId]           = useState(null); // reservation id currently being accepted/rejected

  const currentUserRole = localStorage.getItem('userRole') || 'resident';

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: res }, { data: profiles }] = await Promise.all([
      supabase.from('reservations').select('*, facilities(name, category, amount), profiles!user_id(full_name, email)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').order('full_name'),
    ]);
    setReservations(res || []);
    setResidentsList(profiles || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      const res = reservations.find(r => r.id === id);
      const isItemReservation = res?.facilities?.category === 'Amenity Item';
      const requestedQty = res?.quantity || 1;
      const currentAmount = res?.facilities?.amount ?? 0;

      // ── Validate stock BEFORE approving — the resident already chose the
      // quantity when they submitted the request, so the admin just approves
      // or rejects. No manual quantity entry needed.
      if (isItemReservation && newStatus === 'Approved' && requestedQty > currentAmount) {
        alert(`Cannot approve: resident requested ${requestedQty} unit(s) but only ${currentAmount} are in stock.`);
        return false;
      }

      const { error } = await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      // ── Stock management for Amenity Items ──────────────────────────────
      if (isItemReservation) {
        const wasApprovedLike = ['Approved', 'Approved and Paid', 'Completed'].includes(res.status);
        const isApprovedLike  = ['Approved', 'Approved and Paid', 'Completed'].includes(newStatus);
        const facilityId = res.facility_id;

        // Newly approved (wasn't approved before) → decrement stock by what was requested
        if (!wasApprovedLike && isApprovedLike) {
          const newAmount = Math.max(0, currentAmount - requestedQty);
          await supabase.from('facilities').update({
            amount: newAmount,
            status: newAmount <= 0 ? 'Not Available' : 'Available',
          }).eq('id', facilityId);
        }
        // Was approved, now rejected/cancelled → restore stock
        else if (wasApprovedLike && !isApprovedLike && ['Rejected', 'Cancelled'].includes(newStatus)) {
          const newAmount = currentAmount + requestedQty;
          await supabase.from('facilities').update({
            amount: newAmount,
            status: newAmount > 0 ? 'Available' : 'Not Available',
          }).eq('id', facilityId);
        }
      }
      // ──────────────────────────────────────────────────────────────────────

      await fetchAll();
      if (selectedRes?.id === id) setSelectedRes(prev => ({ ...prev, status: newStatus }));
      logAudit('RESERVATION_STATUS_UPDATE',
        `${res?.profiles?.full_name || 'Resident'} — ${res?.facilities?.name || 'reservation'} → ${newStatus}.`);
      return true;
    } catch (e) {
      alert('Error: ' + e.message);
      return false;
    }
  };


  // ── Accept or reject a resident's submitted proof of payment ────────────────
  const handlePaymentDecision = async (id, decision) => {
    setPayingId(id);
    try {
      const res = reservations.find(r => r.id === id);
      const updates = decision === 'Paid'
        ? { payment_status: 'Paid', paid_at: new Date().toISOString(), status: 'Approved and Paid' }
        : { payment_status: 'Rejected' };

      const { error } = await supabase.from('reservations').update(updates).eq('id', id);
      if (error) throw error;

      await fetchAll();
      if (selectedRes?.id === id) setSelectedRes(prev => ({ ...prev, ...updates }));
      logAudit('RESERVATION_PAYMENT_DECISION',
        `Payment ${decision === 'Paid' ? 'accepted' : 'rejected'} for ${res?.profiles?.full_name || 'resident'} — ${res?.facilities?.name || 'reservation'}.`);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setPayingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = reservations.find(r => r.id === deleteTarget);
      const { error } = await supabase.from('reservations').delete().eq('id', deleteTarget);
      if (error) throw error;

      // Restore stock if an approved item reservation is being deleted
      const isItemReservation = res?.facilities?.category === 'Amenity Item';
      const wasApprovedLike = ['Approved', 'Approved and Paid', 'Completed'].includes(res?.status);
      if (isItemReservation && wasApprovedLike) {
        const currentAmount = res.facilities?.amount ?? 0;
        const newAmount = currentAmount + (res.quantity || 1);
        await supabase.from('facilities').update({
          amount: newAmount,
          status: newAmount > 0 ? 'Available' : 'Not Available',
        }).eq('id', res.facility_id);
      }

      setReservations(prev => prev.filter(r => r.id !== deleteTarget));
      setDeleteTarget(null);
      logAudit('RESERVATION_DELETED',
        `${res?.profiles?.full_name || 'Resident'} — ${res?.facilities?.name || 'reservation'} deleted.`);
    } catch (e) { alert('Error: ' + e.message); }
  };

  // ── Stats — Facility rentals only; borrowed items get their own stat cards
  // in the Borrowers tab so the two don't get conflated on one dashboard.
  const facilityReservations = reservations.filter(r => r.facilities?.category !== 'Amenity Item');
  const stats = {
    all:              facilityReservations.length,
    pending:          facilityReservations.filter(r => r.status === 'Pending').length,
    approved:         facilityReservations.filter(r => r.status === 'Approved').length,
    'approved and paid': facilityReservations.filter(r => r.status === 'Approved and Paid').length,
    completed:        facilityReservations.filter(r => r.status === 'Completed').length,
    rejected:         facilityReservations.filter(r => r.status === 'Rejected').length,
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = reservations.filter(r => {
    const name = (r.profiles?.full_name || '').toLowerCase();
    const fac  = (r.facilities?.name || '').toLowerCase();
    const term = search.toLowerCase();
    const matchSearch   = !term || name.includes(term) || fac.includes(term);
    const matchStatus   = statusFilter === 'all' || (r.status || '').toLowerCase() === statusFilter;
    const matchResident = residentFilter === 'All' || r.user_id === residentFilter;
    return matchSearch && matchStatus && matchResident;
  });
  // Facility rentals only — borrowed items live in their own Borrowers tab/table.
  const facilityFiltered = filtered.filter(r => r.facilities?.category !== 'Amenity Item');
  const { paginated: paginatedFacilityRes, page: facResPage, setPage: setFacResPage, totalPages: facResTotalPages, total: facResTotal } = usePagination(facilityFiltered, 5);

  const kpiCards = [
    { key: 'all',              label: 'Total',           icon: Calendar,    color: 'text-slate-600',    bg: 'bg-slate-100'    },
    { key: 'pending',          label: 'Pending',         icon: Clock,       color: 'text-amber-600',    bg: 'bg-amber-50'     },
    { key: 'approved',         label: 'Approved',        icon: CheckCircle2,color: 'text-[#006837]',    bg: 'bg-emerald-50'   },
    { key: 'approved and paid',label: 'For Payment',     icon: DollarSign,  color: 'text-teal-600',     bg: 'bg-teal-50'      },
    { key: 'completed',        label: 'Completed',       icon: CheckCircle2,color: 'text-blue-600',     bg: 'bg-blue-50'      },
    { key: 'rejected',         label: 'Rejected',        icon: XCircle,     color: 'text-red-500',      bg: 'bg-red-50'       },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-6 lg:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarDays size={22} className="text-[#006837]" />
            Reservation Management
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">View and manage amenity reservations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {/* ── Page-level tab switcher ── */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
            <button onClick={() => setPageTab('reservations')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${pageTab === 'reservations' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <CalendarDays size={13} /> Reservations
            </button>
            {currentUserRole !== 'treasurer' && (
              <button onClick={() => setPageTab('borrowers')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                  ${pageTab === 'borrowers' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Package size={13} /> Borrowers
                {reservations.filter(r => r.facilities?.category === 'Amenity Item' && r.status === 'Pending').length > 0 && (
                  <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {reservations.filter(r => r.facilities?.category === 'Amenity Item' && r.status === 'Pending').length}
                  </span>
                )}
              </button>
            )}
          </div>
          <button onClick={() => setIsCalendarOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#006837]/20 cursor-pointer transition-all">
            <Calendar size={14} /> Calendar View
          </button>
        </div>
      </div>

      {/* ── Main content — conditional on pageTab ── */}
      {pageTab === 'reservations' && (
      <>
      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(k => (
          <KpiCard key={k.key} label={k.label} value={stats[k.key] || 0}
            icon={k.icon} color={k.color} bg={k.bg}
          />
        ))}
      </div>

      {/* ── Shared toolbar ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search name or facility…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
          </div>

          {/* Resident filter */}
          <ResidentFilterSelect
            value={residentFilter}
            onChange={setResidentFilter}
            icon={Filter}
            options={residentsList.map(r => ({ value: r.id, label: r.full_name }))}
            className="w-44"
          />

          {/* Status pill filter */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl ml-auto">
            {['all', 'pending', 'approved', 'approved and paid', 'completed', 'rejected'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap
                  ${statusFilter === s ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {s === 'all' ? `All (${stats.all})`
                  : s === 'approved and paid' ? `For Payment (${stats[s] || 0})`
                  : `${s.charAt(0).toUpperCase() + s.slice(1)} (${stats[s] || 0})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Facility reservations table ─────────────────────────────────────── */}
      <ReservationsTable
        type="Facility" title="Facility Reservations" icon={MapPin}
        list={facilityFiltered} paginated={paginatedFacilityRes}
        page={facResPage} setPage={setFacResPage} totalPages={facResTotalPages} total={facResTotal} rowsPerPage={5}
        loading={loading} currentUserRole={currentUserRole}
        updateStatus={updateStatus} setSelectedRes={setSelectedRes} setDeleteTarget={setDeleteTarget}
      />

      </>
      )}

      {/* ── Borrowers Tab ─────────────────────────────────────────────────────── */}
      {pageTab === 'borrowers' && (
        <Borrowers
          reservations={reservations}
          search={borrowerSearch}
          setSearch={setBorrowerSearch}
          tab={borrowerTab}
          setTab={setBorrowerTab}
          returning={returning}
          setReturning={setReturning}
          currentUserRole={currentUserRole}
          onRefresh={fetchAll}
          updateStatus={updateStatus}
        />
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {selectedRes && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          onClick={() => setSelectedRes(null)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          <div className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Status gradient header */}
            <div className={`bg-gradient-to-br ${getStatus(selectedRes.status).gradient} px-6 pt-5 pb-6`}>
              <div className="flex items-start justify-between mb-4">
                <StatusPill status={selectedRes.status} />
                <button onClick={() => setSelectedRes(null)}
                  className="p-1.5 hover:bg-white/20 rounded-xl text-white/80 hover:text-white cursor-pointer transition-all">
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white/20 rounded-2xl border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black uppercase shrink-0">
                  {selectedRes.profiles?.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white leading-tight">{selectedRes.profiles?.full_name || '—'}</h2>
                  <p className="text-white/60 text-xs mt-0.5 flex items-center gap-1">
                    <Mail size={11} /> {selectedRes.profiles?.email || 'No email'}
                  </p>
                </div>
              </div>
            </div>

            {/* Details — landscape: reservation info and payment info side by side once there's payment data to show */}
            <div className={`p-6 grid gap-5 ${
              (selectedRes.fee != null || selectedRes.proof_url || selectedRes.payment_status) ? 'md:grid-cols-2' : 'grid-cols-1'
            }`}>
              {/* Left column — reservation info */}
              <div className="space-y-3">
                {[
                  { icon: MapPin,      label: 'Facility',       value: selectedRes.facilities?.name || '—' },
                  ...(selectedRes.facilities?.category === 'Amenity Item'
                    ? [{ icon: Package, label: 'Quantity Requested', value: selectedRes.quantity ? `${selectedRes.quantity} unit(s)` : 'Not specified yet' }]
                    : [
                        { icon: CalendarDays,label: 'Scheduled Date', value: fmtDate(selectedRes.date) },
                        { icon: Clock,       label: 'Time Slot',      value: `${fmt12(selectedRes.start_time)} – ${fmt12(selectedRes.end_time)}` },
                      ]),
                  { icon: Calendar,    label: 'Requested On',   value: fmtDate(selectedRes.created_at)     },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0">
                      <f.icon size={14} className="text-[#006837]" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{f.label}</p>
                      <p className="text-sm font-bold text-slate-800">{f.value}</p>
                    </div>
                  </div>
                ))}

                {/* Stock check info — only shown while still Pending, purely informational */}
                {selectedRes.facilities?.category === 'Amenity Item' && selectedRes.status === 'Pending' && (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    (selectedRes.facilities?.amount ?? 0) >= (selectedRes.quantity || 1)
                      ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    {(selectedRes.facilities?.amount ?? 0) >= (selectedRes.quantity || 1)
                      ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      : <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />}
                    <p className={`text-xs font-semibold ${
                      (selectedRes.facilities?.amount ?? 0) >= (selectedRes.quantity || 1) ? 'text-emerald-700' : 'text-red-700'}`}>
                      {(selectedRes.facilities?.amount ?? 0) >= (selectedRes.quantity || 1)
                        ? `${selectedRes.facilities?.amount ?? 0} unit(s) in stock — enough to approve this request.`
                        : `Only ${selectedRes.facilities?.amount ?? 0} unit(s) left in stock — not enough to approve ${selectedRes.quantity || 1} requested.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Right column — Payment Details, only shown once a fee/proof has been submitted */}
              {(selectedRes.fee != null || selectedRes.proof_url || selectedRes.payment_status) && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <DollarSign size={12} /> Payment Details
                  </p>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                    <div className="flex items-center justify-between p-3">
                      <span className="text-xs font-semibold text-slate-500">Fee</span>
                      <span className="text-sm font-bold text-slate-800">{fmtPeso(selectedRes.fee)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3">
                      <span className="text-xs font-semibold text-slate-500">Reference No.</span>
                      <span className="text-sm font-bold text-slate-800">{selectedRes.reference_no || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3">
                      <span className="text-xs font-semibold text-slate-500">Payment Status</span>
                      <PaymentStatusPill status={selectedRes.payment_status} />
                    </div>
                    {selectedRes.paid_at && (
                      <div className="flex items-center justify-between p-3">
                        <span className="text-xs font-semibold text-slate-500">Paid On</span>
                        <span className="text-sm font-bold text-slate-800">{fmtDate(selectedRes.paid_at)}</span>
                      </div>
                    )}
                    {selectedRes.proof_url && (
                      <div className="p-3">
                        <button onClick={() => { setProofPreview(selectedRes.proof_url); setProofZoomed(false); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-[#006837] hover:text-[#006837] text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                          <Eye size={13} /> View Proof of Payment
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Accept / reject the submitted proof — treasurer/president only, while pending */}
                  <RequireRole userRole={currentUserRole} allowedRoles={['treasurer','president','board_member']}>
                    {selectedRes.proof_url && (selectedRes.payment_status || '').toLowerCase() === 'pending' && (
                      <div className="flex gap-2.5 mt-3">
                        <button
                          onClick={() => handlePaymentDecision(selectedRes.id, 'Paid')}
                          disabled={payingId === selectedRes.id}
                          className="flex-1 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#006837]/20 transition-all disabled:opacity-50">
                          <CheckCircle2 size={14} /> {payingId === selectedRes.id ? 'Saving…' : 'Accept Payment'}
                        </button>
                        <button
                          onClick={() => handlePaymentDecision(selectedRes.id, 'Rejected')}
                          disabled={payingId === selectedRes.id}
                          className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
                          <XCircle size={14} /> Reject Proof
                        </button>
                      </div>
                    )}
                  </RequireRole>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="px-6 pb-6 pt-4 flex flex-col gap-2.5">
              <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','treasurer','board_member']}>
                {selectedRes.status === 'Pending' && (
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => updateStatus(selectedRes.id, 'Approved')}
                      disabled={selectedRes.facilities?.category === 'Amenity Item' &&
                        (selectedRes.facilities?.amount ?? 0) < (selectedRes.quantity || 1)}
                      className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#006837]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button onClick={() => updateStatus(selectedRes.id, 'Rejected')}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-500/20 transition-all">
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                )}
                {selectedRes.status === 'Approved and Paid' && (
                  <button onClick={() => updateStatus(selectedRes.id, 'Completed')}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 transition-all">
                    <CheckCircle2 size={15} /> Mark as Completed
                  </button>
                )}
              </RequireRole>
              {/* Confirm Cash Payment — facility rentals only; items are borrowed, not rented */}
              {selectedRes.facilities?.category !== 'Amenity Item' && (
                <RequireRole userRole={currentUserRole} allowedRoles={['treasurer','president','board_member']}>
                  {selectedRes.status === 'Approved' && (
                    <button onClick={() => updateStatus(selectedRes.id, 'Approved and Paid')}
                      className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-600/20 transition-all">
                      <DollarSign size={15} /> Confirm Cash Payment Received
                    </button>
                  )}
                </RequireRole>
              )}
              <button onClick={() => setSelectedRes(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Calendar ─────────────────────────────────────────────────────────── */}
      <CalendarReserve isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)}
        reservations={reservations} setSelectedReservation={setSelectedRes} />



      {/* ── Proof of payment lightbox — stays in-app; image is click-to-zoom ──── */}
      {proofPreview && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4"
          onClick={() => { setProofPreview(null); setProofZoomed(false); }}>
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
          <div className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col transition-all duration-200
              ${proofZoomed ? 'max-w-5xl max-h-[94vh]' : 'max-w-lg max-h-[85vh]'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <FileText size={14} className="text-[#006837]" /> Proof of Payment
              </p>
              <div className="flex items-center gap-1.5">
                {!/\.pdf($|\?)/i.test(proofPreview) && (
                  <button onClick={() => setProofZoomed(z => !z)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
                    title={proofZoomed ? 'Zoom out' : 'Zoom in'}>
                    {proofZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                  </button>
                )}
                <button onClick={() => { setProofPreview(null); setProofZoomed(false); }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-4 flex items-center justify-center bg-slate-50 flex-1">
              {/\.pdf($|\?)/i.test(proofPreview)
                ? <iframe src={proofPreview} title="Proof of payment (PDF)" className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white" />
                : <img src={proofPreview} alt="Proof of payment" onClick={() => setProofZoomed(z => !z)}
                    className={`rounded-lg object-contain transition-all duration-200 cursor-zoom-in
                      ${proofZoomed ? 'max-w-none max-h-none w-auto cursor-zoom-out' : 'max-w-full max-h-[65vh]'}`} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-7 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1.5">Delete Reservation?</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">This permanently removes the reservation. This cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 cursor-pointer transition-all">
                  Cancel
                </button>
                <button onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 shadow-lg shadow-red-100 cursor-pointer transition-all">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Reservation;
