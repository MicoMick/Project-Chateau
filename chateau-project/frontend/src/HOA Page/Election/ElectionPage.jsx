import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseAdmin";
import {
  Plus, BarChart2, Users, Calendar, X, CheckCircle,
  Bell, Pencil, Trash2, SearchX, ArrowLeft, AlertCircle,
  LayoutDashboard, UserPlus, Vote, Trophy, Clock,
  TrendingUp, Shield, Zap, ChevronRight, Activity, Filter,
} from "lucide-react";
import CandidateManager from "./CandidateManager.jsx";
import CandidatesPage from "./CandidatesPage.jsx";
import Results from "./Results.jsx";
import logger from '../auditLogger';
import ResidentFilterSelect from '../Resident Management/ResidentFilterSelect';


// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) => d ? d.split('T')[0] : '';

const formatDisplayDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusCfg = {
  active:  { bg: 'bg-emerald-500', text: 'text-white',          light: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-400', label: 'Active'  },
  pending: { bg: 'bg-amber-500',   text: 'text-white',          light: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-400',   label: 'Pending' },
  closed:  { bg: 'bg-slate-400',   text: 'text-white',          light: 'bg-slate-100 text-slate-600 border-slate-200',       dot: 'bg-slate-400',   label: 'Closed'  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ n, onClose }) => {
  if (!n.show) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-5
          ${n.type === 'success' ? 'bg-emerald-50' : 'bg-red-50'}`}>
          {n.type === 'success'
            ? <CheckCircle size={30} className="text-emerald-500" />
            : <AlertCircle size={30} className="text-red-500" />}
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">{n.title}</h3>
        <p className="text-slate-500 text-sm mb-7 leading-relaxed">{n.message}</p>
        <button onClick={onClose}
          className="w-full py-3.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold transition-all cursor-pointer">
          Continue
        </button>
      </div>
    </div>
  );
};

// ─── Delete Confirm ───────────────────────────────────────────────────────────
const DeleteConfirm = ({ show, onCancel, onConfirm }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
          <Trash2 size={26} className="text-red-500" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2 text-center">Delete Election?</h3>
        <p className="text-slate-500 text-sm mb-6 text-center leading-relaxed">
          This will permanently remove the election and all its data. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-100 cursor-pointer">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Election Card ────────────────────────────────────────────────────────────
const ElectionCard = ({ election, onView, onEdit, onDelete, canManage }) => {
  const cfg = statusCfg[election.status] || statusCfg.closed;
  return (
    <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-[#006837]/20 transition-all duration-300 flex flex-col overflow-hidden">

      {/* Top colour strip */}
      <div className={`h-1.5 w-full ${cfg.bg}`} />

      <div className="p-5 flex-1 flex flex-col">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
            ${election.status === 'active' ? 'bg-[#006837]/10' : 'bg-slate-50'}`}>
            <Vote size={18} className={election.status === 'active' ? 'text-[#006837]' : 'text-slate-400'} />
          </div>
          <div className="flex items-center gap-1.5">
            {canManage && (
              <>
                <button onClick={() => onEdit(election)}
                  className="p-2 text-slate-400 hover:text-[#006837] hover:bg-[#006837]/10 rounded-xl transition-all cursor-pointer"
                  title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(election.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                  title="Delete">
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.light}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        <h4 className="text-base font-black text-slate-900 mb-1.5 leading-snug line-clamp-2">{election.title}</h4>

        <div className="flex items-center gap-1.5 text-slate-400 mb-4">
          <Calendar size={12} />
          <p className="text-xs font-semibold">
            {formatDisplayDate(election.start_date)} — {formatDisplayDate(election.end_date)}
          </p>
        </div>

        {/* Votes pill */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#006837]/5 rounded-xl">
            <Activity size={12} className="text-[#006837]" />
            <span className="text-xs font-black text-[#006837]">{election.votes_count || 0} votes cast</span>
          </div>
        </div>

        {/* View button */}
        <button onClick={() => onView(election.id)}
          className="mt-auto w-full py-2.5 flex items-center justify-center gap-2
            bg-slate-50 hover:bg-[#006837] hover:text-white text-slate-600
            text-xs font-black rounded-xl transition-all duration-200 cursor-pointer group/btn border border-slate-100 hover:border-[#006837] hover:shadow-lg hover:shadow-[#006837]/20">
          View Details
          <ChevronRight size={13} className="group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

// ─── Slide-in Form Panel ──────────────────────────────────────────────────────
const ElectionFormPanel = ({ isOpen, isEditing, form, onChange, onSubmit, onClose }) => {
  if (!isOpen) return null;
  const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all";
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#006837]/10 rounded-xl flex items-center justify-center">
              <Vote size={16} className="text-[#006837]" />
            </div>
            <h2 className="text-lg font-black text-slate-900">
              {isEditing ? 'Edit Election' : 'Create Election'}
            </h2>
          </div>
          <button onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="space-y-5 flex-1">

            <div>
              <label className={labelCls}>Election Title <span className="text-red-400">*</span></label>
              <input type="text" required placeholder="e.g. 2026 HOA Board Elections"
                value={form.title} onChange={e => onChange({ ...form, title: e.target.value })}
                className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={3} placeholder="Brief description of this election…"
                value={form.description} onChange={e => onChange({ ...form, description: e.target.value })}
                className={inputCls + ' resize-none'} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Date <span className="text-red-400">*</span></label>
                <input type="date" required value={formatDate(form.start_date)}
                  onChange={e => onChange({ ...form, start_date: e.target.value })}
                  className={inputCls + ' cursor-pointer'} />
              </div>
              <div>
                <label className={labelCls}>End Date <span className="text-red-400">*</span></label>
                <input type="date" required value={formatDate(form.end_date)}
                  onChange={e => onChange({ ...form, end_date: e.target.value })}
                  className={inputCls + ' cursor-pointer'} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => onChange({ ...form, status: e.target.value })}
                className={inputCls + ' cursor-pointer'}>
                <option value="active">Active — Open for voting</option>
                <option value="pending">Pending — Not yet started</option>
                <option value="closed">Closed — Voting ended</option>
              </select>
            </div>

            {/* Status info strip */}
            <div className={`p-4 rounded-2xl border text-xs font-semibold leading-relaxed
              ${form.status === 'active'  ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                form.status === 'pending' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                            'bg-slate-50 border-slate-100 text-slate-500'}`}>
              {form.status === 'active'  && '✓ Residents can cast votes. Only one election can be active at a time.'}
              {form.status === 'pending' && '⏳ Election is scheduled but voting has not started yet.'}
              {form.status === 'closed'  && '🔒 Voting is closed. Results are available for viewing.'}
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6 shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer">
              Discard
            </button>
            <button type="submit"
              className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all">
              {isEditing ? 'Save Changes' : 'Create Election'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Detail View ──────────────────────────────────────────────────────────────
const ElectionDetailView = ({ election, electionTab, setElectionTab, onBack, totalEligible }) => {
  const participation = totalEligible > 0
    ? ((election.votes_count / totalEligible) * 100).toFixed(1)
    : '0.0';

  const tabs = [
    { key: 'overview',   icon: LayoutDashboard, label: 'Overview'   },
    { key: 'candidates', icon: UserPlus,         label: 'Candidates' },
    { key: 'results',    icon: BarChart2,         label: 'Results'    },
  ];

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen animate-in fade-in duration-300">

      {/* Back */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-[#006837] font-bold mb-6 transition-colors group cursor-pointer">
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        Back to Elections
      </button>

      {/* Election header banner */}
      <div className="bg-gradient-to-br from-[#006837] to-[#004d29] rounded-3xl p-7 mb-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#FFF200]/10 rounded-full translate-y-20 -translate-x-10" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full
                  ${election.status === 'active' ? 'bg-[#FFF200] text-[#006837]' :
                    election.status === 'pending' ? 'bg-amber-300 text-amber-900' :
                    'bg-white/20 text-white'}`}>
                  {election.status}
                </span>
              </div>
              <h1 className="text-2xl font-black leading-tight">{election.title}</h1>
              {election.description && (
                <p className="text-white/70 text-sm mt-1 leading-relaxed">{election.description}</p>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-4 mt-5">
            {[
              { icon: Activity,   label: 'Votes Cast',     value: election.votes_count || 0         },
              { icon: TrendingUp, label: 'Participation',  value: `${participation}%`               },
              { icon: Calendar,   label: 'Ends',           value: formatDisplayDate(election.end_date) },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon size={12} className="text-white/60" />
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{s.label}</p>
                </div>
                <p className="text-xl font-black text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-2xl p-1 border border-slate-100 shadow-sm w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setElectionTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer
              ${electionTab === t.key
                ? 'bg-[#006837] text-white shadow-lg shadow-[#006837]/20'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-in fade-in duration-200">
        {electionTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-5">Election Details</h3>
              <div className="space-y-4">
                {[
                  { icon: Calendar,   label: 'Start Date',   value: formatDisplayDate(election.start_date) },
                  { icon: Clock,      label: 'End Date',     value: formatDisplayDate(election.end_date)   },
                  { icon: Users,      label: 'Total Votes',  value: `${election.votes_count || 0} ballots cast` },
                  { icon: TrendingUp, label: 'Eligible',     value: `${totalEligible} residents`           },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                    <div className="w-9 h-9 bg-[#006837]/10 rounded-xl flex items-center justify-center shrink-0">
                      <r.icon size={16} className="text-[#006837]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{r.label}</p>
                      <p className="text-sm font-bold text-slate-800">{r.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Participation donut */}
            <div className="bg-gradient-to-br from-[#006837]/5 to-[#006837]/10 rounded-2xl border border-[#006837]/10 p-6 flex flex-col items-center justify-center text-center">
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#006837" strokeWidth="10"
                    strokeDasharray={`${parseFloat(participation) * 2.51} 251`}
                    strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-black text-[#006837]">{participation}%</p>
                </div>
              </div>
              <p className="text-sm font-black text-slate-700">Voter Turnout</p>
              <p className="text-xs text-slate-400 mt-1">{election.votes_count || 0} of {totalEligible} voted</p>
            </div>
          </div>
        )}

        {electionTab === 'candidates' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <CandidateManager electionId={election.id} />
          </div>
        )}

        {electionTab === 'results' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-2">
            <Results electionId={election.id} onBack={onBack} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main ElectionPage ────────────────────────────────────────────────────────
const ElectionPage = () => {
  // ── Role — read inside component so it's always fresh after login ──────
  const currentUserRole = sessionStorage.getItem('userRole') || 'resident';
  const canManage = currentUserRole === 'elecom' || currentUserRole === 'super_admin';

  const [elections,          setElections]          = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [activeTab,          setActiveTab]          = useState('all');
  const [electionFilter,     setElectionFilter]     = useState('all');
  const [isModalOpen,        setIsModalOpen]        = useState(false);
  const [isEditing,          setIsEditing]          = useState(false);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [electionTab,        setElectionTab]        = useState('overview');
  const [totalEligible,      setTotalEligible]      = useState(0);
  const [notification,       setNotification]       = useState({ show: false, title: '', message: '', type: 'success' });
  const [deleteConfirm,      setDeleteConfirm]      = useState({ show: false, id: null });
  const [form,               setForm]               = useState({ title: '', description: '', start_date: '', end_date: '', status: 'pending' });

  const notify = (title, message, type = 'success') =>
    setNotification({ show: true, title, message, type });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const getTotalEligible = async () => {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      setTotalEligible(count || 0);
    };
    getTotalEligible();
    fetchElections();
  }, []);

  useEffect(() => {
    if (selectedElectionId) fetchVotesForSelected();
  }, [selectedElectionId]);

  const fetchVotesForSelected = async () => {
    const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('election_id', selectedElectionId);
    setElections(prev => prev.map(e => e.id === selectedElectionId ? { ...e, votes_count: count || 0 } : e));
  };

  const checkAndCloseExpired = async (list) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expired = list.filter(e => {
      if (e.status !== 'active' || !e.end_date) return false;
      const end = new Date(e.end_date); end.setHours(0, 0, 0, 0);
      return end.getTime() <= today.getTime();
    });
    if (!expired.length) return;
    await supabase.from('elections').update({ status: 'closed' }).in('id', expired.map(e => e.id));
    setElections(prev => prev.map(e => expired.some(x => x.id === e.id) ? { ...e, status: 'closed' } : e));
  };

  const fetchElections = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('elections').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const withVotes = await Promise.all((data || []).map(async el => {
        const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('election_id', el.id);
        return { ...el, votes_count: count || 0 };
      }));
      setElections(withVotes);
      if (data) checkAndCloseExpired(data);
    } catch (e) {
      logger.error('fetchElections', { error: e.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Create / Update ───────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endD  = new Date(form.end_date); endD.setHours(0, 0, 0, 0);

    if (form.status === 'active' && endD.getTime() <= today.getTime()) {
      notify('Action Restricted', 'Cannot open an election that is already on or past its end date.', 'error'); return;
    }
    if (form.status === 'active' && elections.some(e => e.status === 'active' && e.id !== form.id)) {
      notify('Action Restricted', 'Only one election can be active at a time. Close the current one first.', 'error'); return;
    }

    try {
      if (isEditing) {
        const { votes_count, ...payload } = form;
        const { error } = await supabase.from('elections').update(payload).eq('id', form.id);
        if (error) throw error;
        setElections(prev => prev.map(e => e.id === form.id ? { ...form, votes_count: e.votes_count } : e));
        closeForm();
        notify('Updated!', 'Election details have been saved.');
      } else {
        const { data, error } = await supabase.from('elections').insert([form]).select();
        if (error) throw error;
        setElections(prev => [{ ...data[0], votes_count: 0 }, ...prev]);
        closeForm();
        notify('Election Created!', 'The election is ready. You can now add candidates.');
      }
    } catch (e) {
      notify('Error', e.message, 'error');
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('elections').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      setElections(prev => prev.filter(e => e.id !== deleteConfirm.id));
      setDeleteConfirm({ show: false, id: null });
      notify('Deleted', 'The election has been removed.');
    } catch (e) {
      notify('Error', e.message, 'error');
    }
  };

  const openEdit = (election) => {
    setForm({ ...election, start_date: formatDate(election.start_date), end_date: formatDate(election.end_date) });
    setIsEditing(true); setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false); setIsEditing(false);
    setForm({ title: '', description: '', start_date: '', end_date: '', status: 'pending' });
  };

  // ── Selected election detail view ─────────────────────────────────────────
  if (activeTab === 'candidates') return <CandidatesPage onBack={() => setActiveTab('all')} />;

  const selectedElection = elections.find(e => e.id === selectedElectionId);
  if (selectedElectionId && selectedElection) {
    return (
      <>
        <Toast n={notification} onClose={() => setNotification({ ...notification, show: false })} />
        <ElectionDetailView
          election={selectedElection}
          electionTab={electionTab}
          setElectionTab={setElectionTab}
          onBack={() => { setSelectedElectionId(null); setElectionTab('overview'); }}
          totalEligible={totalEligible}
        />
      </>
    );
  }

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = elections
    .filter(e => activeTab === 'results' ? e.status === 'closed'
      : activeTab === 'ongoing' ? e.status === 'active'
      : true)
    .filter(e => electionFilter === 'all' || e.id === electionFilter);
  const activeElection = elections.find(e => e.status === 'active');
  const totalVotes     = elections.reduce((s, e) => s + (e.votes_count || 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen space-y-6">

      <Toast n={notification} onClose={() => setNotification({ ...notification, show: false })} />
      <DeleteConfirm show={deleteConfirm.show}
        onCancel={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDelete} />

      <ElectionFormPanel
        isOpen={isModalOpen} isEditing={isEditing}
        form={form} onChange={setForm}
        onSubmit={handleSubmit} onClose={closeForm}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Vote size={22} className="text-[#006837]" />
            Election Management
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Create, manage, and monitor CREVHAI elections</p>
        </div>
        {canManage && (
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#006837]/20 transition-all cursor-pointer">
            <Plus size={16} /> Create Election
          </button>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Elections', value: elections.length,                                       icon: Vote,       bg: 'bg-[#006837]/10', color: 'text-[#006837]' },
          { label: 'Active Now',      value: elections.filter(e => e.status === 'active').length,    icon: Zap,        bg: 'bg-emerald-50',    color: 'text-emerald-600' },
          { label: 'Total Votes',     value: totalVotes,                                             icon: Users,      bg: 'bg-blue-50',       color: 'text-blue-600' },
          { label: 'Completed',       value: elections.filter(e => e.status === 'closed').length,    icon: Trophy,     bg: 'bg-amber-50',      color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k.label}</p>
                <p className="text-3xl font-black text-slate-900">{k.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${k.bg}`}><k.icon size={18} className={k.color} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Active election banner — only on the "All Elections" tab; it was
          previously rendered unconditionally above every tab, including
          "Completed", making the active election look like it belonged there ── */}
      {activeTab === 'all' && (activeElection ? (
        <div className="bg-gradient-to-r from-[#006837] to-[#34a853] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24 pointer-events-none" />
          <div className="flex items-center gap-4 relative">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Activity size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black bg-[#FFF200] text-[#006837] px-2 py-0.5 rounded-full uppercase tracking-wider">Live Now</span>
              </div>
              <h2 className="text-lg font-black text-white leading-tight">{activeElection.title}</h2>
              <p className="text-white/70 text-xs font-semibold">Voting ends {formatDisplayDate(activeElection.end_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 relative shrink-0">
            <div className="text-right">
              <p className="text-2xl font-black text-white">{activeElection.votes_count || 0}</p>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Votes Cast</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-[#FFF200]">
                {totalEligible > 0 ? ((activeElection.votes_count / totalEligible) * 100).toFixed(1) : '0.0'}%
              </p>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Turnout</p>
            </div>
            <button onClick={() => { setSelectedElectionId(activeElection.id); setElectionTab('overview'); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold cursor-pointer transition-all border border-white/20">
              View <ChevronRight size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={20} className="text-slate-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-500">No Active Election</h2>
            <p className="text-xs text-slate-400">No election is currently open for voting.</p>
          </div>
          {canManage && (
            <button onClick={() => setIsModalOpen(true)}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] rounded-xl text-xs font-bold cursor-pointer transition-all">
              <Plus size={13} /> Create One
            </button>
          )}
        </div>
      ))}

      {/* ── Tab filter + grid ── */}
      {elections.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {[
              { key: 'all',       label: 'All Elections' },
              { key: 'ongoing',   label: 'Ongoing'       },
              { key: 'results',   label: 'Completed'     },
              { key: 'candidates',label: 'Candidates'    },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                  ${activeTab === t.key ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <ResidentFilterSelect
            value={electionFilter}
            onChange={setElectionFilter}
            options={elections.map(el => ({ value: el.id, label: el.title }))}
            allValue="all"
            allLabel="All Elections"
            icon={Filter}
            className="w-56"
          />
        </div>
      )}

      {/* ── Elections grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
          <p className="text-sm text-[#006837] font-semibold animate-pulse">Loading elections…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-3xl">
          <SearchX size={40} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-700 mb-1">
            {activeTab === 'results' ? 'No Completed Elections'
              : activeTab === 'ongoing' ? 'No Ongoing Elections'
              : 'No Elections Yet'}
          </h3>
          <p className="text-sm text-slate-400 mb-5">
            {activeTab === 'results' ? 'Closed elections will appear here.'
              : activeTab === 'ongoing' ? 'Elections currently open for voting will appear here.'
              : 'Create your first election to get started.'}
          </p>
          {canManage && activeTab !== 'results' && activeTab !== 'ongoing' && (
            <button onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all">
              <Plus size={16} /> Create Election
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(election => (
            <ElectionCard
              key={election.id}
              election={election}
              canManage={canManage}
              onView={id => { setSelectedElectionId(id); setElectionTab('overview'); }}
              onEdit={openEdit}
              onDelete={id => setDeleteConfirm({ show: true, id })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ElectionPage;
