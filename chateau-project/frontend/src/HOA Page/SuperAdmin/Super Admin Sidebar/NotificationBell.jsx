import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, KeyRound, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseAdmin';

const timeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const NotificationBell = () => {
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const navigate = useNavigate();

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('id, email, full_name, resident_id, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error) setRequests(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('password-reset-requests-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, fetchRequests)
      .subscribe();

    const interval = setInterval(fetchRequests, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchRequests]);

  const resolveRequest = async (id, status) => {
    setActingId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('password_reset_requests').update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id || null,
      }).eq('id', id);
      if (!error) setRequests(prev => prev.filter(r => r.id !== id));
    } finally {
      setActingId(null);
    }
  };

  const openResetModal = (req) => {
    setOpen(false);
    navigate(`/super-admin/residents?q=${encodeURIComponent(req.email)}`);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="relative w-11 h-11 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm hover:shadow-md hover:border-[#006837]/30 transition-all cursor-pointer">
        <Bell size={18} className="text-slate-600" />
        {requests.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
            {requests.length > 9 ? '9+' : requests.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#006837]/10 rounded-xl flex items-center justify-center shrink-0">
                <KeyRound size={14} className="text-[#006837]" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Password Reset Requests</p>
                <p className="text-xs text-slate-400">From residents who forgot their password</p>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={18} className="animate-spin text-[#006837]" />
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <Bell size={24} className="text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-500">All caught up</p>
                  <p className="text-xs text-slate-400 mt-0.5">No pending password reset requests.</p>
                </div>
              ) : (
                requests.map(req => (
                  <div key={req.id} className="px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{req.full_name || req.email}</p>
                        {req.full_name && <p className="text-xs text-slate-400 truncate">{req.email}</p>}
                        {!req.resident_id && (
                          <span className="inline-flex mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">
                            No matching account
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0 whitespace-nowrap">{timeAgo(req.created_at)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {req.resident_id && (
                        <button type="button" onClick={() => openResetModal(req)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] rounded-lg text-[11px] font-bold cursor-pointer transition-all">
                          <KeyRound size={11} /> Reset Password
                        </button>
                      )}
                      <button type="button" disabled={actingId === req.id} onClick={() => resolveRequest(req.id, 'resolved')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[11px] font-bold cursor-pointer transition-all disabled:opacity-50">
                        <Check size={11} /> Resolved
                      </button>
                      <button type="button" disabled={actingId === req.id} onClick={() => resolveRequest(req.id, 'dismissed')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[11px] font-bold cursor-pointer transition-all ml-auto disabled:opacity-50">
                        <X size={11} /> Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
