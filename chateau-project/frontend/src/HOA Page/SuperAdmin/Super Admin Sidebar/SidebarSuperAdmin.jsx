import React, { useState, useEffect } from 'react';
import { 
  Link, 
  useLocation,
  useNavigate 
} from 'react-router-dom';
import { 
  LayoutDashboard, Users, ShieldCheck, UserCircle, Globe, Settings, LogOut, 
  Menu, ChevronLeft, ChevronDown, Activity, ShieldAlert, Clock 
} from 'lucide-react';
// UPDATED: Added an extra '../' to reach the assets folder
import ChateauLogo from '../../../assets/ChataueLogo.png';
// UPDATED: Added an extra '../' to reach supabaseAdmin in the HOA Page folder
import { supabase } from '../../supabaseAdmin'; 

const SidebarSuperAdmin = () => {
  // --- FIXED: Initialize state from localStorage so it remembers if it was closed across page loads.
  // Defaults to collapsed (closed) when no preference has been saved yet. ---
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('superAdminSidebarCollapsed');
    return stored === null ? true : stored === 'true';
  });
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // ADDED: State for logout confirmation modal
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState('President Super'); 
  const [avatarUrl, setAvatarUrl] = useState(null); 
  const location = useLocation();
  const navigate = useNavigate();

  // --- FIXED: Function to toggle sidebar and save preference to localStorage ---
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('superAdminSidebarCollapsed', newState);
    setIsProfileOpen(false); // Ensure profile menu closes when toggling
  };

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Fetch avatar and full_name from admins table
      const { data: adminData } = await supabase
        .from('admins')
        .select('avatar_url, display_name')
        .eq('email', user.email)
        .single();
        
      if (adminData) {
        setDisplayName(adminData.display_name || user.user_metadata?.display_name || "Super Admin");
        if (adminData.avatar_url) setAvatarUrl(adminData.avatar_url);
      } else {
        setDisplayName(user.user_metadata?.display_name || "Super Admin");
      }
    }
  };

  // --- FETCH USER DATA & SETUP LISTENER ---
  useEffect(() => {
    fetchUserData();

    const handleProfileUpdate = () => fetchUserData();
    window.addEventListener('profile-updated', handleProfileUpdate);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.display_name || "Super Admin");
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

  const handleLogout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('system_logs').insert([
        { 
          user_email: user.email, 
          activity: 'User Logged Out', 
          severity: 'info', 
          details: 'Admin/Super Admin session terminated' 
        }
      ]);
    }

    await supabase.auth.signOut();
    navigate('/admin'); 
  };

  const menuItems = [
    { icon: <LayoutDashboard size={22} />, label: "Master Dashboard", path: "/super-admin/dashboard" },
    { icon: <ShieldAlert size={22} />, label: "Admin Control", path: "/super-admin/admins" },
    { icon: <Users size={22} />, label: "All Residents", path: "/super-admin/residents" },
    { icon: <Activity size={22} />, label: "System Logs", path: "/super-admin/logs" },
  ];

  return (
    <>
      <aside className={`sticky top-0 h-screen flex flex-col transition-all duration-300 ease-in-out shadow-2xl z-50
        ${isCollapsed ? 'w-20' : 'w-72'}
        bg-gradient-to-b from-[#006837] to-[#004d29]`}>
        
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[#FFF200] opacity-10 blur-[100px] pointer-events-none"></div>

        <button 
          // --- FIXED: Now uses the new toggleSidebar function to persist the state ---
          onClick={toggleSidebar}
          className="absolute -right-3 top-10 bg-white text-[#006837] rounded-full p-1 shadow-md hover:scale-110 transition-transform border border-slate-200 z-50 cursor-pointer"
        >
          {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className={`flex flex-col items-center py-10 px-4 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 invisible' : 'opacity-100'}`}>
          <img src={ChateauLogo} alt="Chateau Logo" className="w-20 h-auto mb-4 drop-shadow-lg" />
          <h1 className="text-white font-black tracking-[0.2em] text-xl uppercase text-center">SUPER ADMIN</h1>
          <div className="h-px w-full bg-white/20 mt-6"></div>
        </div>

        <nav className="mt-4 px-3 space-y-2 flex-1 overflow-y-auto">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path}
                // ADDED: The title attribute creates a native browser tooltip automatically
                title={isCollapsed ? item.label : ""} 
                className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all group relative
                  ${isActive ? 'bg-white/20 text-white shadow-inner' : 'text-white/80 hover:text-white hover:bg-white/10'}
                  ${isCollapsed ? 'justify-center' : 'justify-start'}`}
              >
                <span className={`transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-[#FFF200]'}`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className={`text-sm tracking-wide ${isActive ? 'font-bold' : 'font-semibold'}`}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ... Profile and Logout sections remain unchanged ... */}
        <div className="p-3 mt-auto">
          {isProfileOpen && !isCollapsed && (
            <div className="absolute bottom-24 left-3 right-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 z-50">
              <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Master Account</p>
              </div>
              <div className="p-2">
                <Link to="/super-admin/profile" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-green-50 hover:text-green-600 rounded-xl transition-all">
                  <UserCircle size={18} /> System Profile
                </Link>
                <div className="h-px bg-slate-100 my-2 mx-2"></div>
                <button 
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-all text-left cursor-pointer"
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </div>
          )}

          <div 
            // --- FIXED: Only allows toggling the profile menu if the sidebar is NOT collapsed ---
            onClick={() => {
              if (!isCollapsed) setIsProfileOpen(!isProfileOpen);
            }}
            // --- FIXED: Disables hover effects and pointer cursor when collapsed ---
            className={`bg-black/20 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3 border border-white/10 transition-all group
            ${isCollapsed ? 'justify-center cursor-default' : 'justify-between hover:bg-white/10 cursor-pointer'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FFF200] to-white flex items-center justify-center text-[#006837] font-bold shadow-inner text-lg group-hover:scale-105 transition-transform uppercase overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0)
                )}
              </div>
              {!isCollapsed && (
                <div className="text-left overflow-hidden">
                  <p className="text-white text-xs font-bold truncate w-32">{displayName}</p>
                  <div className="flex items-center gap-1 text-white/60 text-[10px] uppercase font-bold tracking-tighter">
                    <ShieldCheck size={10} className="text-[#FFF200]" />
                    Super Administrator
                  </div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown 
                size={16} 
                className={`text-white/40 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} 
              />
            )}
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <LogOut size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sign Out</h3>
              <p className="text-slate-500 text-sm mb-6">Are you sure you want to sign out of your account?</p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-3 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsLogoutModalOpen(false);
                    handleLogout();
                  }}
                  className="flex-1 py-3 rounded-xl text-white bg-red-500 hover:bg-red-600 font-bold transition-colors shadow-md shadow-red-500/20 cursor-pointer"
                >
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

export default SidebarSuperAdmin;