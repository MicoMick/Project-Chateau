import React from 'react';
import { Outlet } from 'react-router-dom';
import SidebarSuperAdmin from './SidebarSuperAdmin';
import NotificationBell from './NotificationBell';

// Rendered once as a parent layout route (see App.jsx) — the sidebar, avatar,
// and notification bell must NOT remount on every navigation between
// super-admin pages, or they flicker/reset. Nested pages render via Outlet.
const SuperAdminLayout = () => {
  return (
    <div className="flex w-full h-screen bg-slate-50 overflow-hidden">
      <SidebarSuperAdmin />
      <main className="flex-1 h-screen overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-40 flex items-center justify-end px-6 py-3 bg-white/90 backdrop-blur-md border-b border-slate-100 shrink-0">
          <NotificationBell />
        </div>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SuperAdminLayout;