import React, { useState, useEffect } from 'react'; 
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, CreditCard, Vote, Megaphone,
  ScrollText, Building2,
  BarChart3, ChevronLeft, Menu, ChevronDown, ShieldCheck, UserCircle,
  LogOut, ClipboardCheck, PieChart, UserCheck, ListChecks, ClipboardList, Globe,
} from 'lucide-react';
import ChateauLogo from '../../assets/ChataueLogo.png';
import { supabase } from '../supabaseAdmin'; 

// ── Sidebar scrollbar style ──────────────────────────────────────────────────
const SidebarScrollStyle = () => (
  <style>{`
    .sidebar-scroll::-webkit-scrollbar {
      width: 4px;
    }
    .sidebar-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .sidebar-scroll::-webkit-scrollbar-thumb {
      background: transparent;
      border-radius: 99px;
      transition: background 0.2s;
    }
    .sidebar-scroll:hover::-webkit-scrollbar-thumb {
      background: rgba(0, 104, 55, 0.25);
    }
    .sidebar-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 104, 55, 0.5);
    }
    .sidebar-scroll {
      scrollbar-width: thin;
      scrollbar-color: transparent transparent;
      transition: scrollbar-color 0.2s;
    }
    .sidebar-scroll:hover {
      scrollbar-color: rgba(0, 104, 55, 0.25) transparent;
    }
  `}</style>
);



// ─── Role constants (must match App.jsx) ─────────────────────────────────────
const ROLES = {
  PRESIDENT:      'president',
  VICE_PRESIDENT: 'vice_president',
  SECRETARY:      'secretary',
  TREASURER:      'treasurer',
  AUDITOR:        'auditor',
  BOARD_MEMBER:   'board_member',
};

const GOVERNANCE  = [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY];
const OPERATIONS  = [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY];
const RESERVATIONS = [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.TREASURER, ROLES.BOARD_MEMBER]; // Reservations — treasurer manages payments/approvals too; board_member has full access
const FACILITY_MANAGEMENT = [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY]; // Facility Management — split out of Reservations; treasurer & board_member not included
const COMM_OPS    = [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.BOARD_MEMBER]; // Announcements + Reports
const ELECTIONS   = ['elecom']; // Election page — Elecom only
const PAYMENTS    = [ROLES.PRESIDENT, ROLES.TREASURER];
const STATISTICS  = [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.AUDITOR, ROLES.TREASURER];
const AUDITOR_WS  = [ROLES.AUDITOR, ROLES.TREASURER];
const APPROVALS      = [ROLES.PRESIDENT]; // President only
const COURT_PERMIT   = [ROLES.BOARD_MEMBER];  // Board Member — Sports Committee
const CLEARANCES  = [ROLES.PRESIDENT, ROLES.TREASURER]; // Move In/Out clearances
const WEBSITE_SETTINGS = [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.BOARD_MEMBER]; // Landing page content

