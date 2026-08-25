import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseAdmin';
import { logAudit } from '../../auditLogger';
import {
  Users, Search, RefreshCw, Key, CheckCircle2,
  AlertTriangle, X, UserPlus, UserCheck, Clock,
  Eye, EyeOff,
} from 'lucide-react';

// ─── Password strength helper ─────────────────────────────────────────────────
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '', bar: '' };
  let score = 0;
  if (pw.length >= 8)           score += 25;
  if (pw.length >= 12)          score += 10;
  if (/[A-Z]/.test(pw))         score += 20;
  if (/[0-9]/.test(pw))         score += 20;
  if (/[^A-Za-z0-9]/.test(pw))  score += 25;
  if (score < 30)  return { score,       label: 'Weak',   color: 'text-red-500',    bar: 'bg-red-400'     };
  if (score < 60)  return { score,       label: 'Fair',   color: 'text-amber-500',  bar: 'bg-amber-400'   };
  if (score < 80)  return { score,       label: 'Good',   color: 'text-blue-500',   bar: 'bg-blue-400'    };
                   return { score: 100,  label: 'Strong', color: 'text-emerald-500',bar: 'bg-emerald-500'  };
};

const fullName = (p) =>
  [p.first_name, p.middle_initial ? p.middle_initial + '.' : '', p.last_name]
    .filter(Boolean).join(' ') || p.username || p.email || 'Unknown';

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const Toast = ({ toast }) => {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border
      animate-in fade-in slide-in-from-top-4 duration-300
      ${toast.type === 'success'
        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
        : 'bg-red-50 border-red-100 text-red-800'}`}>
      {toast.type === 'success'
        ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
        : <AlertTriangle size={18} className="text-red-500 shrink-0" />}
      <p className="text-sm font-bold">{toast.message}</p>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, iconBg, iconColor }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-900">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}><Icon size={20} className={iconColor} /></div>
    </div>
  </div>
);

const PasswordModal = ({ resident, onClose, onSuccess }) => {
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const strength = getStrength(newPassword);
  const mismatch = confirmPassword && newPassword !== confirmPassword;
  const canSubmit = newPassword && strength.score >= 60 && newPassword === confirmPassword;

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8)          { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword)  { setError('Passwords do not match.'); return; }
    if (strength.score < 60)             { setError('Password is too weak. Aim for at least Fair strength.'); return; }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('reset-resident-password', {
        body: { residentId: resident.id, newPassword },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      await logAudit('RESET_RESIDENT_PASSWORD', `Super Admin reset password for resident: ${fullName(resident)} (${resident.email})`, 'info');
      onSuccess(`Password reset successfully for ${fullName(resident)}.`);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
      await logAudit('RESET_RESIDENT_PASSWORD_FAILED', `Failed to reset password for resident: ${fullName(resident)} — ${err.message}`, 'warning');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all pr-11";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Key size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Reset Password</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{fullName(resident)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleReset} className="px-6 py-5 space-y-4">

          {/* New password */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters" required className={inputCls} />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength bar */}
            {newPassword && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-1 mr-3">
                    {[25, 50, 75, 100].map((threshold, i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300
                        ${strength.score >= threshold ? strength.bar : 'bg-slate-100'}`} />
                    ))}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${strength.color}`}>
                    {strength.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Use 12+ chars, uppercase, numbers, and symbols for a strong password.
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password" required className={inputCls} />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mismatch && (
              <p className="text-[10px] font-bold text-red-500 uppercase mt-1.5">Passwords do not match</p>
            )}
            {confirmPassword && !mismatch && (
              <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1.5">✓ Passwords match</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
              <AlertTriangle size={14} className="shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !canSubmit}
              title={
                !newPassword           ? 'Enter a new password'              :
                strength.score < 60    ? "Password must be at least 'Fair'"  :
                mismatch               ? 'Passwords must match'              : ''
              }
              className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
              {loading ? <><RefreshCw size={13} className="animate-spin" /> Resetting…</> : <><Key size={13} /> Reset Password</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Residents = () => {
  const [searchParams]                      = useSearchParams();
  const [residents,      setResidents]      = useState([]);
  const [filtered,       setFiltered]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState(() => searchParams.get('q') || '');
  const [selectedStreet, setSelectedStreet] = useState('All');
  const [pwTarget,       setPwTarget]       = useState(null);
  const [toast,          setToast]          = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setResidents(data || []);
    } catch (e) {
      showToast('Failed to load residents: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResidents(); }, [fetchResidents]);

  // Deep link from the Super Admin notification bell — jump straight to
  // that resident's password-reset modal once the list has loaded.
  useEffect(() => {
    const q = searchParams.get('q');
    if (!q || residents.length === 0 || pwTarget) return;
    const match = residents.find(r => (r.email || '').toLowerCase() === q.toLowerCase());
    if (match) setPwTarget(match);
  }, [searchParams, residents, pwTarget]);

  const uniqueStreets = [...new Set(residents.map(r => r.street).filter(Boolean))].sort();

  useEffect(() => {
    const term = search.toLowerCase().trim();
    let result = residents;
    if (selectedStreet !== 'All') result = result.filter(r => r.street === selectedStreet);
    if (term) result = result.filter(r =>
      fullName(r).toLowerCase().includes(term) ||
      (r.email    || '').toLowerCase().includes(term) ||
      (r.username || '').toLowerCase().includes(term) ||
      (r.block    || '').toLowerCase().includes(term) ||
      (r.lot      || '').toLowerCase().includes(term)
    );
    setFiltered(result);
  }, [residents, search, selectedStreet]);

  const now          = new Date();
  const newThisMonth = residents.filter(r => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const activeCount  = residents.filter(r => r.account_status === 'active').length;
  const pendingCount = residents.filter(r => r.account_status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <Toast toast={toast} />

      {pwTarget && (
        <PasswordModal
          resident={pwTarget}
          onClose={() => setPwTarget(null)}
          onSuccess={msg => showToast(msg, 'success')}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users size={22} className="text-[#006837]" />
            Resident Profiles
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">View all registered residents and reset passwords</p>
        </div>
        <button onClick={fetchResidents} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-all cursor-pointer disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Residents" value={residents.length} icon={Users}     iconBg="bg-blue-50"    iconColor="text-blue-600"    />
        <StatCard title="Active"          value={activeCount}      icon={UserCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="Pending"         value={pendingCount}     icon={Clock}     iconBg="bg-amber-50"   iconColor="text-amber-600"   />
        <StatCard title="New This Month"  value={newThisMonth}     icon={UserPlus}  iconBg="bg-purple-50"  iconColor="text-purple-600"  />
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search name, email, block…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/30 focus:border-[#006837] transition-all" />
          </div>
          <div className="w-full sm:w-auto">
            <select value={selectedStreet} onChange={e => setSelectedStreet(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/30 focus:border-[#006837] transition-all cursor-pointer">
              <option value="All">All Streets</option>
              {uniqueStreets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <p className="text-xs text-slate-400 sm:ml-auto font-medium w-full sm:w-auto text-right">
            {filtered.length} resident{filtered.length !== 1 ? 's' : ''}
          </p>
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
              <p className="text-sm font-semibold text-slate-400">
                {search || selectedStreet !== 'All' ? 'No residents match your search criteria' : 'No residents found'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {/* ✅ Removed: Contact, Block / Lot */}
                  {['Resident', 'Type', 'Status', 'Registered', 'Action'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(resident => {
                  const statusConfig = {
                    active:   { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-400', label: 'Active'   },
                    pending:  { bg: 'bg-amber-50 text-amber-700 border-amber-100',       dot: 'bg-amber-400',   label: 'Pending'  },
                    rejected: { bg: 'bg-red-50 text-red-600 border-red-100',             dot: 'bg-red-400',     label: 'Rejected' },
                  }[resident.account_status] || {
                    bg: 'bg-slate-50 text-slate-600 border-slate-100',
                    dot: 'bg-slate-300',
                    label: resident.account_status || '—',
                  };

                  return (
                    <tr key={resident.id} className="hover:bg-slate-50/80 transition-colors group">

                      {/* ── Resident — name only, no email below ── */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#006837]/80 to-[#34a853]/80 flex items-center justify-center text-white font-bold text-sm uppercase shrink-0">
                            {resident.first_name?.charAt(0) || resident.username?.charAt(0) || '?'}
                          </div>
                          {/* ✅ Name only — email sub-line removed */}
                          <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">
                            {fullName(resident)}
                          </p>
                        </div>
                      </td>

                      {/* ✅ Contact column removed */}
                      {/* ✅ Block / Lot column removed */}

                      {/* Resident Type */}
                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-600 capitalize">{resident.resident_type || '—'}</p>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusConfig.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Registered */}
                      <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                        {formatDate(resident.created_at)}
                      </td>

                      {/* Reset Password */}
                      <td className="px-5 py-4">
                        <button onClick={() => setPwTarget(resident)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-amber-100"
                          title="Reset password">
                          <Key size={13} /> Reset PW
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              {filtered.length} of {residents.length} resident{residents.length !== 1 ? 's' : ''}
              {search || selectedStreet !== 'All' ? ' (filtered)' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Residents;
