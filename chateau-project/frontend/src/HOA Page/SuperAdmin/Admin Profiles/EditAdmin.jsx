import React, { useState, useEffect } from 'react';
// --- UPDATED: Switched back to the standard safe client ---
import { supabase } from '../../supabaseAdmin'; 
import { X, Eye, EyeOff, User, Lock, CheckCircle2 } from 'lucide-react'; 

const EditAdmin = ({ isOpen, onClose, adminToEdit, onAdminUpdated }) => {
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null); 

  const [passwordStrength, setPasswordStrength] = useState({ 
    label: '', 
    textClass: '', 
    barWidth: '0%', 
    barColor: 'bg-transparent' 
  });

  useEffect(() => {
    if (adminToEdit) {
      setEditName(adminToEdit.display_name || '');
      setEditPassword(''); 
      setError(null);
      setSuccessMessage(null); 
    }
  }, [adminToEdit, isOpen]);

  useEffect(() => {
    if (!editPassword) {
      setPasswordStrength({ label: '', textClass: '', barWidth: '0%', barColor: 'bg-transparent' });
      return;
    }

    const hasLetters = /[a-zA-Z]/.test(editPassword);
    const hasNumbers = /\d/.test(editPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(editPassword);
    const length = editPassword.length;

    if (length >= 10 && hasLetters && hasNumbers && hasSpecial) {
      setPasswordStrength({ label: 'Super Strong', textClass: 'text-green-600', barWidth: '100%', barColor: 'bg-green-500' });
    } else if (length >= 8 && hasLetters && (hasNumbers || hasSpecial)) {
      setPasswordStrength({ label: 'Strong', textClass: 'text-yellow-500', barWidth: '66%', barColor: 'bg-yellow-500' });
    } else {
      setPasswordStrength({ label: 'Weak', textClass: 'text-red-500', barWidth: '33%', barColor: 'bg-red-500' });
    }
  }, [editPassword]);

  if (!isOpen) return null;

  const handleEditAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Update Display Name in 'admins' table
      const { error: updateError } = await supabase
        .from('admins')
        .update({ display_name: editName })
        .eq('id', adminToEdit.id);

      if (updateError) throw updateError;

      let passwordChanged = false;
      
      // 2. Update Password (Only if the admin typed a new one)
      if (editPassword.trim() !== '') {
        // --- UPDATED: Bypasses the browser block using our new Database Function ---
        const { error: authError } = await supabase.rpc('admin_update_user_password', {
          uid: adminToEdit.id,
          new_pass: editPassword
        });
        
        if (authError) throw authError;
        passwordChanged = true;
      }

      // 3. Log the Activity
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert([
        {
          user_email: user?.email || 'System',
          activity: 'Updated Admin',
          severity: 'info',
          details: `Updated profile for ${adminToEdit.email}`
        }
      ]);

      setSuccessMessage(
        passwordChanged 
          ? "Admin profile updated and password has been reset successfully!" 
          : "Admin profile updated successfully!"
      );
      
      onAdminUpdated();
      
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Edit Admin</h2>
          <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {successMessage ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle2 size={56} className="text-[#006837] animate-bounce" />
            <h3 className="text-lg font-bold text-slate-800">Success!</h3>
            <p className="text-sm text-slate-500 max-w-[280px]">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleEditAdmin} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {/* Display Name Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Display Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400" />
                </div>
                <input 
                  type="text" 
                  required 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006837]/20" 
                  placeholder="Enter admin name"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                New Password <span className="text-xs text-slate-400 font-normal">(Leave blank to keep current)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={editPassword} 
                  onChange={(e) => setEditPassword(e.target.value)} 
                  className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006837]/20" 
                  placeholder="Enter new password"
                  minLength={6}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#006837] cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password Strength Indicator UI */}
              {editPassword && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-slate-500">Password strength:</span>
                    <span className={`text-xs font-bold ${passwordStrength.textClass}`}>{passwordStrength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.barColor}`} 
                      style={{ width: passwordStrength.barWidth }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit" 
              disabled={loading}
              className="w-full bg-[#006837] text-white py-2.5 rounded-lg font-bold cursor-pointer hover:bg-[#004d29] transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditAdmin;