import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Mail, Phone, Home, MapPin, Users, ShieldCheck, Clock,
  CreditCard, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Package,
  User, Settings, ChevronLeft, ChevronRight, X, Cake,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';

// ─── Pagination ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 5;

const usePagination = (items, perPage = PAGE_SIZE) => {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [items.length]);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const paginated  = items.slice((page - 1) * perPage, page * perPage);
  return { paginated, page, setPage, totalPages, total: items.length };
};

const PaginationBar = ({ page, totalPages, setPage, total, perPage = PAGE_SIZE, accent = 'text-[#006837]' }) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);
  return (
    <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
      <p className="text-[10px] text-slate-400 font-medium">
        <span className="font-bold text-slate-600">{from}–{to}</span> of <span className="font-bold text-slate-600">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">
          <ChevronLeft size={13} />
        </button>
        <span className={`text-[10px] font-black px-2 ${accent}`}>{page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};

// ─── Status config ────────────────────────────────────────────────────────────
export const STATUS_CFG = {
  pending:     { label: 'Pending',     dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       header: 'from-amber-400 to-amber-500'   },
  active:      { label: 'Active',      dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', header: 'from-[#006837] to-[#34a853]'  },
  deactivated: { label: 'Deactivated', dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600 border-red-200',             header: 'from-red-500 to-red-600'       },
  delinquent:  { label: 'Delinquent',  dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-700 border-orange-200',    header: 'from-orange-500 to-orange-600' },
};

export const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status || '—', dot: 'bg-slate-300', badge: 'bg-slate-100 text-slate-500 border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const fmtMonth = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

// Block/Lot values sometimes already include the word "Block"/"Lot" (e.g. "Blk 55")
// and sometimes don't (e.g. "55"). Strip any existing label before re-prefixing,
// so we never get "Block Blk 55, Lot Lot 7".
const stripLabel = (val, label) => {
  if (!val) return '';
  const re = new RegExp(`^${label}\\.?\\s*`, 'i');
  return String(val).replace(re, '').trim();
};

const buildBlockLot = (block, lot) => {
  const b = stripLabel(block, 'blk|block');
  const l = stripLabel(lot, 'lot');
  const parts = [];
  if (b) parts.push(`Block ${b}`);
  if (l) parts.push(`Lot ${l}`);
  return parts.join(', ') || null;
};

const fullName = (p) =>
  [p.first_name, p.middle_initial ? p.middle_initial + '.' : '', p.last_name]
    .filter(Boolean).join(' ') || p.username || 'Unknown';

// ─── Detail row ───────────────────────────────────────────────────────────────
const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0 mt-0.5">
      <Icon size={15} className="text-[#006837]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800 break-words leading-snug">{value || '—'}</p>
    </div>
  </div>
);

// ─── Resident Type row ────────────────────────────────────────────────────────
const RESIDENT_TYPE_CFG = {
  owner:     { label: 'Owner',     bg: 'bg-[#006837]/10', text: 'text-[#006837]', border: 'border-[#006837]/20', dot: 'bg-[#006837]' },
  homeowner: { label: 'Homeowner', bg: 'bg-[#006837]/10', text: 'text-[#006837]', border: 'border-[#006837]/20', dot: 'bg-[#006837]' },
  renter:    { label: 'Renter',    bg: 'bg-blue-50',      text: 'text-blue-700',  border: 'border-blue-200',     dot: 'bg-blue-400'  },
  tenant:    { label: 'Tenant',    bg: 'bg-blue-50',      text: 'text-blue-700',  border: 'border-blue-200',     dot: 'bg-blue-400'  },
};

const ResidentTypeRow = ({ value }) => {
  const key = (value || '').toLowerCase().trim();
  const cfg = RESIDENT_TYPE_CFG[key] || { label: value || '—', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Users size={15} className="text-[#006837]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Resident Type</p>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-black ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>
    </div>
  );
};

// ─── Dues Standing Section ────────────────────────────────────────────────────
const DuesStanding = ({ userId }) => {
  const [dues,       setDues]       = useState([]);
  const [monthlyDue, setMonthlyDue] = useState(150);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setLoading(true);
      const [{ data }, { data: settings }] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount, status, due_date, paid_at, reference_no')
          .eq('user_id', userId)
          .order('due_date', { ascending: false })
          .limit(12), // cap at 12 months — 2 pages of 6
        supabase.from('hoa_settings').select('monthly_due_amount').eq('id', 1).single(),
      ]);
      if (settings?.monthly_due_amount) setMonthlyDue(Number(settings.monthly_due_amount));
      setDues(data || []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  // A row whose amount is a multiple of the monthly due (e.g. ₱300 when the
  // due is ₱150) is a single advance payment covering more than one month —
  // there's no separate row per covered month, so the row's own due_date is
  // the LAST month it covers. Label it as a range (e.g. "Aug to Sep 2026")
  // instead of just the last month, matching the labeling already used in
  // the Payments page's Monthly Due Details view.
  const monthsCoveredBy = (amount) => Math.max(1, Math.round(Number(amount || 0) / (monthlyDue || 1)));

  const formatMonthCoverage = (dueDate, months) => {
    if (!dueDate) return '—';
    if (months <= 1) return fmtMonth(dueDate);
    const end = new Date(dueDate);
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
    const sameYear = start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString('en-US', sameYear ? { month: 'short' } : { month: 'short', year: 'numeric' });
    return `${startLabel} to ${fmtMonth(end)}`;
  };

  // Summary counts
  const totalUnpaid = dues.filter(d => ['unpaid','overdue','pending'].includes((d.status||'').toLowerCase())).length;
  const totalPaid   = dues.filter(d => d.status?.toLowerCase() === 'paid').length;
  const totalOwed   = dues.filter(d => ['unpaid','overdue','pending'].includes((d.status||'').toLowerCase()))
                          .reduce((s, d) => s + Number(d.amount || 0), 0);

  const { paginated, page, setPage, totalPages, total } = usePagination(dues, 6);

  const statusStyle = (s) => {
    switch ((s || '').toLowerCase()) {
      case 'paid':    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle2 size={12} className="text-emerald-500" /> };
      case 'overdue': return { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200',     icon: <AlertCircle  size={12} className="text-red-500"     /> };
      case 'unpaid':  return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: <AlertTriangle size={12} className="text-amber-500"  /> };
      default:        return { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   icon: <AlertTriangle size={12} className="text-slate-400"  /> };
    }
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#006837]/10 flex items-center justify-center">
            <CreditCard size={15} className="text-[#006837]" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Monthly Dues Standing</p>
            <p className="text-[10px] text-slate-400">Last 12 months</p>
          </div>
        </div>
        {/* Quick summary badges */}
        {!loading && dues.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {totalPaid} Paid
            </span>
            {totalUnpaid > 0 && (
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                {totalUnpaid} Unpaid
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2">
          <Loader2 size={16} className="animate-spin text-[#006837]" />
          <p className="text-xs text-slate-400">Loading dues…</p>
        </div>
      )}

      {/* No record */}
      {!loading && dues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <CreditCard size={24} className="text-slate-300 mb-1.5" />
          <p className="text-xs font-semibold text-slate-400">No payment records found</p>
        </div>
      )}

      {/* Total owed banner — only if there are unpaid */}
      {!loading && totalOwed > 0 && (
        <div className="mb-3 flex items-center justify-between px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-700">Total Outstanding Balance</p>
          </div>
          <p className="text-sm font-black text-red-700">₱{totalOwed.toLocaleString()}</p>
        </div>
      )}

      {/* Dues list */}
      {!loading && dues.length > 0 && (
        <div className="space-y-2">
          {paginated.map(d => {
            const s       = statusStyle(d.status);
            const isPaid  = d.status?.toLowerCase() === 'paid';
            const months  = monthsCoveredBy(d.amount);
            return (
              <div key={d.id}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border ${s.bg} ${s.border}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {s.icon}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">Due: {formatMonthCoverage(d.due_date, months)}</p>
                    <p className="text-[10px] text-slate-400">
                      {isPaid
                        ? `Paid on ${fmtDate(d.paid_at)}`
                        : `Due by ${fmtDate(d.due_date)}`}
                    </p>
                    {months > 1 && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-purple-100 text-purple-700 border border-purple-300">
                        {months} Months Advance
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`text-xs font-black ${s.text}`}>₱{Number(d.amount || 0).toLocaleString()}</p>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${s.bg} ${s.text} ${s.border}`}>
                    {d.status || '—'}
                  </span>
                </div>
              </div>
            );
          })}
          <PaginationBar page={page} totalPages={totalPages} setPage={setPage} total={total} perPage={6} accent="text-[#006837]" />
        </div>
      )}
    </div>
  );
};

// ─── Borrowed Items Section ───────────────────────────────────────────────────
const BorrowedItems = ({ userId }) => {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('reservations')
        .select('id, quantity, status, created_at, facilities(name, category)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      // Only keep rows tied to an Amenity Item
      setItems((data || []).filter(r => r.facilities?.category === 'Amenity Item'));
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const currentlyBorrowed = items.filter(r => ['Approved', 'Approved and Paid'].includes(r.status));
  const returnedCount     = items.filter(r => r.status === 'Completed').length;

  const { paginated, page, setPage, totalPages, total } = usePagination(items);

  const statusStyle = (s) => {
    switch (s) {
      case 'Approved':
      case 'Approved and Paid':
        return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Borrowed', icon: <Clock size={12} className="text-blue-500" /> };
      case 'Completed':
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Returned', icon: <CheckCircle2 size={12} className="text-emerald-500" /> };
      default:
        return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', label: s || '—', icon: <AlertTriangle size={12} className="text-slate-400" /> };
    }
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Package size={15} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Borrowed Items</p>
            <p className="text-[10px] text-slate-400">Amenity item history</p>
          </div>
        </div>
        {!loading && items.length > 0 && (
          <div className="flex items-center gap-1.5">
            {currentlyBorrowed.length > 0 && (
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {currentlyBorrowed.length} Active
              </span>
            )}
            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {returnedCount} Returned
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2">
          <Loader2 size={16} className="animate-spin text-blue-500" />
          <p className="text-xs text-slate-400">Loading borrowed items…</p>
        </div>
      )}

      {/* No record */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Package size={24} className="text-slate-300 mb-1.5" />
          <p className="text-xs font-semibold text-slate-400">No amenity items borrowed</p>
        </div>
      )}

      {/* List */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {paginated.map(r => {
            const s = statusStyle(r.status);
            return (
              <div key={r.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${s.bg} ${s.border}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {s.icon}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{r.facilities?.name || '—'}</p>
                    <p className="text-[10px] text-slate-400">
                      {r.quantity ? `${r.quantity} unit(s)` : 'Qty n/a'} · {fmtDate(r.created_at)}
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase shrink-0 ${s.bg} ${s.text} ${s.border}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
          <PaginationBar page={page} totalPages={totalPages} setPage={setPage} total={total} accent="text-blue-600" />
        </div>
      )}
    </div>
  );
};

// ─── Family Members Section ───────────────────────────────────────────────────
// Read-only — only the resident themselves (owner or tenant) decides who to
// add or remove from their own household. Staff can view, not manage.
const FamilyMembers = ({ userId }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('family_members')
      .select('id, full_name, relationship, birth_date, contact_number, created_at')
      .eq('resident_id', userId)
      .order('created_at', { ascending: false });
    setMembers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    fetchMembers();
  }, [userId]);

  const { paginated, page, setPage, totalPages, total } = usePagination(members);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#006837]/10 flex items-center justify-center">
            <Users size={15} className="text-[#006837]" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Family Members</p>
            <p className="text-[10px] text-slate-400">Household members living with this resident</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2">
          <Loader2 size={16} className="animate-spin text-[#006837]" />
          <p className="text-xs text-slate-400">Loading family members…</p>
        </div>
      )}

      {/* No record */}
      {!loading && members.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Users size={24} className="text-slate-300 mb-1.5" />
          <p className="text-xs font-semibold text-slate-400">No family members recorded yet</p>
        </div>
      )}

      {/* List */}
      {!loading && members.length > 0 && (
        <div className="space-y-2">
          {paginated.map(m => (
            <div key={m.id} className="flex items-center gap-2.5 px-4 py-3 rounded-xl border bg-slate-50 border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0">
                <User size={13} className="text-[#006837]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{m.full_name}</p>
                <p className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                  {m.relationship && <span>{m.relationship}</span>}
                  {m.birth_date && <span className="flex items-center gap-1"><Cake size={10} /> {fmtDate(m.birth_date)}</span>}
                  {m.contact_number && <span className="flex items-center gap-1"><Phone size={10} /> {m.contact_number}</span>}
                </p>
              </div>
            </div>
          ))}
          <PaginationBar page={page} totalPages={totalPages} setPage={setPage} total={total} accent="text-[#006837]" />
        </div>
      )}
    </div>
  );
};

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'profile', label: 'Profile Details',  icon: User        },
  { key: 'dues',    label: 'Monthly Dues',     icon: CreditCard   },
  { key: 'items',   label: 'Borrowed Items',   icon: Package      },
  { key: 'family',  label: 'Family Members',   icon: Users        },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const ResidentDetailModal = ({ profile, onClose }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [showImage, setShowImage] = useState(false);

  if (!profile) return null;

  const st  = profile.account_status;
  const cfg = STATUS_CFG[st] || STATUS_CFG.active;

  const blockLot = buildBlockLot(profile.block, profile.lot);
  const tenantNames = (profile.tenantNames || []).filter(Boolean);

  const details = [
    { icon: Users,       label: 'Resident Type', value: profile.resident_type },
    ...(profile.resident_type === 'tenant' && profile.ownerName
      ? [{ icon: User, label: 'Property Owner', value: profile.ownerName }]
      : []),
    ...(tenantNames.length
      ? [{ icon: Users, label: tenantNames.length > 1 ? 'Tenants' : 'Tenant', value: tenantNames.join(', ') }]
      : []),
    { icon: MapPin,      label: 'Full Address',  value: profile.address       },
    { icon: Home,        label: 'Block / Lot',   value: blockLot              },
    { icon: MapPin,      label: 'Street',        value: profile.street        },
    { icon: Mail,        label: 'Email Address', value: profile.email         },
    { icon: Phone,       label: 'Phone Number',  value: profile.phone         },
    { icon: Clock,       label: 'Date Joined',   value: fmtDate(profile.created_at) },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Coloured banner ── */}
        <div className={`bg-gradient-to-br ${cfg.header} shrink-0 relative`} style={{ height: '72px' }}>
          <button
            onClick={onClose}
            className="absolute top-4 left-5 flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-bold cursor-pointer transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
        </div>

        {/* ── Scroll wrapper for everything below the banner ── */}
        <div className="flex-1 overflow-y-auto bg-white">

          {/* ── Profile summary card — sits fully below the banner, NO overlap ── */}
          <div className="px-6 pt-5">
            <div className="flex items-start gap-4">
              <div
                onClick={() => profile.avatar_url && setShowImage(true)}
                className={`w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-slate-400 text-xl font-black uppercase border border-slate-200 ${profile.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
              >
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (profile.first_name?.charAt(0) || profile.username?.charAt(0) || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <h2 className="text-xl font-black text-slate-900 leading-tight flex items-center gap-1.5">
                    {fullName(profile)}
                    <ShieldCheck size={16} className="text-blue-500 shrink-0" />
                  </h2>
                  <StatusBadge status={st} />
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Mail size={11} /> {profile.email || '—'}
                  </span>
                  {profile.street && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin size={11} /> {profile.street}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact / quick-info chips, like the "Business / Product / AI" tags in the reference */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {profile.resident_type && (
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                  {profile.resident_type}
                </span>
              )}
              {blockLot && (
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {blockLot}
                </span>
              )}
              {profile.resident_type === 'tenant' && profile.ownerName && (
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <User size={10} /> Owner: {profile.ownerName}
                </span>
              )}
              {tenantNames.length > 0 && (
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <Users size={10} /> {tenantNames.length > 1 ? 'Tenants' : 'Tenant'}: {tenantNames.join(', ')}
                </span>
              )}
              {profile.phone && (
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {profile.phone}
                </span>
              )}
            </div>
          </div>

          {/* ── Tab bar (sticky while the content below scrolls) ── */}
          <div className="px-6 mt-4 border-b border-slate-100 flex items-center gap-1 sticky top-0 bg-white z-10">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-all cursor-pointer
                  ${activeTab === t.key
                    ? 'border-[#006837] text-[#006837]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="px-6 py-5">
            {activeTab === 'profile' && (
              <div>
                {details.map(d =>
                  d.label === 'Resident Type'
                    ? <ResidentTypeRow key={d.label} value={d.value} />
                    : <DetailRow key={d.label} {...d} />
                )}
              </div>
            )}
            {activeTab === 'dues'   && <DuesStanding userId={profile.id} />}
            {activeTab === 'items'  && <BorrowedItems userId={profile.id} />}
            {activeTab === 'family' && <FamilyMembers userId={profile.id} />}
          </div>

        </div>
      </div>

      {/* ── Avatar lightbox ── */}
      {showImage && profile.avatar_url && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-150"
          onClick={(e) => { e.stopPropagation(); setShowImage(false); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowImage(false); }}
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={profile.avatar_url}
            alt={fullName(profile)}
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ResidentDetailModal;
