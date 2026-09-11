import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseAdmin';
import {
  Search, X, CheckCircle2, AlertCircle,
  RefreshCw, Calendar, Clock, Users, Eye, MapPin,
} from 'lucide-react';

// ─── Helpers ────
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const fmtTime = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
};

const statusCfg = {
  pending:           { label: 'Pending',          badge: 'bg-amber-50 text-amber-700 border-amber-200',           dot: 'bg-amber-400'   },
  approved:          { label: 'Approved',         badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',     dot: 'bg-emerald-400' },
  'approved and paid':{ label: 'Approved & Paid', badge: 'bg-blue-50 text-blue-700 border-blue-200',             dot: 'bg-blue-400'    },
  completed:         { label: 'Completed',        badge: 'bg-[#006837]/10 text-[#006837] border-[#006837]/20',    dot: 'bg-[#006837]'   },
  rejected:          { label: 'Rejected',         badge: 'bg-red-50 text-red-600 border-red-200',                 dot: 'bg-red-400'     },
  cancelled:         { label: 'Cancelled',        badge: 'bg-slate-100 text-slate-500 border-slate-200',          dot: 'bg-slate-300'   },
};

const StatusBadge = ({ status }) => {
  const s   = (status || '').toLowerCase();
  const cfg = statusCfg[s] || { label: status || '—', badge: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-300' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Toast ───
const Toast = ({ toast }) => {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in fade-in slide-in-from-top-4 duration-300
      ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
      {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
      <p className="text-sm font-bold">{toast.message}</p>
    </div>
  );
};

// ─── Permit Details Modal ─────
// Rendered through a portal straight to <body>: a `fixed inset-0` overlay
// nested this deep only covers the true viewport if every ancestor stays
// free of transform/filter/contain/perspective/will-change. A portal makes
// this overlay a direct child of <body>, so it's always guaranteed to be
// truly viewport-relative regardless of what's above it in the tree.
const ViewPermitModal = ({ permit, onClose }) => {
  if (!permit) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900">Court Permit Details</h2>
            <p className="text-xs text-slate-400 mt-0.5">{permit.profiles?.full_name || 'Unknown Resident'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Permit info */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Calendar, label: 'Date',       value: fmtDate(permit.date)                           },
              { icon: Clock,    label: 'Start Time',  value: fmtTime(permit.start_time)                    },
              { icon: Clock,    label: 'End Time',    value: fmtTime(permit.end_time)                      },
            ].map(f => (
              <div key={f.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <f.icon size={13} className="text-[#006837]" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</p>
                </div>
                <p className="text-sm font-bold text-slate-800">{f.value}</p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={13} className="text-[#006837]" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
            </div>
            <p className="text-sm font-bold text-slate-800">
              {[permit.profiles?.block, permit.profiles?.lot, permit.profiles?.street].filter(Boolean).join(', ') || '—'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={permit.status} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 shrink-0 border-t border-slate-100 pt-4">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Main Page ───
const CourtPermit = () => {
  const [reservations,  setReservations]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [viewPermit,    setViewPermit]    = useState(null);
  const [toast,         setToast]         = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // ── Fetch — only Covered Court reservations ───
  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      // First get the facility id for covered court
      const { data: facilities } = await supabase
        .from('facilities')
        .select('id, name')
        .ilike('name', '%court%');

      const courtIds = (facilities || []).map(f => f.id);

      let query = supabase
        .from('reservations')
        .select(`
          *,
          facilities ( id, name ),
          profiles!user_id ( full_name, email, block, lot, street )
        `)
        .order('date', { ascending: false });

      // Filter to court reservations only if we found any
      if (courtIds.length > 0) {
        query = query.in('facility_id', courtIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReservations(data || []);
    } catch (e) {
      showToast('Failed to load permits: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // ── Filter ────
  const filtered = reservations.filter(r => {
    const name  = (r.profiles?.full_name || '').toLowerCase();
    const fname = (r.facilities?.name    || '').toLowerCase();
    const term  = search.toLowerCase();
    const matchSearch  = !term || name.includes(term) || fname.includes(term);
    const matchStatus  = statusFilter === 'all' || (r.status || '').toLowerCase() === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = reservations.reduce((acc, r) => {
    const s = (r.status || 'pending').toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">
      <Toast toast={toast} />

      {/* View modal */}
      {viewPermit && (
        <ViewPermitModal
          permit={viewPermit}
          onClose={() => setViewPermit(null)}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users size={22} className="text-[#006837]" />
            Court Permits
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Covered Court reservation permits — Sports Committee
          </p>
        </div>
        <button onClick={fetchReservations} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Permits',   value: reservations.length, icon: Calendar, bg: 'bg-slate-100',    color: 'text-slate-600'    },
          { title: 'Approved',        value: counts.approved || 0,icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { title: 'Pending',         value: counts.pending || 0, icon: AlertCircle, bg: 'bg-amber-50',  color: 'text-amber-600'   },
          { title: 'Completed',       value: counts.completed || 0, icon: Users,    bg: 'bg-[#006837]/10', color: 'text-[#006837]'   },
        ].map(k => (
          <div key={k.title} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k.title}</p>
                <p className="text-3xl font-black text-slate-900">{k.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${k.bg}`}><k.icon size={18} className={k.color} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search resident or facility…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/30 focus:border-[#006837] transition-all" />
          </div>
          {/* Status filter pills */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap ml-auto">
            {['all','pending','approved','completed','rejected'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap capitalize
                  ${statusFilter === s ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {s === 'all' ? `All (${reservations.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s] || 0})`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium animate-pulse">Loading permits…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Calendar size={36} className="text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-400">No court permits found</p>
              <p className="text-xs text-slate-300 mt-1">Court reservations will appear here once submitted by residents</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Resident','Facility','Blk','Lot','Street','Date','Time Slot','Status','Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Resident */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-slate-800">{r.profiles?.full_name || '—'}</p>
                      </td>
                      {/* Facility */}
                      <td className="px-5 py-4 text-sm text-slate-600">{r.facilities?.name || '—'}</td>
                      {/* Blk */}
                      <td className="px-5 py-4 text-sm text-slate-600">{r.profiles?.block || '—'}</td>
                      {/* Lot */}
                      <td className="px-5 py-4 text-sm text-slate-600">{r.profiles?.lot || '—'}</td>
                      {/* Street */}
                      <td className="px-5 py-4 text-sm text-slate-600">{r.profiles?.street || '—'}</td>
                      {/* Date */}
                      <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                      {/* Time */}
                      <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {fmtTime(r.start_time)} – {fmtTime(r.end_time)}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => setViewPermit(r)} title="View Details"
                            className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer transition-colors">
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{filtered.length} permit{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourtPermit;
