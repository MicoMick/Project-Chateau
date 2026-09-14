import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseAdmin';
import {
  KeyRound, RefreshCw, Search, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100',   dot: 'bg-amber-400',   icon: Clock       },
  resolved:  { label: 'Resolved',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-400', icon: CheckCircle2 },
  dismissed: { label: 'Dismissed', bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400',   icon: XCircle     },
};

const TYPE_BADGE = {
  owner:          'bg-cyan-100 text-cyan-700',
  tenant:         'bg-pink-100 text-pink-700',
  super_admin:    'bg-purple-100 text-purple-700',
  president:      'bg-green-100 text-green-700',
  vice_president: 'bg-teal-100 text-teal-700',
  secretary:      'bg-blue-100 text-blue-700',
  treasurer:      'bg-amber-100 text-amber-700',
  auditor:        'bg-orange-100 text-orange-700',
  board_member:   'bg-slate-100 text-slate-600',
};

const formatType = (t = '') => t.replace('_', ' ');

// The exact admin role (president, treasurer, …) for display, collapsed to
// a single 'admin' bucket for the Type filter.
const typeCategory = (r) => {
  if (r.profiles?.resident_type) return r.profiles.resident_type;
  if (r.admins?.role) return 'admin';
  return null;
};

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const PAGE_SIZE = 25;

// ─── Main Component ───────────────────────────────────────────────────────────

const PasswordResetHistory = () => {
  const [requests, setRequests] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | resolved | dismissed
  const [typeFilter,   setTypeFilter]   = useState('all'); // all | owner | tenant | admin
  const [sortDir,  setSortDir]  = useState('desc');
  const [page,     setPage]     = useState(1);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('password_reset_requests')
        .select('id, email, full_name, resident_id, admin_id, status, created_at, resolved_at, profiles:resident_id(resident_type), admins:admin_id(role)')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (err) throw err;
      setRequests(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load password reset history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Filter + search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const term = search.toLowerCase().trim();

    let result = requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && typeCategory(r) !== typeFilter) return false;
      if (!term) return true;
      return (
        (r.full_name || '').toLowerCase().includes(term) ||
        (r.email     || '').toLowerCase().includes(term)
      );
    });

    result = [...result].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });

    setFiltered(result);
    setPage(1);
  }, [requests, search, statusFilter, typeFilter, sortDir]);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, { pending: 0, resolved: 0, dismissed: 0 });

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <KeyRound size={22} className="text-[#006837]" />
            Password Reset History
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Every password reset request — residents, tenants, and admins alike.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all cursor-pointer disabled:opacity-50 self-start"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests', value: requests.length,  color: 'text-slate-900',   bg: 'bg-slate-100',  icon: KeyRound },
          { label: 'Pending',        value: counts.pending,   color: 'text-amber-700',   bg: 'bg-amber-50',   icon: Clock },
          { label: 'Resolved',       value: counts.resolved,  color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
          { label: 'Dismissed',      value: counts.dismissed, color: 'text-slate-600',   bg: 'bg-slate-100',  icon: XCircle },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
                <p className={`text-3xl font-black mt-0.5 ${k.color}`}>{k.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-xl ${k.bg}`}>
                <k.icon size={20} className={k.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 flex-wrap">

          {/* Status tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {['all', 'pending', 'resolved', 'dismissed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer
                  ${statusFilter === s ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {s === 'all' ? `All (${requests.length})` : `${STATUS_CONFIG[s].label} (${counts[s] || 0})`}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="owner">Owners</option>
            <option value="tenant">Tenants</option>
            <option value="admin">Admins</option>
          </select>

          {/* Sort toggle */}
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            {sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] ml-auto">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all"
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium animate-pulse">Loading history…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle size={32} className="text-amber-400 mb-2" />
              <p className="text-sm font-semibold text-slate-600 mb-3">{error}</p>
              <button onClick={fetchHistory} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl cursor-pointer">
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <KeyRound size={36} className="mb-2" />
              <p className="text-sm font-semibold text-slate-500">
                {search || statusFilter !== 'all' || typeFilter !== 'all' ? 'No requests match your filters' : 'No password reset requests yet'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Requested', 'Requested By', 'Type', 'Status', 'Resolved'].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((r) => {
                  const st   = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const type = r.profiles?.resident_type || r.admins?.role;
                  const typeBg = TYPE_BADGE[type] || 'bg-slate-100 text-slate-500';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Requested */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          {formatDate(r.created_at)}
                        </div>
                      </td>

                      {/* Requested By */}
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">{r.full_name || r.email || '—'}</p>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        {type ? (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${typeBg}`}>{formatType(type)}</span>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">No matching account</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>

                      {/* Resolved */}
                      <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(r.resolved_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && !error && filtered.length > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-600">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
              </span> of <span className="font-bold text-slate-600">{filtered.length}</span> requests
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = page <= 4 ? i + 1 : page - 3 + i;
                if (pg < 1 || pg > totalPages) return null;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer
                      ${pg === page ? 'bg-[#006837] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Footer count */}
        {!loading && !error && filtered.length > 0 && filtered.length <= PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {filtered.length} request{filtered.length !== 1 ? 's' : ''} shown
              {(search || statusFilter !== 'all' || typeFilter !== 'all') && ` (filtered from ${requests.length} total)`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordResetHistory;
