import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom'; 
import React, { useState, useEffect } from 'react'; 
import Header from './LandingPage/Header/Header.jsx'; 
import Mainpage from './LandingPage/MainPage/Mainpage.jsx';
import Team from './LandingPage/Team/Team.jsx'; 
import HowItWorks from './LandingPage/HowItWorks/HowItWorks.jsx';
import DownloadPage from './LandingPage/DownloadPage/Downloadpage.jsx';
import AboutUs from './LandingPage/About us/AboutUs.jsx';
import FAQs from './LandingPage/FAQs/FAQs.jsx';
import Footer from './LandingPage/Footer/Footer.jsx';
import LoginPage from './LogInPage/LoginPage.jsx'; 
import Sidebar from './HOA Page/Sidebar/Sidebar.jsx';
import HoaDashboard from './HOA Page/Dashboard/HoaDashboard.jsx';
import ResidentManage from './HOA Page/Resident Management/ResidentManage.jsx';
import Reservation from './HOA Page/Facility and Reservation/Reservation.jsx';
import FacilityManagement from './HOA Page/Facility and Reservation/FacilityManagement.jsx';
import Payment from './HOA Page/Payments/Payment.jsx';
import ElectionPage from './HOA Page/Election/ElectionPage.jsx';
import Results from './HOA Page/Election/Results.jsx';
import Announcements from './HOA Page/Announcements/Announcements.jsx';
import Reports from './HOA Page/Residents Reports/Reports.jsx';
import ProfileManage from './HOA Page/HOA Profile/ProfileManage.jsx';
import SuperAdminLayout from './HOA Page/SuperAdmin/Super Admin Sidebar/SuperAdminLayout.jsx';
import SuperAdminDB from './HOA Page/SuperAdmin/Super Admin Dashboard/SuperAdminDB.jsx';
import SuperAdProfile from './HOA Page/SuperAdmin/Super Admin Profile/SuperAdProfile.jsx'; 
import AdminControl from './HOA Page/SuperAdmin/Admin Profiles/AdminControl.jsx'; 
import Residents from './HOA Page/SuperAdmin/Profiles Residents/Residents.jsx'; 
import SystemLogs from './HOA Page/SuperAdmin/System AuditLogs/SystemLogs.jsx';
import PendingApproval from './HOA Page/Pending Approval/PendingApproval.jsx';
import AuditorDashboard from './HOA Page/AuditorBoard/AuditorDashboard.jsx'; 
import Statistics from './HOA Page/Statistics/Statistics.jsx';
import MoveInClearance from './HOA Page/Move In and Out Clearance/MoveInClearance.jsx';
import CourtPermit from './HOA Page/Court Permit/CourtPermit.jsx';
import WebsiteSettings from './HOA Page/WebsiteSettings/WebsiteSettings.jsx';
import { supabase } from './HOA Page/supabaseAdmin';
import ProtectedRoute from './HOA Page/Protect Route/ProtectedRoute';
import SplashScreen from './components/Splashscreen.jsx';

// ─── Role constants ─────────────────────────────────────────────────────────

const ROLES = {
  PRESIDENT:      'president',
  VICE_PRESIDENT: 'vice_president',
  SECRETARY:      'secretary',
  TREASURER:      'treasurer',
  AUDITOR:        'auditor',
  BOARD_MEMBER:   'board_member',
};

// Page access per role
const ACCESS = {
  // Governance
  GOVERNANCE:  [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY],

  // Operations
  OPERATIONS:  [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY],

  // Reservations
  RESERVATIONS: [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.TREASURER, ROLES.BOARD_MEMBER],

  // Facility Management
  FACILITY_MANAGEMENT: [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY],

  // Announcements + Reports
  COMM_OPS:    [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.BOARD_MEMBER],

  // Elections
  ELECTIONS:   ['elecom'],

  // Payments
  PAYMENTS:    [ROLES.PRESIDENT, ROLES.TREASURER],

  // Move In/Out Clearances
  CLEARANCES:  [ROLES.PRESIDENT, ROLES.TREASURER],

  // Statistics
  STATISTICS:  [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.AUDITOR, ROLES.TREASURER],

  // Auditor workspace
  AUDITOR:     [ROLES.AUDITOR, ROLES.TREASURER],

  // Court Permit
  COURT_PERMIT: [ROLES.BOARD_MEMBER],

  // Profile
  PROFILE:     [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.TREASURER, ROLES.AUDITOR, ROLES.BOARD_MEMBER, 'elecom'],

  // Website Settings — landing page content
  WEBSITE_SETTINGS: [ROLES.PRESIDENT, ROLES.VICE_PRESIDENT, ROLES.SECRETARY, ROLES.BOARD_MEMBER],
};

// ─── Auth + role helpers ────────────────────────────────────────────────────

const AuthRoute = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
    </div>
  );
  if (!session) return <Navigate to="/admin" replace />;
  return children;
};

const RoleBasedRoute = ({ allowedRoles, children }) => {
  const currentRole = localStorage.getItem('userRole') || 'resident';
  return (
    <ProtectedRoute userRole={currentRole} allowedRoles={allowedRoles}>
      {children}
    </ProtectedRoute>
  );
};

// ─── Layout components ──────────────────────────────────────────────────────

const LandingPage = () => (
  <div className="bg-slate-900 min-h-screen scroll-smooth">
    <Header />
    <main>
      <Mainpage />
      <Team />
      <HowItWorks />
      <DownloadPage />
      <AboutUs />
      <FAQs />
      <Footer />
    </main>
  </div>
);

const AdminLayout = () => (
  <div className="flex w-full h-screen bg-slate-50 overflow-hidden">
    <Sidebar />
    <main className="flex-1 h-screen overflow-y-auto">
      <Outlet />
    </main>
  </div>
);

// ─── Dashboard redirect ─────────────────────────────────────────────────────
const DashboardRedirect = () => {
  const role = (localStorage.getItem('userRole') || 'resident').trim().toLowerCase();

  // Treasurer → Payments
  if (role === ROLES.TREASURER) return <Navigate to="/hoa/payments" replace />;

  // Auditor → Auditor workspace
  if (role === ROLES.AUDITOR) return <Navigate to="/hoa/auditor-workspace" replace />;

  // Elecom → Elections
  if (role === 'elecom') return <Navigate to="/hoa/elections" replace />;

  // Board Member → Announcements
  if (role === ROLES.BOARD_MEMBER) return <Navigate to="/hoa/announcements" replace />;

  // Default → Dashboard
  return (
    <RoleBasedRoute allowedRoles={[...ACCESS.GOVERNANCE, 'super_admin']}>
      <HoaDashboard />
    </RoleBasedRoute>
  );
};

