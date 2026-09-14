import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseAdmin'; 
import { Search, Plus, MoreVertical, Trash2, Edit2, ShieldAlert, X, Eye, EyeOff, User, AlertTriangle, CheckCircle2 } from 'lucide-react'; // --- ADDED: CheckCircle2 import ---
import AddAdmin from './AddAdmin'; 
import EditAdmin from './EditAdmin'; // --- ADDED: Import the new EditAdmin component ---

const AdminControl = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Admin State 
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Edit Admin State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  // --- ADDED: Delete Modal State ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);

  // --- ADDED: Reset MFA Modal State ---
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [adminToReset, setAdminToReset] = useState(null);

  // --- ADDED: Success Modal State ---
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Helper for Audit Logs
  const logActivity = async (action, details) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert([
        {
          user_email: user?.email || 'System',
          activity: action,
          severity: 'info',
          details: details
        }
      ]);
    } catch (err) {
      console.error('Logging failed:', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admins') 
        .select('*')
        .neq('role', 'super_admin'); 

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error('Error fetching admins:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- UPDATED: Handle Delete Logic ---
  const handleDeleteAdmin = (admin) => {
    setAdminToDelete(admin);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    try {
      const { error } = await supabase.from('admins').delete().eq('id', adminToDelete.id);
      if (error) throw error;

      await logActivity('Deleted Admin', `Deleted admin account: ${adminToDelete.email}`);
      setIsDeleteModalOpen(false);
      setAdminToDelete(null);
      fetchAdmins();
    } catch (err) {
      alert('Error deleting admin: ' + err.message);
    }
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setIsEditModalOpen(true);
  };

  // --- ADDED: Handle Reset MFA Modal Open ---
  const openResetModal = (admin) => {
    setAdminToReset(admin);
    setIsResetModalOpen(true);
  };

  // --- UPDATED: Handle Reset MFA Logic to use custom modal ---
  const confirmResetMFA = async () => {
    if (!adminToReset) return;

    try {
      // This calls the secure function we just created in the SQL Editor
      const { data, error } = await supabase.rpc('admin_unenroll_mfa', { 
        target_uid: adminToReset.id 
      });

      if (error) throw error;

      // --- FIXED: Trigger custom success modal instead of alert() ---
      setSuccessMessage(`MFA has been successfully reset for ${adminToReset.display_name || 'this admin'}.`);
      setIsSuccessModalOpen(true);
      
      // Add an audit log here so you have a record of the Super Admin doing this
      await logActivity('Reset User MFA', `Reset Authenticator MFA for user ID: ${adminToReset.id}`);

    } catch (error) {
      alert("Error resetting MFA: " + error.message);
    } finally {
      // Close the modal and clear state whether it succeeded or failed
      setIsResetModalOpen(false);
      setAdminToReset(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Admin Control</h1>
          <p className="text-slate-500 text-sm">Manage system administrators and their permissions</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#006837] text-white px-4 py-2 rounded-xl font-semibold hover:bg-[#004d29] transition-all shadow-lg cursor-pointer"
        >
          <Plus size={20} /> Add New Admin
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search admins by name or email..."
              className="pl-10 pr-4 py-2.5 w-full bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* --- ADDED: Wrapper div to make the table horizontally scrollable on smaller screens --- */}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-wider">
              <tr>
                <th className="px-6 py-4">Admin Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin"></div>
                      <p className="text-[#006837] font-semibold animate-pulse tracking-wide">Loading admins...</p>
                    </div>
                  </td>
                </tr>
              ) : admins.filter(a => a.display_name?.toLowerCase().includes(searchTerm.toLowerCase())).map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{admin.display_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 capitalize">{admin.role || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {/* --- FIXED: Enforced MM/DD/YYYY Format using 2-digit options --- */}
                    {admin.created_at ? new Date(admin.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end items-center gap-2">
                    {/* --- FIXED: Updated to open the custom Reset MFA Modal --- */}
                    <button 
                      onClick={() => openResetModal(admin)}
                      className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                      title="Reset Authenticator App"
                    >
                      Reset MFA
                    </button>
                    <button onClick={() => openEditModal(admin)} className="p-2 text-slate-400 hover:text-[#006837] cursor-pointer"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeleteAdmin(admin)} className="p-2 text-slate-400 hover:text-red-500 cursor-pointer"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Render Add Admin Component */}
      <AddAdmin 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdminAdded={fetchAdmins} 
      />

      {/* --- ADDED: Render the new external Edit Admin Component --- */}
      <EditAdmin
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        adminToEdit={editingAdmin}
        onAdminUpdated={fetchAdmins}
      />

      {/* --- ADDED: Reset MFA Confirmation Modal --- */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
             <div className="mx-auto bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
               <ShieldAlert className="text-orange-600" size={24} />
             </div>
             <h2 className="text-lg font-bold text-slate-800 mb-2">Reset MFA</h2>
             <p className="text-slate-500 text-sm mb-6">Are you sure you want to reset the Authenticator App for <strong>{adminToReset?.display_name}</strong>? They will be forced to set it up again on their next login.</p>
             <div className="flex gap-3">
               <button onClick={() => setIsResetModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 cursor-pointer">Cancel</button>
               <button onClick={confirmResetMFA} className="flex-1 px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 cursor-pointer">Reset MFA</button>
             </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
             <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
               <AlertTriangle className="text-red-600" size={24} />
             </div>
             <h2 className="text-lg font-bold text-slate-800 mb-2">Delete Admin</h2>
             <p className="text-slate-500 text-sm mb-6">Are you sure you want to delete <strong>{adminToDelete?.display_name}</strong>? This action cannot be undone.</p>
             <div className="flex gap-3">
               <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 cursor-pointer">Cancel</button>
               <button onClick={confirmDeleteAdmin} className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 cursor-pointer">Delete Account</button>
             </div>
          </div>
        </div>
      )}

      {/* --- ADDED: Success Confirmation Modal --- */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center animate-in zoom-in duration-200">
             <div className="mx-auto bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
               <CheckCircle2 className="text-green-600" size={24} />
             </div>
             <h2 className="text-lg font-bold text-slate-800 mb-2">Success!</h2>
             <p className="text-slate-500 text-sm mb-6">{successMessage}</p>
             <button 
               onClick={() => setIsSuccessModalOpen(false)} 
               className="w-full px-4 py-3 bg-[#006837] text-white font-semibold rounded-xl hover:bg-[#004d29] transition-colors cursor-pointer"
             >
               Continue
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminControl;