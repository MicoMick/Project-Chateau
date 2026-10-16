import React, { useState, useEffect, useRef } from 'react';
import {
  User, Mail, Camera, Lock, Save,
  CheckCircle2, Eye, EyeOff, AlertCircle,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';

// ─── Password strength helper ─────────────────────────────────────────────────
const getPasswordStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)                          score += 25;
  if (pw.length >= 12)                         score += 10;
  if (/[A-Z]/.test(pw))                        score += 20;
  if (/[0-9]/.test(pw))                        score += 20;
  if (/[^A-Za-z0-9]/.test(pw))                score += 25;
  if (score < 30)  return { score,       label: 'Weak',      color: 'bg-red-400'    };
  if (score < 60)  return { score,       label: 'Fair',      color: 'bg-amber-400'  };
  if (score < 80)  return { score,       label: 'Good',      color: 'bg-blue-400'   };
                   return { score: 100,  label: 'Strong',    color: 'bg-emerald-500' };
};

const ProfileManage = () => {
  const [activeSection,      setActiveSection]      = useState('Personal Info');
  const [userEmail,          setUserEmail]          = useState('');
  const [avatarUrl,          setAvatarUrl]          = useState(null);
  const [uploading,          setUploading]          = useState(false);
  const [firstName,          setFirstName]          = useState('');
  const [lastName,           setLastName]           = useState('');
  const [infoLoading,        setInfoLoading]        = useState(false);
  const [newPassword,        setNewPassword]        = useState('');
  const [confirmPassword,    setConfirmPassword]    = useState('');
  const [loading,            setLoading]            = useState(false);
  const [showNewPassword,    setShowNewPassword]    = useState(false);
  const [showConfirmPassword,setShowConfirmPassword]= useState(false);
  const [toast,              setToast]              = useState({ show: false, message: '', type: 'success' });
  const [isPageLoading,      setIsPageLoading]      = useState(true);

  const fileInputRef = useRef(null);
  const strength = getPasswordStrength(newPassword);

  // ── Dynamic role label ────────────────────────────────────────────────────
  const currentUserRole = sessionStorage.getItem('userRole') || 'admin';
  const roleLabelMap = {
    president:      'President — CREVHAI',
    vice_president: 'Vice President — CREVHAI',
    secretary:      'Secretary — CREVHAI',
    treasurer:      'Treasurer — CREVHAI',
    auditor:        'Auditor — CREVHAI',
    board_member:   'Board Member — CREVHAI',
    elecom:         'Elecom — CREVHAI',
    super_admin:    'Super Administrator',
  };
  const roleLabel = roleLabelMap[currentUserRole] || 'HOA Administrator';

  // ── Toast helper ──────────────────────────────────────────────────────────
  const triggerToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // ── Load current user on mount ────────────────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw error || new Error('Not authenticated');

        setUserEmail(user.email || '');
        setFirstName(user.user_metadata?.first_name || '');
        setLastName( user.user_metadata?.last_name  || '');
        setAvatarUrl(user.user_metadata?.avatar_url || null);
      } catch (e) {
        console.error('[ProfileManage] loadUser:', e?.message);
      } finally {
        // Always clear loading — even on error — so the page renders
        setIsPageLoading(false);
      }
    };
    loadUser();
  }, []);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const ext      = file.name.split('.').pop();
      const filePath = `avatars/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const url = data.publicUrl;

      await supabase.auth.updateUser({ data: { avatar_url: url } });

      // ── Sync to admins table so avatar_url column reflects the new image ──
      const { error: syncErr } = await supabase
        .from('admins')
        .update({ avatar_url: url })
        .eq('email', userEmail);
      if (syncErr) console.warn('[ProfileManage] admins avatar sync:', syncErr.message);

      setAvatarUrl(url);
      await logAudit('Profile Updated', 'HOA Administrator updated profile picture.');
      triggerToast('Profile picture updated!');
    } catch (err) {
      triggerToast('Upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // ── Update personal info ──────────────────────────────────────────────────
  const handleInfoUpdate = async () => {
    setInfoLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { first_name: firstName, last_name: lastName },
      });
      if (authError) throw authError;

      const fullDisplayName = `${firstName} ${lastName}`.trim();
      const { error: adminError } = await supabase
        .from('admins')
        .update({ display_name: fullDisplayName })
        .eq('email', userEmail);

      if (adminError) {
        // Non-fatal — admin row may not exist for all users
        console.warn('[ProfileManage] admin sync:', adminError.message);
      }

      await logAudit('Profile Updated', `Updated display name to: ${fullDisplayName}`);
      triggerToast('Profile updated successfully!');
    } catch (err) {
      triggerToast('Error: ' + err.message, 'error');
    } finally {
      setInfoLoading(false);
    }
  };

  // ── Update password ───────────────────────────────────────────────────────
  const handlePasswordUpdate = async () => {
    if (!newPassword || !confirmPassword) {
      triggerToast('Please fill in both password fields.', 'error'); return;
    }
    if (newPassword !== confirmPassword) {
      triggerToast('Passwords do not match!', 'error'); return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await logAudit('Security Update', 'HOA Administrator updated account password.');
      triggerToast('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      triggerToast('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
          <p className="text-[#006837] font-semibold animate-pulse tracking-wide">Loading Profile…</p>
        </div>
      </div>
    );
  }

  // ─── Shared input class ───────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen space-y-6 animate-in fade-in duration-500">

      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border
          animate-in fade-in slide-in-from-top-4 duration-300
          ${toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
            : 'bg-red-50 border-red-100 text-red-800'}`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            : <AlertCircle  size={18} className="text-red-500 shrink-0"     />}
          <p className="text-sm font-bold">{toast.message}</p>
        </div>
      )}

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Profile Management</h1>
        <p className="text-sm text-slate-400 mt-0.5">Update your account settings and personal information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left sidebar ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Avatar card */}
          <div className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-[#006837] to-[#004d29] flex items-center justify-center text-white text-4xl font-black shadow-lg overflow-hidden uppercase">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  : (firstName.charAt(0) || userEmail.charAt(0) || 'A')}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                className="hidden"
                accept="image/*"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 p-2 bg-white border border-slate-200 rounded-xl shadow-md text-slate-500 hover:text-[#006837] transition-all cursor-pointer disabled:opacity-50"
                title="Change photo"
              >
                <Camera size={16} />
              </button>
            </div>

            <h2 className="text-lg font-black text-slate-900 mt-5 truncate w-full text-center">
              {[firstName, lastName].filter(Boolean).join(' ') || 'HOA Admin'}
            </h2>
            <p className="text-[#006837] text-xs font-bold uppercase tracking-widest mt-1">{roleLabel}</p>

            <div className="w-full h-px bg-slate-100 my-5" />

            <div className="w-full flex items-center gap-3 text-slate-500 text-sm overflow-hidden">
              <Mail size={15} className="text-slate-400 shrink-0" />
              <span className="truncate text-xs">{userEmail}</span>
            </div>
          </div>

          {/* Nav tabs */}
          <div className="bg-white rounded-2xl p-2 border border-slate-100 shadow-sm">
            {['Personal Info', 'Security'].map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer
                  ${activeSection === section
                    ? 'bg-[#006837]/10 text-[#006837]'
                    : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {section === 'Personal Info' ? <User size={16} /> : <Lock size={16} />}
                {section}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right content ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            <h3 className="text-lg font-black text-slate-900 mb-6">{activeSection}</h3>

            {/* Personal Info section */}
            {activeSection === 'Personal Info' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="First name"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Last name"
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      disabled
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
                  <button
                    onClick={() => { setFirstName(''); setLastName(''); }}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInfoUpdate}
                    disabled={infoLoading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#006837]/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={15} /> {infoLoading ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}

            {/* Security section */}
            {activeSection === 'Security' && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <Lock size={20} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Change Password</p>
                    <p className="text-xs text-slate-400 mt-0.5">Keep your account secure with a strong password</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* New password */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className={inputCls + ' pr-11'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {newPassword && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${strength.color}`}
                            style={{ width: `${strength.score}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase w-12 text-right">
                          {strength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className={inputCls + ' pr-11'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[10px] font-bold text-red-500 uppercase mt-1.5">
                        Passwords do not match
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    onClick={handlePasswordUpdate}
                    disabled={loading || !newPassword || strength.score < 75 || newPassword !== confirmPassword}
                    title={
                      !newPassword                   ? 'Enter a new password' :
                      strength.score < 75            ? "Password must be at least 'Good' strength" :
                      newPassword !== confirmPassword ? 'Passwords must match' : ''
                    }
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#006837]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-4"
                  >
                    <Lock size={15} /> {loading ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileManage;
