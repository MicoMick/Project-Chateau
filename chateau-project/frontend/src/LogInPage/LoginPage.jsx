import React, { useState } from 'react';
import { User, Lock, ArrowRight, Eye, EyeOff, AlertCircle, ShieldCheck, QrCode, CheckCircle, KeyRound, X, Mail } from 'lucide-react';
import ChateauLogo from '../assets/ChataueLogo.png';

// --- UPDATED IMPORTS ---
import { supabase } from '../HOA Page/supabaseAdmin'; 
import { useNavigate } from 'react-router-dom';

// --- ADDED: Example function to fetch the logged-in admin's role ---
const fetchAdminRole = async (userEmail) => {
  const { data, error } = await supabase
    .from('admins')
    .select('role')
    .eq('email', userEmail)
    .maybeSingle(); 

  if (error) {
    console.error("Error fetching role:", error);
    return null;
  }
  
  return data ? data.role : null; 
};
// ------------------------------------------------------------------

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false); 
  const [errorMsg, setErrorMsg] = useState('');
  
  // --- MFA STATES ---
  const [mfaRequired, setMfaRequired] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState(''); // ADDED: Missing Challenge ID State
  const [otpCode, setOtpCode] = useState('');
  const [qrCode, setQrCode] = useState(''); 
  const [isEnrolling, setIsEnrolling] = useState(false);

  // --- ADDED: Confirmation State ---
  const [isConfirmingIdentity, setIsConfirmingIdentity] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  // --- Forgot password (Admins only — Super Admin has no self-service recovery) ---
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const navigate = useNavigate();

  const checkRoleAndRedirect = async (user) => {
    try {
      // --- ADDED: Fetch and store the role in localStorage for ProtectedRoute to use ---
      const userRole = await fetchAdminRole(user.email);
      if (userRole) {
        localStorage.setItem('userRole', userRole);
      } else {
        localStorage.setItem('userRole', 'resident'); 
      }

      const { data: adminData } = await supabase
        .from('admins')
        .select('role')
        .eq('email', user.email)
        .maybeSingle();

      // --- ADDED: Comprehensive Audit Trail for Successful Login with Role ---
      await supabase.from('system_logs').insert([{ 
        user_email: user.email, 
        activity: 'USER_LOGGED_IN', 
        severity: 'info', 
        details: `[${(adminData ? adminData.role : 'resident').toUpperCase()}] Successfully logged in`
      }]);
      // ---------------------------------------------------------------------

      if (!adminData) {
        navigate('/resident/home');
      } else if (adminData.role === 'super_admin') {
        // Always start the Super Admin sidebar closed on a fresh login
        localStorage.setItem('superAdminSidebarCollapsed', 'true');
        navigate('/super-admin/dashboard');
      } else {
        navigate('/hoa/dashboard');
      }
    } catch (err) {
      console.error("Redirect logic failed:", err);
      navigate('/resident/home');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error("Login attempt failed:", error.message); 
      // --- ADDED: Audit Trail for Failed Passwords ---
      await supabase.from('system_logs').insert([{ 
        user_email: email, 
        activity: 'LOGIN_FAILED', 
        severity: 'warning', 
        details: `Invalid credentials: ${error.message}`
      }]);
      // -----------------------------------------------
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      setAuthenticatedUser(data.user);
      setIsConfirmingIdentity(true);
      setLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotEmail(email);
    setForgotError('');
    setForgotSubmitted(false);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotError('');
    setForgotLoading(true);
    try {
      const { error } = await supabase.functions.invoke('request-password-reset', {
        body: { email: forgotEmail.trim().toLowerCase() },
      });
      if (error) throw error;
      setForgotSubmitted(true);
    } catch (err) {
      setForgotError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const proceedToMfa = async () => {
    setLoading(true);
    setIsConfirmingIdentity(false);

    try {
      const { data: factorData } = await supabase.auth.mfa.listFactors();
      
      // FIXED: Specifically check for verified vs unverified factors
      const verifiedFactor = factorData?.totp?.find(f => f.status === 'verified');
      const unverifiedFactor = factorData?.totp?.find(f => f.status === 'unverified');

      const { data: adminCheck } = await supabase
        .from('admins')
        .select('role')
        .eq('email', authenticatedUser.email)
        .maybeSingle();

      // Logic 1: Admin, no factors at all -> Force fresh enrollment
      if (adminCheck && !verifiedFactor && !unverifiedFactor) {
        enrollMFA(authenticatedUser.email);
        return;
      } 

      // Logic 2: Unverified factor exists -> Resume setup so we don't get "friendly name exists" error
      if (unverifiedFactor) {
        setFactorId(unverifiedFactor.id);
        setIsEnrolling(true); // Treat as enrollment
        setMfaRequired(true);
        setLoading(false);
      } 
      // Logic 3: Verified factor exists -> Standard Login Flow
      else if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        
        // FIXED: Must generate a Challenge ID for existing users
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: verifiedFactor.id
        });

        if (challengeError) throw challengeError;

        setChallengeId(challengeData.id); // Save the Challenge ID
        setIsEnrolling(false);
        setMfaRequired(true);
        setLoading(false);
      } else {
        // Logic 4: Not an admin
        checkRoleAndRedirect(authenticatedUser);
        setLoading(false);
      }
    } catch (err) {
      console.error("MFA sequence error:", err);
      setErrorMsg("Security check failed. Please try again.");
      setLoading(false);
    }
  };

  const enrollMFA = async (userEmail) => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Chateau Project',
        friendlyName: userEmail
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setFactorId(data.id);
        setIsEnrolling(true);
        setMfaRequired(true);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setErrorMsg("Please enter a 6-digit code.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isEnrolling) {
        // --- ADDED: Generate a challenge ID for the new factor before verifying ---
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factorId });
        if (challengeError) throw challengeError;

        const { error } = await supabase.auth.mfa.verify({
          factorId: factorId,
          challengeId: challengeData.id, // --- ADDED: Pass the generated challenge ID ---
          code: cleanCode,
        });
        if (error) throw error;
        await logSystemActivity('Admin verified and enrolled MFA');
        checkRoleAndRedirect(authenticatedUser);
      } else {
        // FIXED: Standard verification REQUIRES the challenge ID
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factorId,
          challengeId: challengeId, // Added this required parameter
          code: cleanCode,
        });
        if (error) throw error;
        await logSystemActivity('Admin verified via MFA');
        checkRoleAndRedirect(authenticatedUser);
      }
    } catch (err) {
      console.error("MFA Verification Error details:", err);
      // --- ADDED: Audit Trail for Failed MFA ---
      await supabase.from('system_logs').insert([{ 
        user_email: authenticatedUser.email, 
        activity: 'MFA_FAILED', 
        severity: 'warning', 
        details: 'Invalid OTP Code entered.'
      }]);
      // -----------------------------------------
      setErrorMsg("Invalid OTP Code. Please ensure your phone's time is set to 'Automatic'.");
      setLoading(false);
    }
  };

  const logSystemActivity = async (details) => {
    await supabase.from('system_logs').insert([{ 
      user_email: authenticatedUser.email, 
      activity: 'USER_LOGGED_IN', 
      severity: 'info', 
      details: details
    }]);
  };

  // --- UI Logic ---
  if (isConfirmingIdentity) {
    return (
      <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
        <div className="bg-white p-8 rounded-[32px] shadow-2xl max-w-sm w-full text-center">
           <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} /></div>
           <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify Identity</h2>
           <p className="text-slate-500 mb-6 text-sm">Confirm that you are the administrator for this session.</p>
           <button onClick={proceedToMfa} className="w-full py-4 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-2xl mb-3 cursor-pointer transition-all">Confirm & Continue</button>
           <button onClick={() => { setIsConfirmingIdentity(false); supabase.auth.signOut(); }} className="text-slate-400 text-xs font-semibold hover:text-red-500 cursor-pointer">Cancel</button>
        </div>
      </div>
    );
  }

  if (mfaRequired) {
    return (
      <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
        <div className="bg-white p-8 rounded-[32px] shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            {isEnrolling ? <QrCode size={40} /> : <ShieldCheck size={40} />}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{isEnrolling ? "Setup MFA" : "Verification"}</h2>
          {errorMsg && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold">{errorMsg}</div>}
          {isEnrolling && qrCode && <div className="bg-white p-4 border rounded-2xl mb-6 inline-block"><img src={qrCode} alt="MFA QR" className="w-48 h-48" /></div>}
          <div className="space-y-4">
            <input type="text" placeholder="000000" maxLength={6} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" onChange={(e) => setOtpCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()} />
            <button onClick={handleVerifyOTP} disabled={loading} className="w-full py-4 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-2xl transition-all">{loading ? "Verifying..." : "Access Dashboard"}</button>
            <button onClick={() => { setMfaRequired(false); setIsEnrolling(false); supabase.auth.signOut(); }} className="text-slate-400 text-xs font-semibold hover:text-red-500 cursor-pointer">Cancel Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      <div className="w-full md:w-1/2 bg-gradient-to-br from-[#006837] to-[#004d29] flex flex-col items-center justify-center p-12 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/5 rounded-full" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#FFF200]/10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.03] rounded-full" />
        <img src={ChateauLogo} alt="Logo" className="w-40 md:w-52 mb-8 drop-shadow-2xl relative z-10" />
        <h1 className="text-4xl md:text-5xl font-black uppercase relative z-10 tracking-widest">CHATEAU</h1>
        <p className="text-white/60 text-sm font-medium mt-3 relative z-10 tracking-wider">Management System</p>
      </div>
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <p className="text-sm font-bold text-[#006837] uppercase tracking-widest mb-2">HOA Admin Portal</p>
            <h2 className="text-3xl font-black text-slate-900">Welcome Back</h2>
            <p className="text-slate-400 text-sm mt-1">Sign in to access your dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            {errorMsg && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2.5 text-red-600"><AlertCircle size={16} className="shrink-0" /><p className="text-sm font-semibold">{errorMsg}</p></div>}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" placeholder="admin@chateau.com" /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <button type="button" onClick={openForgotModal} className="text-xs font-bold text-[#006837] hover:text-[#004d29] cursor-pointer">Forgot password?</button>
              </div>
              <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" placeholder="••••••••" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#006837] hover:bg-[#004d29] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#006837]/20 transition-all text-sm tracking-wide">{loading ? "Authenticating..." : "Sign In"}<ArrowRight size={18} /></button>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal — Admins only. Super Admin recovery is handled outside the app. */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={closeForgotModal}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7" onClick={(e) => e.stopPropagation()}>
            {forgotSubmitted ? (
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 mx-auto flex items-center justify-center mb-4">
                  <CheckCircle size={26} className="text-emerald-500" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Request Sent</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  If that email belongs to an admin account, our Super Admin has been notified and will reset your password shortly.
                </p>
                <button onClick={closeForgotModal} className="w-full py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold transition-all cursor-pointer">Close</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <div className="w-11 h-11 rounded-2xl bg-[#006837]/10 flex items-center justify-center">
                    <KeyRound size={20} className="text-[#006837]" />
                  </div>
                  <button onClick={closeForgotModal} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                    <X size={16} className="text-slate-400" />
                  </button>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-3 mb-1">Forgot Password?</h3>
                <p className="text-slate-500 text-sm mb-5 leading-relaxed">
                   Enter your email and our Super Admin will be notified to reset it for you.
                </p>
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  {forgotError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600">
                      <AlertCircle size={14} className="shrink-0" /><p className="text-xs font-semibold">{forgotError}</p>
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="email" required autoFocus value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all"
                      placeholder="admin@chateau.com"
                    />
                  </div>
                  <button type="submit" disabled={forgotLoading} className="w-full py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold transition-all cursor-pointer disabled:opacity-50">
                    {forgotLoading ? 'Sending…' : 'Send Request'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;