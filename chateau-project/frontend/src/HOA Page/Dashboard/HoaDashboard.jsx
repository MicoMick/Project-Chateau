import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseAdmin';
import {
  Calendar, CreditCard, Vote, Users, Megaphone,
  ArrowRight, TrendingUp, Clock, AlertCircle,
  CheckCircle2, Activity, Bell, LayoutDashboard,
  ShieldCheck, ClipboardList
} from 'lucide-react';

const RequireRole = ({ userRole, allowedRoles, children }) => {
  if (allowedRoles.includes(userRole) || userRole === 'super_admin') return children;
  return null;
};

// ─── Notification visibility — mirrors the role gates in Sidebar.jsx ─────────
const NOTIF_ROLES = {
  approvals:    ['president'],
  clearances:   ['president', 'treasurer'],
  reservations: ['president', 'vice_president', 'secretary', 'treasurer', 'board_member'],
  reports:      ['president', 'vice_president', 'secretary', 'board_member'],
};

// ─── Design tokens ─────────────────────────────────────────────
const BRAND = '#006837';

const STATUS_PILL = {
  Approved:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  approved:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  Pending:     'bg-amber-50 text-amber-700 border border-amber-100',
  pending:     'bg-amber-50 text-amber-700 border border-amber-100',
  Rejected:    'bg-red-50 text-red-600 border border-red-100',
  rejected:    'bg-red-50 text-red-600 border border-red-100',
  Resolved:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  'In Progress':'bg-blue-50 text-blue-700 border border-blue-100',
  'On Hold':   'bg-slate-100 text-slate-600 border border-slate-200',
  paid:        'bg-emerald-50 text-emerald-700 border border-emerald-100',
  overdue:     'bg-red-50 text-red-600 border border-red-100',
  unpaid:      'bg-amber-50 text-amber-700 border border-amber-100',
};

// ─── Sub-components ────────────────────────────────────────────

const KpiCard = ({ title, value, icon: Icon, iconBg, iconColor, trend }) => (
  <div
    className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3 flex-1 min-w-[180px]"
  >
    <div className="flex items-start justify-between">
      <div className={`p-2.5 rounded-xl ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      {trend != null && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1
          ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          <TrendingUp size={9} /> {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{title}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
    </div>
  </div>
);

const SectionCard = ({ title, linkText, onLink, children, empty, emptyMsg }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
      <h4 className="text-sm font-bold text-slate-700">{title}</h4>
      {linkText && (
        <button
          onClick={onLink}
          className="flex items-center gap-1 text-xs font-bold text-[#006837] hover:underline cursor-pointer"
        >
          {linkText} <ArrowRight size={12} />
        </button>
      )}
    </div>
    <div className="divide-y divide-slate-50">
      {empty ? (
        <div className="py-10 flex flex-col items-center text-slate-300 gap-2">
          <Activity size={28} />
          <p className="text-sm text-slate-400">{emptyMsg || 'No data available'}</p>
        </div>
      ) : children}
    </div>
  </div>
);

const StatusPill = ({ status }) => (
  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap
    ${STATUS_PILL[status] || 'bg-slate-100 text-slate-500'}`}>
    {status}
  </span>
);

const NotificationBell = ({ notifications, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalCount = notifications.reduce((sum, n) => sum + n.count, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <Bell size={18} className="text-[#006837]" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex">
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
            <span className="relative min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black shadow ring-2 ring-white">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-5 py-4 border-b border-slate-50">
            <h4 className="text-sm font-bold text-slate-700">Notifications</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalCount > 0 ? `${totalCount} item${totalCount !== 1 ? 's' : ''} need your attention` : 'You\'re all caught up'}
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-10 flex flex-col items-center text-slate-300 gap-2">
                <Bell size={24} />
                <p className="text-sm text-slate-400">No notifications available</p>
              </div>
            ) : notifications.map((n) => (
              <button
                key={n.key}
                onClick={() => { setOpen(false); onSelect(n.path); }}
                className={`relative w-full flex items-center gap-3 px-5 py-3.5 transition-colors text-left cursor-pointer
                  ${n.count > 0 ? 'bg-amber-50/50 hover:bg-amber-50 border-l-4 border-l-amber-400' : 'hover:bg-slate-50/60 border-l-4 border-l-transparent'}`}
              >
                <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.iconBg}`}>
                  <n.icon size={16} className={n.iconColor} />
                  {n.count > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm truncate ${n.count > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{n.label}</p>
                  <p className="text-xs text-slate-400 truncate">{n.desc}</p>
                </div>
                {n.count > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white shrink-0">
                    {n.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const HoaDashboard = () => {
  const navigate = useNavigate();
  const [liveReports,        setLiveReports]        = useState([]);
  const [liveAnnouncements,  setLiveAnnouncements]  = useState([]);
  const [liveElections,      setLiveElections]      = useState([]);
  const [liveReservations,   setLiveReservations]   = useState([]);
  const [totalResidents,     setTotalResidents]     = useState(0);
  const [totalReports,       setTotalReports]       = useState(0);
  const [livePayments,       setLivePayments]       = useState([]);
  const [overdueCount,       setOverdueCount]       = useState(0);
  const [isLoading,          setIsLoading]          = useState(true);
  const [pendingApprovals,   setPendingApprovals]   = useState(0);
  const [pendingClearances,  setPendingClearances]  = useState(0);
  const [pendingReservations,setPendingReservations]= useState(0);
  const [pendingReports,     setPendingReports]     = useState(0);

  const currentUserRole = sessionStorage.getItem('userRole') || 'resident';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchLiveReports(), fetchLiveAnnouncements(), fetchLiveElections(),
        fetchLiveReservations(), fetchTotalResidents(), fetchTotalReports(), fetchLivePayments(), fetchOverdueCount(),
        fetchPendingApprovals(), fetchPendingClearances(), fetchPendingReservations(), fetchPendingReports()
      ]);
      setIsLoading(false);
    };
    load();
  }, []);

  const fetchLiveReports = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(5);
    setLiveReports(data || []);
  };
  const fetchLiveAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(4);
    setLiveAnnouncements(data || []);
  };
  const fetchLiveElections = async () => {
    const { data } = await supabase.from('elections').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (data) {
      const withCounts = await Promise.all(data.map(async (el) => {
        const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('election_id', el.id);
        return { ...el, actual_votes: count || 0 };
      }));
      setLiveElections(withCounts);
    }
  };
  const fetchLiveReservations = async () => {
    const { data } = await supabase.from('reservations').select('*, facilities(name), profiles(full_name)').order('date', { ascending: false }).limit(5);
    setLiveReservations(data || []);
  };
  const fetchTotalResidents = async () => {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    setTotalResidents(count || 0);
  };
  const fetchTotalReports = async () => {
    const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true });
    setTotalReports(count || 0);
  };
  const fetchOverdueCount = async () => {
    const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true }).ilike('status', 'overdue');
    setOverdueCount(count || 0);
  };
  const fetchPendingApprovals = async () => {
    const { count } = await supabase.from('approval_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    setPendingApprovals(count || 0);
  };
  const fetchPendingClearances = async () => {
    const { count } = await supabase.from('move_in_clearances').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    setPendingClearances(count || 0);
  };
  const fetchPendingReservations = async () => {
    const { count } = await supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
    setPendingReservations(count || 0);
  };
  const fetchPendingReports = async () => {
    const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
    setPendingReports(count || 0);
  };
  const fetchLivePayments = async () => {
    const { data: pData } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(5);
    if (!pData?.length) { setLivePayments([]); return; }
    const ids = [...new Set(pData.map(p => p.user_id).filter(Boolean))];
    let profiles = [];
    if (ids.length) {
      const { data: pr } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      profiles = pr || [];
    }
    setLivePayments(pData.map(p => ({ ...p, profiles: profiles.find(pr => pr.id === p.user_id) || null })));
  };

  const go = (path) => navigate(`/hoa/${path}`);

  const canSeeNotif = (key) =>
    currentUserRole === 'super_admin' || NOTIF_ROLES[key].includes(currentUserRole);

  const notifications = [
    {
      key: 'approvals', path: 'pending-approvals', label: 'Pending Approval',
      desc: pendingApprovals > 0 ? `${pendingApprovals} request${pendingApprovals !== 1 ? 's' : ''} awaiting review` : 'No pending requests',
      icon: ShieldCheck, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', count: pendingApprovals,
    },
    {
      key: 'clearances', path: 'move-in-clearances', label: 'Move In / Move Out Clearance',
      desc: pendingClearances > 0 ? `${pendingClearances} clearance${pendingClearances !== 1 ? 's' : ''} awaiting review` : 'No pending clearances',
      icon: ClipboardList, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', count: pendingClearances,
    },
    {
      key: 'reservations', path: 'reservations', label: 'Reservation Management',
      desc: pendingReservations > 0 ? `${pendingReservations} reservation${pendingReservations !== 1 ? 's' : ''} awaiting review` : 'No pending reservations',
      icon: Calendar, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', count: pendingReservations,
    },
    {
      key: 'reports', path: 'reports', label: 'Resident Reports',
      desc: pendingReports > 0 ? `${pendingReports} report${pendingReports !== 1 ? 's' : ''} awaiting review` : 'No pending reports',
      icon: AlertCircle, iconBg: 'bg-orange-50', iconColor: 'text-orange-500', count: pendingReports,
    },
  ].filter(n => canSeeNotif(n.key));

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
        <p className="text-[#006837] font-semibold animate-pulse text-sm">Loading Dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <LayoutDashboard size={22} className="text-[#006837]" /> Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Here's what's happening in your community today.</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end gap-2">
            <p className="text-sm font-semibold text-[#006837] bg-[#006837]/10 rounded-full px-3 py-1.5 w-fit">{greeting}!</p>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 bg-white border border-slate-100 shadow-sm rounded-full px-3 py-1.5 w-fit">
              <Calendar size={14} className="text-[#006837]" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <NotificationBell notifications={notifications} onSelect={go} />
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="flex flex-wrap gap-4">
        <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','auditor']}>
          <KpiCard title="Reservations" value={liveReservations.length} icon={Calendar}
            iconBg="bg-blue-50" iconColor="text-blue-600" />
        </RequireRole>
        <RequireRole userRole={currentUserRole} allowedRoles={['president','treasurer','auditor']}>
          <KpiCard title="Overdue Payments" value={overdueCount} icon={CreditCard}
            iconBg="bg-red-50" iconColor="text-red-500" />
        </RequireRole>
        <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','auditor']}>
          <KpiCard title="Total Resident Reports" value={totalReports} icon={AlertCircle}
            iconBg="bg-orange-50" iconColor="text-orange-500" />
        </RequireRole>
        <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','auditor']}>
          <KpiCard title="Total Residents" value={totalResidents} icon={Users}
            iconBg="bg-purple-50" iconColor="text-purple-600" />
        </RequireRole>
      </div>

      {/* ── Content Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Left */}
        <div className="space-y-6">

          {/* Reservations */}
          <SectionCard
            title="Recent Reservations"
            linkText="View all"
            onLink={() => go('reservations')}
            empty={liveReservations.length === 0}
            emptyMsg="No reservations yet"
          >
            {liveReservations.map((item) => (
              <div key={item.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Calendar size={14} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.profiles?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400 truncate">{item.facilities?.name} • {item.date}</p>
                  </div>
                </div>
                <StatusPill status={item.status} />
              </div>
            ))}
          </SectionCard>

          {/* Reports */}
          <SectionCard
            title="Resident Reports"
            linkText="View all"
            onLink={() => go('reports')}
            empty={liveReports.length === 0}
            emptyMsg="No reports submitted"
          >
            {liveReports.map((item) => (
              <div key={item.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <AlertCircle size={14} className="text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.description}</p>
                    <p className="text-xs text-slate-400">
                      {item.category} • {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <StatusPill status={item.status} />
              </div>
            ))}
          </SectionCard>
        </div>

        {/* Right */}
        <div className="space-y-6">

          {/* Payments */}
          <RequireRole userRole={currentUserRole} allowedRoles={['president','treasurer','auditor','board_member']}>
            <SectionCard
              title="Recent Payments"
              linkText="View all"
              onLink={() => go('payments')}
              empty={livePayments.length === 0}
              emptyMsg="No payment records"
            >
              {livePayments.map((item) => {
                const status = (item.status || 'unpaid').toLowerCase();
                return (
                  <div key={item.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <CreditCard size={14} className="text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {item.profiles?.full_name || 'Unknown Resident'}
                        </p>
                        <p className="text-xs text-slate-400">
                          ₱{Number(item.amount || 0).toLocaleString()} • Due {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={status} />
                  </div>
                );
              })}
            </SectionCard>
          </RequireRole>

          {/* Announcements */}
          <SectionCard
            title="Recent Announcements"
            linkText="View all"
            onLink={() => go('announcements')}
            empty={liveAnnouncements.length === 0}
            emptyMsg="No announcements published"
          >
            {liveAnnouncements.map((item) => (
              <div key={item.id}
                className={`px-5 py-4 flex items-start gap-3 hover:bg-slate-50/60 transition-colors
                  ${item.is_emergency ? 'border-l-2 border-red-400' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                  ${item.is_emergency ? 'bg-red-50' : 'bg-[#006837]/10'}`}>
                  <Megaphone size={14} className={item.is_emergency ? 'text-red-500' : 'text-[#006837]'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold truncate ${item.is_emergency ? 'text-red-800' : 'text-slate-800'}`}>
                    {item.title}
                    {item.is_emergency && (
                      <span className="ml-2 text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        Urgent
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(item.created_at).toLocaleDateString()} • {item.category}
                  </p>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* Active Elections — informational only for everyone here. Only
              Elecom manages elections (see ACCESS.ELECTIONS in App.jsx), so
              this card has no "Manage" link/shortcut into /hoa/elections —
              that page is Elecom-exclusive, not something any other HOA
              officer (including President) should be able to jump into. */}
          {liveElections.length > 0 && (
            <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','auditor','board_member']}>
              <SectionCard title="Active Elections">
                {liveElections.map((el) => (
                  <div key={el.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Vote size={14} className="text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{el.title}</p>
                        <p className="text-xs text-slate-400">
                          {el.actual_votes} vote{el.actual_votes !== 1 ? 's' : ''} • Ends {el.end_date}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      ACTIVE
                    </span>
                  </div>
                ))}
              </SectionCard>
            </RequireRole>
          )}
        </div>
      </div>
    </div>
  );
};

export default HoaDashboard;
