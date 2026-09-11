import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseAdmin';
import {
  ShieldCheck, Search, RefreshCw, AlertTriangle,
  CheckCircle2, Info, AlertCircle, Download,
  ChevronDown, ChevronUp, Filter, Clock,
  LogIn, LogOut, Edit2, Trash2, UserCheck,
  UserX, CreditCard, FileText, Megaphone,
  Vote, BarChart3, Key, Activity, Eye, X,
  User, UserCircle2,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Plain-language labels so a non-technical reader (e.g. the HOA president)
// immediately knows whether a log needs their attention.
const SEVERITY_CONFIG = {
  info: {
    label:   'Routine',
    helper:  'A normal, everyday action. No action needed on your part.',
    bg:     'bg-emerald-50',
    text:   'text-emerald-700',
    border: 'border-emerald-100',
    dot:    'bg-emerald-400',
    icon:   CheckCircle2,
  },
  warning: {
    label:   'Needs Attention',
    helper:  'Worth a quick look when you get the chance — not urgent.',
    bg:     'bg-amber-50',
    text:   'text-amber-700',
    border: 'border-amber-100',
    dot:    'bg-amber-400',
    icon:   AlertTriangle,
  },
  danger: {
    label:   'Critical',
    helper:  'An important event — please review this as soon as possible.',
    bg:     'bg-red-50',
    text:   'text-red-700',
    border: 'border-red-100',
    dot:    'bg-red-400',
    icon:   AlertCircle,
  },
};

// Turns codes like "ADD_PAYABLE" or "REVIEW_DELINQUENT_ACCOUNT" into
// readable text ("Add Payable"). Leaves already-readable strings untouched.
const humanizeActivity = (activity = '') => {
  if (!activity) return '—';
  if (!activity.includes('_') && activity !== activity.toUpperCase()) return activity;
  return activity
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Map activity keywords → icon
const activityIcon = (activity = '') => {
  const a = activity.toLowerCase();
  if (a.includes('login') || a.includes('logged in') || a.includes('access granted'))  return LogIn;
  if (a.includes('logout') || a.includes('logged out') || a.includes('sign out'))       return LogOut;
  if (a.includes('password') || a.includes('reset'))                                    return Key;
  if (a.includes('approve') || a.includes('approved'))                                  return UserCheck;
  if (a.includes('reject') || a.includes('denied') || a.includes('revoke'))             return UserX;
  if (a.includes('payment') || a.includes('void') || a.includes('transaction'))         return CreditCard;
  if (a.includes('report') || a.includes('resident') || a.includes('update'))           return FileText;
  if (a.includes('announcement'))                                                        return Megaphone;
  if (a.includes('election') || a.includes('vote'))                                     return Vote;
  if (a.includes('delete') || a.includes('remove'))                                     return Trash2;
  if (a.includes('edit') || a.includes('modify'))                                       return Edit2;
  if (a.includes('statistic') || a.includes('report'))                                  return BarChart3;
  return Activity;
};

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const extractRole = (details = '') => {
  const m = details.match(/^\[([A-Z_]+)\]/);
  return m ? m[1].toLowerCase().replace('_', ' ') : null;
};

const ROLE_BADGE = {
  super_admin:    'bg-purple-100 text-purple-700',
  president:      'bg-green-100 text-green-700',
  'vice president': 'bg-teal-100 text-teal-700',
  vice_president: 'bg-teal-100 text-teal-700',
  secretary:      'bg-blue-100 text-blue-700',
  treasurer:      'bg-amber-100 text-amber-700',
  auditor:        'bg-orange-100 text-orange-700',
  board_member:   'bg-slate-100 text-slate-600',
  'board member': 'bg-slate-100 text-slate-600',
  owner:          'bg-cyan-100 text-cyan-700',
  tenant:         'bg-pink-100 text-pink-700',
};

const stripRolePrefix = (details = '') => details.replace(/^\[[A-Z_]+\]\s*/, '');

// Long, spelled-out date/time for the detail view — easier to read at a
// glance than the compact "Sep 11, 2026 03:45:12 PM" used in the table.
const formatFullDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    + ' at ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
};

const PAGE_SIZE = 25;

// ─── Log Detail Modal ──────────────────────────────────────────────────────────
// Landscape, two-column layout — built for a non-technical reader (e.g. the
// HOA president) to understand a log entry at a glance without needing to
// decode raw activity codes, severity levels, or role tags.

const LogDetailModal = ({ log, onClose }) => {
  if (!log) return null;

  const sev  = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
  const SevIcon = sev.icon;
  const role   = extractRole(log.details || '');
  const roleBg = ROLE_BADGE[role] || 'bg-slate-100 text-slate-600';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${sev.bg}`}>
              <SevIcon size={20} className={sev.text} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{humanizeActivity(log.activity)}</h2>
              <p className="text-sm text-slate-500">{formatFullDate(log.created_at)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

          {/* Left — Who & When */}
          <div className="p-6 space-y-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Who Did This</p>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 rounded-full shrink-0">
                <UserCircle2 size={22} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 break-all">{log.user_email || 'Unknown user'}</p>
                {role && (
                  <span className={`inline-block mt-1 text-xs font-bold px-2.5 py-1 rounded-full capitalize ${roleBg}`}>
                    {role}
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">When</p>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Clock size={15} className="text-slate-400 shrink-0" />
                {formatFullDate(log.created_at)}
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">Status</p>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border
                ${sev.bg} ${sev.text} ${sev.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                {sev.label}
              </span>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{sev.helper}</p>
            </div>
          </div>

          {/* Right — What Happened */}
          <div className="p-6 space-y-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">What Happened</p>
            <div>
              <p className="text-sm font-bold text-slate-800 mb-1.5">{humanizeActivity(log.activity)}</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                {stripRolePrefix(log.details || '') || 'No additional details were recorded for this entry.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#006837] text-white rounded-xl text-sm font-bold hover:bg-[#004d29] shadow-sm transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SystemLogs = () => {
  const [logs,        setLogs]        = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState('');
  const [sevFilter,   setSevFilter]   = useState('all');  // all | info | warning | danger
  const [roleFilter,  setRoleFilter]  = useState('all');
  const [sortDir,     setSortDir]     = useState('desc'); // desc = newest first
  const [page,        setPage]        = useState(1);
  const [viewLog,     setViewLog]     = useState(null); // log currently shown in the detail modal

  // ── Fetch all logs ──────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000); // generous cap — filter client-side
      if (err) throw err;
      setLogs(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load system logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── Filter + search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const term = search.toLowerCase().trim();

    let result = logs.filter((log) => {
      if (sevFilter !== 'all' && log.severity !== sevFilter) return false;
      if (roleFilter === 'owners_tenants') {
        const role = extractRole(log.details || '');
        if (role !== 'owner' && role !== 'tenant') return false;
      } else if (roleFilter !== 'all') {
        const role = extractRole(log.details || '');
        if (role !== roleFilter.replace('_', ' ')) return false;
      }
      if (!term) return true;
      return (
        (log.user_email  || '').toLowerCase().includes(term) ||
        (log.activity    || '').toLowerCase().includes(term) ||
        (log.details     || '').toLowerCase().includes(term)
      );
    });

    // Sort
    result = [...result].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });

    setFiltered(result);
    setPage(1);
  }, [logs, search, sevFilter, roleFilter, sortDir]);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = logs.reduce((acc, l) => {
    acc[l.severity] = (acc[l.severity] || 0) + 1;
    return acc;
  }, { info: 0, warning: 0, danger: 0 });

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    const header = ['Timestamp', 'User Email', 'Activity', 'Severity', 'Details'];
    const rows   = filtered.map((l) => [
      formatDate(l.created_at),
      l.user_email  || '',
      l.activity    || '',
      l.severity    || '',
      (l.details    || '').replace(/,/g, ';'),
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `system_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck size={22} className="text-[#006837]" />
            System Audit Logs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            A record of every action taken across the system — who did what, and when.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006837] text-white rounded-xl text-sm font-semibold hover:bg-[#004d29] shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Logs',     value: logs.length,    color: 'text-slate-900',   bg: 'bg-slate-100',  icon: Activity },
          { label: 'Routine',        value: counts.info,    color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
          { label: 'Needs Attention',value: counts.warning, color: 'text-amber-700',   bg: 'bg-amber-50',   icon: AlertTriangle },
          { label: 'Critical',       value: counts.danger,  color: 'text-red-700',     bg: 'bg-red-50',     icon: AlertCircle },
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

          {/* Severity tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {['all', 'info', 'warning', 'danger'].map((s) => (
              <button
                key={s}
                onClick={() => setSevFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer
                  ${sevFilter === s ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {s === 'all' ? `All (${logs.length})` : `${SEVERITY_CONFIG[s].label} (${counts[s] || 0})`}
              </button>
            ))}
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="president">President</option>
            <option value="vice_president">Vice President</option>
            <option value="secretary">Secretary</option>
            <option value="treasurer">Treasurer</option>
            <option value="auditor">Auditor</option>
            <option value="board_member">Board Member</option>
            <option value="owners_tenants">Owners &amp; Tenants</option>
            <option value="owner">Owners Only</option>
            <option value="tenant">Tenants Only</option>
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
              placeholder="Search email, activity, details…"
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
              <p className="text-sm text-slate-400 font-medium animate-pulse">Loading audit logs…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle size={32} className="text-amber-400 mb-2" />
              <p className="text-sm font-semibold text-slate-600 mb-3">{error}</p>
              <button onClick={fetchLogs} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl cursor-pointer">
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock size={36} className="mb-2" />
              <p className="text-sm font-semibold text-slate-500">
                {search || sevFilter !== 'all' || roleFilter !== 'all'
                  ? 'No logs match your filters'
                  : 'No logs recorded yet'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Date & Time', 'User', 'Role', 'Action', 'Status', 'Details', ''].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((log) => {
                  const sev     = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
                  const Icon    = activityIcon(log.activity);
                  const role    = extractRole(log.details || '');
                  const roleBg  = ROLE_BADGE[role] || 'bg-slate-100 text-slate-600';

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setViewLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          {formatDate(log.created_at)}
                        </div>
                      </td>

                      {/* User */}
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-700 truncate max-w-[180px]">
                          {log.user_email || '—'}
                        </p>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        {role && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${roleBg}`}>
                            {role}
                          </span>
                        )}
                      </td>

                      {/* Activity */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Icon size={15} className="text-slate-400 shrink-0" />
                          <span className="text-sm font-semibold text-slate-700 truncate max-w-[180px]">
                            {humanizeActivity(log.activity)}
                          </span>
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border
                          ${sev.bg} ${sev.text} ${sev.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                          {sev.label}
                        </span>
                      </td>

                      {/* Details (truncated) */}
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-slate-600 truncate max-w-[220px]">
                          {stripRolePrefix(log.details || '—')}
                        </p>
                      </td>

                      {/* View */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewLog(log); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 group-hover:bg-[#006837] group-hover:text-white text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          <Eye size={13} />
                          View
                        </button>
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
              </span> of <span className="font-bold text-slate-600">{filtered.length}</span> logs
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
              {filtered.length} log{filtered.length !== 1 ? 's' : ''} shown
              {(search || sevFilter !== 'all' || roleFilter !== 'all') && ` (filtered from ${logs.length} total)`}
            </p>
          </div>
        )}
      </div>

      <LogDetailModal log={viewLog} onClose={() => setViewLog(null)} />
    </div>
  );
};

export default SystemLogs;
