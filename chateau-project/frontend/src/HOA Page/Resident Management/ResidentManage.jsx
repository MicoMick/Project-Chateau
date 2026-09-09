import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import {
  Users, UserPlus, UserCheck, Search, X,
  Home, AlertTriangle, Eye, Trash2,
  RefreshCw, CheckCircle2, Info,
} from 'lucide-react';

// ── External components ───────────────────────────────────────────────────────
import ResidentDetailModal, { STATUS_CFG, StatusBadge } from './ResidentDetailModal';
import AccountApproval from '../Account Approval/AccountApproval';
import ResidentFilterSelect from './ResidentFilterSelect';

// ─── Block/Lot label helper ───────────────────────────────────────────────────
// DB values sometimes already include the word "Block"/"Lot" (e.g. "Blk 55")
// and sometimes don't (e.g. "55"). This strips any existing label before
// re-prefixing, so we never get "Block Blk 55, Lot Lot 7".
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

// ── Duplicate-name detection ──────────────────────────────────────────────
// No signup flow in this app checks for an existing profile before creating
// a new one (registration happens outside this codebase), so the same person
// can end up with two `profiles` rows. Flags matching names so staff can spot
// and resolve it (e.g. deactivate/delete the duplicate) here.
const normalizeName = (name) => (name || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

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

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ toast }) => {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border
      animate-in fade-in slide-in-from-top-4 duration-300
      ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
      : toast.type === 'info'    ? 'bg-blue-50 border-blue-100 text-blue-800'
      :                            'bg-red-50 border-red-100 text-red-800'}`}>
      {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" />
      : toast.type === 'info'   ? <Info          size={16} className="text-blue-500"   />
      :                           <AlertTriangle  size={16} className="text-red-500"    />}
      <p className="text-sm font-bold">{toast.message}</p>
    </div>
  );
};



// ─── Main Page ────────────────────────────────────────────────────────────────
const ResidentManage = () => {
  const [residents,       setResidents]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [residentFilter,  setResidentFilter]  = useState('all');
  const [viewProfile,     setViewProfile]     = useState(null);
  const [residentToDelete,setResidentToDelete]= useState(null);
  const [toast,           setToast]           = useState({ show: false, message: '', type: 'success' });


  const currentUserRole = localStorage.getItem('userRole') || 'resident';
  const isPresident = currentUserRole === 'president';

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const DELINQUENT_THRESHOLD = 450; // ₱450 = 3 months × ₱150

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      // ── Balance-based delinquency check ──────────────────────────────────
      // Fetch all unpaid payments and sum per resident.
      // Any active resident with balance >= ₱450 gets flagged as delinquent.
      const { data: unpaidPayments } = await supabase
        .from('payments').select('user_id, amount')
        .in('status', ['unpaid', 'overdue', 'pending']);

      if (unpaidPayments?.length) {
        const balanceMap = {};
        unpaidPayments.forEach(p => {
          balanceMap[p.user_id] = (balanceMap[p.user_id] || 0) + Number(p.amount || 0);
        });

        // Residents that should be delinquent (balance >= threshold, currently active)
        const toDelinquent = (data || []).filter(r =>
          r.account_status === 'active' &&
          (balanceMap[r.id] || 0) >= DELINQUENT_THRESHOLD
        ).map(r => r.id);

        // Residents that should be reactivated (balance < threshold, currently delinquent)
        const toReactivate = (data || []).filter(r =>
          r.account_status === 'delinquent' &&
          (balanceMap[r.id] || 0) < DELINQUENT_THRESHOLD
        ).map(r => r.id);

        if (toDelinquent.length) {
          await supabase.from('profiles')
            .update({ account_status: 'delinquent' }).in('id', toDelinquent);
          await logAudit('AUTO_DELINQUENT',
            `Auto-flagged ${toDelinquent.length} resident(s) as delinquent — balance ≥ ₱${DELINQUENT_THRESHOLD}.`);
          toDelinquent.forEach(id => {
            const r = data.find(x => x.id === id);
            if (r) r.account_status = 'delinquent';
          });
        }

        if (toReactivate.length) {
          await supabase.from('profiles')
            .update({ account_status: 'active' }).in('id', toReactivate);
          await logAudit('AUTO_REACTIVATE',
            `Auto-reactivated ${toReactivate.length} resident(s) — balance now below ₱${DELINQUENT_THRESHOLD}.`);
          toReactivate.forEach(id => {
            const r = data.find(x => x.id === id);
            if (r) r.account_status = 'active';
          });
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      setResidents(data || []);
    } catch (e) {
      showToast('Failed to load residents: ' + e.message, 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchResidents(); }, [fetchResidents]);


  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', residentToDelete);
      if (error) throw error;
      await logAudit('DELETE_RESIDENT', `Deleted resident ID: ${residentToDelete}`, 'warning');
      showToast('Resident deleted.');
      setResidentToDelete(null); fetchResidents();
    } catch (e) { showToast('Failed to delete: ' + e.message, 'error'); }
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const statusTabs = [
    { key: 'all',         label: 'All'         },
    { key: 'pending',     label: 'Pending'      },
    { key: 'active',      label: 'Active'       },
    { key: 'deactivated', label: 'Deactivated'  },
    { key: 'delinquent',  label: 'Delinquent'   },
  ];

  const statusCounts = residents.reduce((acc, r) => {
    acc[r.account_status] = (acc[r.account_status] || 0) + 1;
    return acc;
  }, {});

  const filtered = residents.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      (r.full_name || '').toLowerCase().includes(term) ||
      (r.email     || '').toLowerCase().includes(term) ||
      (r.username  || '').toLowerCase().includes(term) ||
      (r.block     || '').toLowerCase().includes(term) ||
      (r.lot       || '').toLowerCase().includes(term);
    const matchStatus   = statusFilter   === 'all' || r.account_status === statusFilter;
    const matchResident = residentFilter === 'all' || (r.resident_type || '').toLowerCase() === residentFilter;
    return matchSearch && matchStatus && matchResident;
  });
  const { paginated: paginatedResidents, page: resPage, setPage: setResPage, totalPages: resTotalPages, total: filteredTotal } = usePagination(filtered, 5);

  // Name → count across ALL residents regardless of status.
  const nameCounts = residents.reduce((acc, r) => {
    const key = normalizeName(r.full_name);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const isPossibleDuplicate = (r) => nameCounts[normalizeName(r.full_name)] > 1;
  const duplicateCount = Object.values(nameCounts).filter(c => c > 1).length;

  const now          = new Date();
  const newThisMonth = residents.filter(r => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">
      <Toast toast={toast} />

      {/* Delete confirm */}
      {residentToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4"><Trash2 size={22} className="text-red-500" /></div>
            <h3 className="text-lg font-black text-slate-900 mb-2">Delete Resident?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">This permanently removes the profile and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setResidentToDelete(null)} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 shadow-lg shadow-red-100 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}


      {/* Shared external detail modal */}
      <ResidentDetailModal
        profile={viewProfile}
        onClose={() => setViewProfile(null)}
      />


      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users size={22} className="text-[#006837]" /> Resident Management
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage profiles, approvals, and account statuses in one place</p>
        </div>
        <button onClick={fetchResidents} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: 'Total',       value: residents.length,                                                                                  icon: Users,     iconBg: 'bg-blue-50',    iconColor: 'text-blue-600'    },
          { title: 'Pending',     value: statusCounts.pending || 0,                                                                         icon: UserCheck, iconBg: 'bg-amber-50',   iconColor: 'text-amber-600'   },
          { title: 'Delinquent',  value: statusCounts.delinquent || 0,                                                                      icon: AlertTriangle, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' },
          { title: 'New / Month', value: newThisMonth,                                                                                      icon: UserPlus,  iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { title: 'Possible Duplicates', value: duplicateCount,                                                                            icon: AlertTriangle, iconBg: 'bg-amber-50',  iconColor: 'text-amber-600'   },
        ].map(k => (
          <div key={k.title} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k.title}</p>
                <p className="text-3xl font-black text-slate-900">{k.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${k.iconBg}`}><k.icon size={18} className={k.iconColor} /></div>
            </div>
          </div>
        ))}
      </div>



      {/* ══ Resident Management Table ══ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
              {statusTabs.map(tab => (
                <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                    ${statusFilter === tab.key ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {tab.label}
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? 'bg-[#006837]/10 text-[#006837]' : 'bg-slate-200 text-slate-500'}`}>
                    {tab.key === 'all' ? residents.length : (statusCounts[tab.key] || 0)}
                  </span>
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative sm:w-52 w-full ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search name, email, block…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/30 focus:border-[#006837] transition-all" />
            </div>
            {/* Resident type filter */}
            <ResidentFilterSelect
              value={residentFilter}
              onChange={setResidentFilter}
              allValue="all"
              allLabel="All Residents"
              options={[
                { value: 'owner',  label: 'Owners' },
                { value: 'tenant', label: 'Tenant' },
              ]}
              className="sm:w-44 w-full"
            />
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
                <p className="text-sm text-slate-400 font-medium animate-pulse">Loading residents…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <Users size={36} className="mb-2" />
                <p className="text-sm font-semibold text-slate-400">{searchTerm ? 'No residents match your search' : 'No residents found'}</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Resident','Contact','Block / Lot','Type','Status','Joined','Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedResidents.map(r => {
                    const st  = r.account_status;
                    // Row highlight per status
                    const rowBg =
                      st === 'delinquent'  ? 'bg-orange-50/40' :
                      st === 'pending'     ? 'bg-amber-50/30'  :
                      st === 'deactivated' ? 'bg-red-50/20'    : '';
                    // Avatar colour per status
                    const avatarBg =
                      st === 'delinquent'  ? 'bg-orange-100 text-orange-600' :
                      st === 'active'      ? 'bg-[#006837]/10 text-[#006837]' :
                      st === 'pending'     ? 'bg-amber-100 text-amber-600'   :
                                             'bg-red-100 text-red-500';

                    return (
                      <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${rowBg}`}>
                        {/* Resident */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm uppercase overflow-hidden shrink-0 ${avatarBg}`}>
                              {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : (r.first_name?.charAt(0) || r.username?.charAt(0) || '?')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                                {r.full_name || r.username}
                                {isPossibleDuplicate(r) && (
                                  <span
                                    title="Another profile in the system has this same name — likely a duplicate account for the same resident."
                                    className="inline-flex items-center gap-1 shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle size={9} /> Possible Duplicate
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 truncate">@{r.username || '—'}</p>
                            </div>
                          </div>
                        </td>
                        {/* Contact */}
                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-600 truncate max-w-[160px]">{r.email || '—'}</p>
                          <p className="text-xs text-slate-400">{r.phone || '—'}</p>
                        </td>
                        {/* Block/Lot */}
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-700">{buildBlockLot(r.block, r.lot) || '—'}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[100px]">{r.street || ''}</p>
                        </td>
                        {/* Type */}
                        <td className="px-5 py-4 text-sm text-slate-500 capitalize">{r.resident_type || '—'}</td>
                        {/* Status — uses shared StatusBadge */}
                        <td className="px-5 py-4"><StatusBadge status={st} /></td>
                        {/* Joined */}
                        <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => {
                                const ownerName = r.owner_id
                                  ? (residents.find(x => x.id === r.owner_id)?.full_name || null)
                                  : null;
                                const tenantNames = residents
                                  .filter(x => x.owner_id === r.id)
                                  .map(x => x.full_name || x.username)
                                  .filter(Boolean);
                                setViewProfile({ ...r, ownerName, tenantNames });
                              }}
                              title="View" className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"><Eye size={15} /></button>

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
            <PaginationBar page={resPage} totalPages={resTotalPages} setPage={setResPage} total={filtered.length} rowsPerPage={5} />
          )}
      </div>

      {/* ── Divider + Account Approval — president only ── */}
      {isPresident && (
        <>
          <div className="flex items-center gap-4 pt-2">
            <div className="flex-1 h-px bg-slate-200" />
            <div className="flex items-center gap-2 px-4 py-2 bg-[#006837]/10 border border-[#006837]/20 rounded-full">
              <UserCheck size={14} className="text-[#006837]" />
              <span className="text-xs font-black text-[#006837] uppercase tracking-wider">Account Approval</span>
            </div>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <AccountApproval embedded={true} onDataChange={fetchResidents} />
        </>
      )}
    </div>
  );
};

export default ResidentManage;