// ─── RequireRole ──────────────────────────────────────────────────────────────
const RequireRole = ({ userRole, allowedRoles, children }) => {
  if (userRole === 'super_admin') return children;
  if (allowedRoles.includes(userRole)) return children;
  return null;
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = () => {
  const [isCollapsed,      setIsCollapsed]      = useState(true);
  const [isProfileOpen,    setIsProfileOpen]    = useState(false);
  const [isLogoutModalOpen,setIsLogoutModalOpen]= useState(false);
  const [displayName,      setDisplayName]      = useState('Admin'); 
  const [avatarUrl,        setAvatarUrl]        = useState(null); 
  const location  = useLocation();
  const navigate  = useNavigate(); 
  const [currentUserRole, setCurrentUserRole] = useState(
    localStorage.getItem('userRole') || 'resident'
  );

  useEffect(() => {
    setCurrentUserRole(localStorage.getItem('userRole') || 'resident');
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setDisplayName(user.user_metadata?.first_name || user.email?.split('@')[0] || 'Admin');
        setAvatarUrl(user.user_metadata?.avatar_url || null);
      }
    };
    getUserData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.first_name || session.user.email?.split('@')[0] || 'Admin');
        setAvatarUrl(session.user.user_metadata?.avatar_url || null);
        setCurrentUserRole(localStorage.getItem('userRole') || 'resident');
      }
    });
    return () => subscription.unsubscribe();
  }, [location]);

  const handleLogout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('system_logs').insert([{
        user_email: user.email,
        activity:   'USER_LOGGED_OUT',
        severity:   'info',
        details:    `[${currentUserRole.toUpperCase()}] Session terminated`,
      }]);
    }
    localStorage.removeItem('userRole'); 
    await supabase.auth.signOut();
    navigate('/admin'); 
  };

  // ── Menu items — each entry declares which roles can see it ──────────────────
  // The sidebar only shows what the logged-in role is allowed to use.
  const menuItems = [

    // ── Dashboard — all governance roles ──────────────────────────────────────
    {
      icon:  <LayoutDashboard size={22} />,
      label: 'Dashboard',
      path:  '/hoa/dashboard',
      allowedRoles: GOVERNANCE,
    },

    // ── Auditor workspace — auditor only ──────────────────────────────────────
    {
      icon:  <ClipboardCheck size={22} />,
      label: 'Audit Reports',
      path:  '/hoa/auditor-workspace',
      allowedRoles: AUDITOR_WS,
    },

    // ── Resident management — operational roles ────────────────────────────────
    {
      icon:  <Users size={22} />,
      label: 'Residents',
      path:  '/hoa/residents',
      allowedRoles: OPERATIONS,
    },

    // ── Pending Approvals — president only ────────────────────────────────────
    {
      icon:  <ListChecks size={22} />,
      label: 'Pending Approvals',
      path:  '/hoa/pending-approvals',
      allowedRoles: APPROVALS,
    },

    // ── Move In / Move Out Clearances — president + treasurer ─────────────────
    {
      icon:  <ClipboardList size={22} />,
      label: 'Move In / Out Clearance',
      path:  '/hoa/move-in-clearances',
      allowedRoles: CLEARANCES,
    },

    // ── Reservations ──────────────────────────────────────────────────────────
    {
      icon:  <CalendarCheck size={22} />,
      label: 'Reservations',
      path:  '/hoa/reservations',
      allowedRoles: RESERVATIONS,
    },

    // ── Facility Management — split out of Reservations ─────────────────────
    {
      icon:  <Building2 size={22} />,
      label: 'Facility Management',
      path:  '/hoa/facility-management',
      allowedRoles: FACILITY_MANAGEMENT,
    },

    // ── Payments — president + treasurer only ─────────────────────────────────
    {
      icon:  <CreditCard size={22} />,
      label: 'Payments',
      path:  '/hoa/payments',
      allowedRoles: PAYMENTS,
    },

    // ── Elections — Elecom only ───────────────────────────────────────────────
    {
      icon:  <Vote size={22} />,
      label: 'Elections',
      path:  '/hoa/elections',
      allowedRoles: ELECTIONS,
    },

    // ── Announcements ─────────────────────────────────────────────────────────
    {
      icon:  <Megaphone size={22} />,
      label: 'Announcements',
      path:  '/hoa/announcements',
      allowedRoles: COMM_OPS,
    },

    // ── Reports/Issues ────────────────────────────────────────────────────────
    {
      icon:  <BarChart3 size={22} />,
      label: 'Residents Reports',
      path:  '/hoa/reports',
      allowedRoles: COMM_OPS,
    },

    // ── Statistics ──────────────────────────────────────────────────────────
    {
      icon:  <PieChart size={22} />,
      label: 'Statistics',
      path:  '/hoa/statistics',
      allowedRoles: STATISTICS,
    },

    // ── Court Permit — board_member (Sports Committee) only ──────────────────
    {
      icon:  <ScrollText size={22} />,
      label: 'Court Permits',
      path:  '/hoa/court-permit',
      allowedRoles: COURT_PERMIT,
    },

    // ── Website Settings — landing page content ───────────────────────────────
    {
      icon:  <Globe size={22} />,
      label: 'Website Settings',
      path:  '/hoa/website-settings',
      allowedRoles: WEBSITE_SETTINGS,
    },
  ];

  // ── Role display label ───────────────────────────────────────────────────────
  const roleLabel = {
    president:      'President',
    vice_president: 'Vice President',
    secretary:      'Secretary',
    treasurer:      'Treasurer',
    auditor:        'Auditor',
    board_member:   'Board Member',
    super_admin:    'Super Admin',
    elecom:         'Elecom',
  }[currentUserRole] || currentUserRole;

  return (
    <>
      <SidebarScrollStyle />
      <aside className={`relative flex flex-col min-h-screen transition-all duration-300 ease-in-out shadow-2xl z-40
        ${isCollapsed ? 'w-20' : 'w-72'} 
        bg-gradient-to-b from-[#006837] to-[#004d29]`}>

        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[#FFF200] opacity-10 blur-[100px] pointer-events-none" />

        {/* Collapse toggle */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="absolute -right-3 top-10 bg-white text-[#006837] rounded-full p-1 shadow-md hover:scale-110 transition-transform border border-slate-200 cursor-pointer z-50"
        >
          {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* Logo */}
        <div className={`flex flex-col items-center py-10 px-4 transition-opacity duration-300
          ${isCollapsed ? 'opacity-0 invisible h-0 py-0' : 'opacity-100'}`}>
          <img src={ChateauLogo} alt="Chateau Logo" className="w-20 h-auto mb-4 drop-shadow-lg" />
          <h1 className="text-white font-black tracking-[0.2em] text-xl uppercase">CHATEAU</h1>
          <div className="h-px w-full bg-white/20 mt-6" />
        </div>

        {/* Nav */}
        <nav className={`px-3 space-y-1 flex-1 overflow-y-auto overflow-x-hidden pb-6 sidebar-scroll
          ${isCollapsed ? 'mt-16' : 'mt-4'}`}>
          {menuItems.map((item, i) => {
            const isActive = location.pathname === item.path;
            return (
              <RequireRole key={i} userRole={currentUserRole} allowedRoles={item.allowedRoles}>
                <Link
                  to={item.path}
                  title={isCollapsed ? item.label : ''}
                  className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all group
                    ${isActive
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'text-white/80 hover:text-white hover:bg-white/10'}
                    ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                >
                  <span className={`transition-transform group-hover:scale-110 shrink-0
                    ${isActive ? 'text-white' : 'text-[#FFF200]'}`}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className={`text-sm tracking-wide truncate
                      ${isActive ? 'font-bold' : 'font-semibold'}`}>
                      {item.label}
                    </span>
                  )}
                </Link>
              </RequireRole>
            );
          })}
        </nav>

        {/* Profile footer */}
        <div className="mt-auto mb-8 w-full px-3 relative z-50">
          {isProfileOpen && !isCollapsed && (
            <div className="absolute bottom-[calc(100%+16px)] left-3 right-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 z-50">
              <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account</p>
              </div>
              <div className="p-2">
                <Link to="/hoa/profile" onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all">
                  <UserCircle size={18} /> View Profile
                </Link>
                <div className="h-px bg-slate-100 my-2 mx-2" />
                <button onClick={() => setIsLogoutModalOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-all text-left cursor-pointer">
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </div>
          )}

          <div
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`bg-black/20 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3 border border-white/10
              transition-all hover:bg-white/10 cursor-pointer
              ${isCollapsed ? 'justify-center' : 'justify-between'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FFF200] to-white flex items-center justify-center text-[#006837] font-bold shadow-inner text-lg uppercase overflow-hidden">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  : displayName.charAt(0)}
              </div>
              {!isCollapsed && (
                <div className="text-left overflow-hidden">
                  <p className="text-white text-xs font-bold truncate w-32">{displayName}</p>
                  <div className="flex items-center gap-1 text-white/60 text-[10px] uppercase font-bold tracking-tighter">
                    <ShieldCheck size={10} className="text-[#FFF200]" />
                    {roleLabel}
                  </div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown size={16} className={`text-white/40 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>
      </aside>

      {/* Logout modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <LogOut size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sign Out</h3>
              <p className="text-slate-500 text-sm mb-6">Are you sure you want to sign out?</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-3 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-bold transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={() => { setIsLogoutModalOpen(false); handleLogout(); }}
                  className="flex-1 py-3 rounded-xl text-white bg-red-500 hover:bg-red-600 font-bold shadow-md shadow-red-500/20 cursor-pointer">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