// ─── App ────────────────────────────────────────────────────────────────────

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <Router>
      <Routes>

        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<LoginPage />} />

        {/* Super Admin */}
        <Route path="/super-admin/dashboard"         element={<AuthRoute><SuperAdminLayout><SuperAdminDB /></SuperAdminLayout></AuthRoute>} />
        <Route path="/super-admin/profile"           element={<AuthRoute><SuperAdminLayout><SuperAdProfile /></SuperAdminLayout></AuthRoute>} />
        <Route path="/super-admin/admins"            element={<AuthRoute><SuperAdminLayout><AdminControl /></SuperAdminLayout></AuthRoute>} />
        <Route path="/super-admin/residents"         element={<AuthRoute><SuperAdminLayout><Residents /></SuperAdminLayout></AuthRoute>} />
        <Route path="/super-admin/logs"              element={<AuthRoute><RoleBasedRoute allowedRoles={['super_admin']}><SuperAdminLayout><SystemLogs /></SuperAdminLayout></RoleBasedRoute></AuthRoute>} />

        {/* HOA Admin shell */}
        <Route path="/hoa" element={<AuthRoute><AdminLayout /></AuthRoute>}>

          <Route index          element={<DashboardRedirect />} />
          <Route path="dashboard" element={<DashboardRedirect />} />

          {/* ── Auditor — isolated workspace ── */}
          <Route path="auditor-workspace" element={
            <RoleBasedRoute allowedRoles={ACCESS.AUDITOR}>
              <AuditorDashboard />
            </RoleBasedRoute>
          } />

          {/* ── Resident management ── */}
          <Route path="residents" element={
            <RoleBasedRoute allowedRoles={ACCESS.OPERATIONS}>
              <ResidentManage />
            </RoleBasedRoute>
          } />

          {/* ── Pending Approvals — president only ── */}
          <Route path="pending-approvals" element={
            <RoleBasedRoute allowedRoles={['president']}>
              <PendingApproval />
            </RoleBasedRoute>
          } />


          {/* ── Move In / Move Out Clearances ── */}
          <Route path="move-in-clearances" element={
            <RoleBasedRoute allowedRoles={ACCESS.CLEARANCES}>
              <MoveInClearance />
            </RoleBasedRoute>
          } />

          {/* ── Reservations ── */}
          <Route path="reservations" element={
            <RoleBasedRoute allowedRoles={ACCESS.RESERVATIONS}>
              <Reservation />
            </RoleBasedRoute>
          } />

          {/* ── Facility Management ── */}
          <Route path="facility-management" element={
            <RoleBasedRoute allowedRoles={ACCESS.FACILITY_MANAGEMENT}>
              <FacilityManagement />
            </RoleBasedRoute>
          } />

          {/* ── Payments ── */}
          <Route path="payments" element={
            <RoleBasedRoute allowedRoles={ACCESS.PAYMENTS}>
              <Payment />
            </RoleBasedRoute>
          } />

          {/* ── Elections ── */}
          <Route path="elections" element={
            <RoleBasedRoute allowedRoles={ACCESS.ELECTIONS}>
              <ElectionPage />
            </RoleBasedRoute>
          } />

          <Route path="results" element={
            <RoleBasedRoute allowedRoles={ACCESS.ELECTIONS}>
              <Results />
            </RoleBasedRoute>
          } />

          {/* ── Reports / Issues ── */}
          <Route path="reports" element={
            <RoleBasedRoute allowedRoles={ACCESS.COMM_OPS}>
              <Reports />
            </RoleBasedRoute>
          } />

          {/* ── Announcements ── */}
          <Route path="announcements" element={
            <RoleBasedRoute allowedRoles={ACCESS.COMM_OPS}>
              <Announcements />
            </RoleBasedRoute>
          } />

          {/* ── Statistics ── */}
          <Route path="statistics" element={
            <RoleBasedRoute allowedRoles={ACCESS.STATISTICS}>
              <Statistics />
            </RoleBasedRoute>
          } />

          {/* ── Court Permit ── */}
          <Route path="court-permit" element={
            <RoleBasedRoute allowedRoles={ACCESS.COURT_PERMIT}>
              <CourtPermit />
            </RoleBasedRoute>
          } />

          {/* ── Website Settings — landing page content ── */}
          <Route path="website-settings" element={
            <RoleBasedRoute allowedRoles={ACCESS.WEBSITE_SETTINGS}>
              <WebsiteSettings />
            </RoleBasedRoute>
          } />

          {/* ── Profile — all roles ── */}
          <Route path="profile" element={
            <RoleBasedRoute allowedRoles={ACCESS.PROFILE}>
              <ProfileManage />
            </RoleBasedRoute>
          } />

          {/* ── System Logs ── */}
          <Route path="logs" element={
            <RoleBasedRoute allowedRoles={['super_admin']}>
              <SystemLogs />
            </RoleBasedRoute>
          } />

        </Route>
      </Routes>
    </Router>
  );
}

export default App;
