import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseAdmin";
import {
  UserPlus, Trash2, User, Camera, X,
  CheckCircle, AlertCircle, Loader2, Vote,
  Plus, Search, Pencil, Eye, ZoomIn,
} from "lucide-react";
import logger from '../auditLogger';


// ─── Constants ────────────────────────────────────────────────────────────────
const POSITIONS = ["President", "Vice President", "Secretary", "Treasurer", "Auditor", "Board Member"];

const POSITION_COLORS = {
  "President":      "bg-[#006837]/10 text-[#006837] border-[#006837]/20",
  "Vice President": "bg-blue-50 text-blue-700 border-blue-100",
  "Secretary":      "bg-violet-50 text-violet-700 border-violet-100",
  "Treasurer":      "bg-amber-50 text-amber-700 border-amber-100",
  "Auditor":        "bg-rose-50 text-rose-700 border-rose-100",
  "Board Member":   "bg-slate-100 text-slate-600 border-slate-200",
};

// ─── Notification Modal ───────────────────────────────────────────────────────
const NotifModal = ({ n, onClose }) => {
  if (!n.show) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl text-center border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 ${n.type === 'success' ? 'bg-emerald-50' : 'bg-red-50'}`}>
          {n.type === 'success' ? <CheckCircle size={26} className="text-emerald-500" /> : <AlertCircle size={26} className="text-red-500" />}
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2">{n.title}</h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">{n.message}</p>
        <button onClick={onClose} className="w-full py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold transition-all cursor-pointer">Continue</button>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteModal = ({ show, candidateName, onCancel, onConfirm }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4 mx-auto"><Trash2 size={24} className="text-red-500" /></div>
        <h3 className="text-lg font-black text-slate-900 mb-1 text-center">Remove Candidate?</h3>
        {candidateName && <p className="text-sm text-slate-500 text-center mb-1"><span className="font-bold text-slate-700">{candidateName}</span> will be removed.</p>}
        <p className="text-xs text-slate-400 text-center mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-100 cursor-pointer">Remove</button>
        </div>
      </div>
    </div>
  );
};

// ─── Photo Viewer Modal ───────────────────────────────────────────────────────
const PhotoViewer = ({ candidate, canManage, onClose, onEdit }) => {
  const [zoomed, setZoomed] = useState(false);
  if (!candidate) return null;
  const posColor = POSITION_COLORS[candidate.position] || POSITION_COLORS["Board Member"];
  const closeAll = () => { setZoomed(false); onClose(); };
  return (
    <>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in"
        onClick={closeAll}>
        <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}>
          {/* Header — small rounded avatar instead of a full-bleed photo (matches
              the icon-style header used in CandidatesPage.jsx's own candidate
              profile modal, rather than stretching the photo edge-to-edge) */}
          <div className="relative bg-gradient-to-br from-[#006837] to-[#004d29] pt-8 pb-6 px-6 text-center">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {canManage && (
                <button onClick={() => onEdit(candidate)}
                  className="w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-xl flex items-center justify-center cursor-pointer transition-all"
                  title="Edit">
                  <Pencil size={14} />
                </button>
              )}
              <button onClick={closeAll}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-xl flex items-center justify-center cursor-pointer transition-all"
                title="Close">
                <X size={15} />
              </button>
            </div>
            {/* Click to view full-size — opens the in-app lightbox below, not a new tab */}
            <button type="button" onClick={() => candidate.photo_url && setZoomed(true)}
              className="group relative w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/30 shadow-xl mx-auto mb-3 bg-white/10 flex items-center justify-center cursor-pointer"
              title={candidate.photo_url ? 'View full photo' : undefined}>
              {candidate.photo_url ? (
                <>
                  <img src={candidate.photo_url} alt={candidate.full_name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : <User size={32} className="text-white/40" />}
            </button>
            <h2 className="text-xl font-black text-white leading-tight">{candidate.full_name}</h2>
          </div>
          {/* Info */}
          <div className="p-6">
            <div className="flex items-center justify-center mb-3">
              <span className={`inline-flex text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${posColor}`}>
                {candidate.position}
              </span>
            </div>
            {candidate.manifesto && (
              <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Manifesto</p>
                <p className="text-sm text-slate-600 leading-relaxed italic">"{candidate.manifesto}"</p>
              </div>
            )}
            <button onClick={closeAll}
              className="w-full mt-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Full-size photo lightbox — stays in-app, never a new tab */}
      {zoomed && candidate.photo_url && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
          onClick={() => setZoomed(false)}>
          <img src={candidate.photo_url} alt={candidate.full_name}
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
          <button onClick={() => setZoomed(false)}
            className="absolute top-6 right-6 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-xl flex items-center justify-center cursor-pointer transition-all"
            title="Close">
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
};

// ─── Add / Edit Form Panel (slide-in) ─────────────────────────────────────────
const CandidateFormPanel = ({ isOpen, isEditing, onClose, form, setForm, onSubmit, uploading, isSubmitting, onImageUpload }) => {
  const [residentResults, setResidentResults] = useState([]);
  const [searchingResidents, setSearchingResidents] = useState(false);
  const [showResidentDropdown, setShowResidentDropdown] = useState(false);

  useEffect(() => {
    if (!isOpen) { setShowResidentDropdown(false); setResidentResults([]); }
  }, [isOpen]);

  const searchResidents = async (query) => {
    setSearchingResidents(true);
    let q = supabase.from('profiles').select('id, full_name, avatar_url, block, lot, street').order('full_name');
    if (query) q = q.ilike('full_name', `%${query}%`);
    const { data, error } = await q;
    setResidentResults(error ? [] : (data || []));
    setSearchingResidents(false);
  };

  const handleNameFocus = () => {
    setShowResidentDropdown(true);
    searchResidents(form.full_name);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setForm(p => ({ ...p, full_name: val }));
    setShowResidentDropdown(true);
    searchResidents(val);
  };

  const handleSelectResident = (resident) => {
    setForm(p => ({ ...p, full_name: resident.full_name, photo_url: resident.avatar_url || p.photo_url }));
    setShowResidentDropdown(false);
  };

  if (!isOpen) return null;
  const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all";
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#006837]/10 rounded-xl flex items-center justify-center">
              {isEditing ? <Pencil size={15} className="text-[#006837]" /> : <UserPlus size={15} className="text-[#006837]" />}
            </div>
            <h2 className="text-lg font-black text-slate-900">{isEditing ? 'Edit Candidate' : 'Register Candidate'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"><X size={18} /></button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex-1 flex flex-col p-6 overflow-y-auto gap-5">

          {/* Photo */}
          <div>
            <label className={labelCls}>Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                {form.photo_url
                  ? <img src={form.photo_url} alt="Preview" className="w-full h-full object-cover" />
                  : <User size={26} className="text-slate-300" />}
                {uploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-[#006837]" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 px-4 py-2 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] rounded-xl text-xs font-bold cursor-pointer transition-all">
                  <Camera size={13} />{uploading ? 'Uploading…' : 'Upload Photo'}
                  <input type="file" className="hidden" accept="image/*" onChange={onImageUpload} disabled={uploading} />
                </label>
                {form.photo_url && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, photo_url: '' }))}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-xs font-bold cursor-pointer transition-all">
                    <X size={12} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="relative">
            <label className={labelCls}>Full Name <span className="text-red-400">*</span></label>
            <input type="text" required placeholder="Search resident by name…" autoComplete="off"
              value={form.full_name}
              onChange={handleNameChange}
              onFocus={handleNameFocus}
              onBlur={() => setTimeout(() => setShowResidentDropdown(false), 150)}
              className={inputCls} />
            {showResidentDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {searchingResidents ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="animate-spin text-[#006837]" />
                  </div>
                ) : residentResults.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No residents found.</p>
                ) : (
                  residentResults.map(r => (
                    <button type="button" key={r.id} onClick={() => handleSelectResident(r)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#006837]/5 text-left cursor-pointer">
                      <div className="w-8 h-8 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={14} className="text-[#006837]" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{r.full_name}</p>
                        {(r.block || r.lot || r.street) && (
                          <p className="text-[10px] text-slate-400 truncate">
                            {[r.street, r.block && `Blk ${r.block}`, r.lot && `Lot ${r.lot}`].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Position */}
          <div>
            <label className={labelCls}>Position <span className="text-red-400">*</span></label>
            <select required value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
              className={inputCls + ' cursor-pointer'}>
              <option value="" disabled>Select position…</option>
              {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
            </select>
          </div>

          {/* Manifesto */}
          <div>
            <label className={labelCls}>Manifesto / Platform</label>
            <textarea rows={4} placeholder="Candidate's goals and platform for the community…"
              value={form.manifesto} onChange={e => setForm(p => ({ ...p, manifesto: e.target.value }))}
              className={inputCls + ' resize-none'} />
          </div>

          {/* Live preview */}
          {(form.full_name || form.position) && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0 overflow-hidden">
                {form.photo_url ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" /> : <Vote size={15} className="text-[#006837]" />}
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold">Preview</p>
                <p className="text-sm font-black text-slate-800">{form.full_name || 'Name…'}</p>
                {form.position && (
                  <span className={`inline-flex text-[10px] font-black px-2 py-0.5 rounded-full border mt-0.5 ${POSITION_COLORS[form.position] || ''}`}>
                    {form.position}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-auto">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer">
              Discard
            </button>
            <button type="submit" disabled={uploading || isSubmitting}
              className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              {isSubmitting
                ? <><Loader2 size={14} className="animate-spin" /> {isEditing ? 'Saving…' : 'Registering…'}</>
                : isEditing ? <><Pencil size={14} /> Save Changes</> : <><UserPlus size={14} /> Confirm Candidate</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Candidate Card ───────────────────────────────────────────────────────────
const CandidateCard = ({ c, onView, onEdit, onDelete, canManage }) => {
  const posColor = POSITION_COLORS[c.position] || POSITION_COLORS["Board Member"];
  return (
    <div className="group bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-[#006837]/20 transition-all duration-200 flex flex-col overflow-hidden">
      {/* Photo */}
      <div className="relative h-32 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={() => onView(c)}>
        {c.photo_url
          ? <img src={c.photo_url} alt={c.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-16 h-16 rounded-2xl bg-[#006837]/10 flex items-center justify-center"><User size={26} className="text-[#006837]" /></div>}

        {/* Photo zoom hint */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <ZoomIn size={12} className="text-slate-600" />
            <span className="text-[10px] font-bold text-slate-600">View</span>
          </div>
        </div>

        {/* Position badge */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/30 to-transparent">
          <span className={`inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${posColor}`}>
            {c.position}
          </span>
        </div>

        {/* Action buttons — top right, on hover */}
        {canManage && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button onClick={e => { e.stopPropagation(); onEdit(c); }}
              className="w-7 h-7 bg-white/90 hover:bg-[#006837] hover:text-white text-slate-500 rounded-xl flex items-center justify-center shadow-sm transition-all cursor-pointer"
              title="Edit">
              <Pencil size={12} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(c); }}
              className="w-7 h-7 bg-white/90 hover:bg-red-500 hover:text-white text-slate-500 rounded-xl flex items-center justify-center shadow-sm transition-all cursor-pointer"
              title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-sm font-black text-slate-900 truncate">{c.full_name}</p>
        <p className="text-xs text-slate-400 line-clamp-2 italic leading-relaxed mt-1.5 pt-2 border-t border-slate-50">
          "{c.manifesto || 'No manifesto provided.'}"
        </p>
        {/* View button */}
        <button onClick={() => onView(c)}
          className="mt-3 w-full py-2 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-[#006837]/10 text-slate-500 hover:text-[#006837] rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-100">
          <Eye size={12} /> View Profile
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
// ─── Access — inside component so it re-reads after login ───────────────────
const CandidateManager = ({ electionId }) => {
  const currentUserRole = localStorage.getItem('userRole') || 'resident';
  const canManage = currentUserRole === 'elecom' || currentUserRole === 'super_admin';
  const [candidates,    setCandidates]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [uploading,     setUploading]     = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [electionTitle, setElectionTitle] = useState('');
  const [showForm,      setShowForm]      = useState(false);
  const [isEditing,     setIsEditing]     = useState(false);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [posFilter,     setPosFilter]     = useState('All');
  const [viewCandidate, setViewCandidate] = useState(null);  // photo viewer
  const [notification,  setNotification]  = useState({ show: false, title: '', message: '', type: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, name: '' });
  const [form, setForm] = useState({ id: null, full_name: '', position: '', manifesto: '', photo_url: '' });

  const notify = (title, message, type = 'success') =>
    setNotification({ show: true, title, message, type });

  useEffect(() => {
    if (electionId) { fetchCandidates(); fetchElectionTitle(); }
  }, [electionId]);

  const fetchElectionTitle = async () => {
    const { data } = await supabase.from('elections').select('title').eq('id', electionId).single();
    if (data) setElectionTitle(data.title);
  };

  const fetchCandidates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidates')
      .select('id, position, manifesto, full_name, photo_url')
      .eq('election_id', electionId)
      .order('position');
    if (!error) setCandidates(data || []);
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `candidate-photos/${Math.random()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('candidatephotos').upload(filePath, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('candidatephotos').getPublicUrl(filePath);
      setForm(p => ({ ...p, photo_url: publicUrl }));
    } catch (err) {
      notify('Upload Error', err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const openAdd = () => {
    setForm({ id: null, full_name: '', position: '', manifesto: '', photo_url: '' });
    setIsEditing(false);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setForm({ id: c.id, full_name: c.full_name, position: c.position, manifesto: c.manifesto || '', photo_url: c.photo_url || '' });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditing && form.id) {
        // Update existing candidate
        const { error } = await supabase.from('candidates')
          .update({ full_name: form.full_name, position: form.position, manifesto: form.manifesto, photo_url: form.photo_url })
          .eq('id', form.id);
        if (error) throw error;
        logger.info('Candidate updated', { electionId, id: form.id });
        // Update viewCandidate if it's the same one being viewed
        if (viewCandidate?.id === form.id) {
          setViewCandidate({ ...viewCandidate, ...form });
        }
        notify('Updated!', `${form.full_name} has been updated successfully.`);
      } else {
        // Insert new candidate
        const { error } = await supabase.from('candidates')
          .insert([{ full_name: form.full_name, position: form.position, manifesto: form.manifesto, photo_url: form.photo_url, election_id: electionId }]);
        if (error) throw error;
        logger.info('Candidate added', { electionId, name: form.full_name });
        notify('Candidate Registered!', `${form.full_name} has been added to the election.`);
      }
      setShowForm(false);
      fetchCandidates();
    } catch (err) {
      notify('Error', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCandidate = async () => {
    const { error } = await supabase.from('candidates').delete().eq('id', deleteConfirm.id);
    if (error) {
      notify('Error', error.message, 'error');
    } else {
      logger.info('Candidate removed', { electionId, id: deleteConfirm.id });
      setDeleteConfirm({ show: false, id: null, name: '' });
      if (viewCandidate?.id === deleteConfirm.id) setViewCandidate(null);
      fetchCandidates();
      notify('Removed', 'Candidate has been removed from the election.');
    }
  };

  const filtered = candidates.filter(c => {
    const matchSearch = !searchTerm ||
      c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.position?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPos = posFilter === 'All' || c.position === posFilter;
    return matchSearch && matchPos;
  });

  const usedPositions = [...new Set(candidates.map(c => c.position).filter(Boolean))].sort();

  if (!electionId) return (
    <div className="p-12 text-center text-slate-400">
      <Vote size={36} className="mx-auto mb-3 text-slate-300" />
      <p className="font-semibold">Select an election to manage candidates.</p>
    </div>
  );

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">

      <NotifModal n={notification} onClose={() => setNotification({ ...notification, show: false })} />
      <DeleteModal show={deleteConfirm.show} candidateName={deleteConfirm.name}
        onCancel={() => setDeleteConfirm({ show: false, id: null, name: '' })}
        onConfirm={handleDeleteCandidate} />
      <PhotoViewer candidate={viewCandidate} canManage={canManage}
        onClose={() => setViewCandidate(null)}
        onEdit={c => { setViewCandidate(null); openEdit(c); }}
      />
      <CandidateFormPanel
        isOpen={showForm} isEditing={isEditing} onClose={() => setShowForm(false)}
        form={form} setForm={setForm} onSubmit={handleSubmit}
        uploading={uploading} isSubmitting={isSubmitting} onImageUpload={handleImageUpload}
      />

      {/* ── Header banner ── */}
      <div className="bg-gradient-to-br from-[#006837] to-[#004d29] rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#FFF200]/10 rounded-full translate-y-16 -translate-x-8 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Currently Managing</p>
            <h2 className="text-xl font-black leading-tight">{electionTitle || 'Loading…'}</h2>
            <p className="text-white/70 text-sm mt-1 font-semibold">
              {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          {canManage && (
            <button onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FFF200] hover:bg-yellow-300 text-[#006837] rounded-xl text-sm font-black shadow-lg cursor-pointer transition-all shrink-0">
              <Plus size={15} /> Add Candidate
            </button>
          )}
        </div>
        {/* Position breakdown pills */}
        {candidates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 relative">
            {POSITIONS.filter(pos => candidates.some(c => c.position === pos)).map(pos => (
              <div key={pos} className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-white/80 border border-white/10">
                {pos} ({candidates.filter(c => c.position === pos).length})
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search candidates…"
              className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] shadow-sm transition-all" />
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
            <button onClick={() => setPosFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                ${posFilter === 'All' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              All
            </button>
            {usedPositions.map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                  ${posFilter === pos ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {pos}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 font-medium ml-auto">{filtered.length} of {candidates.length}</p>
        </div>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium animate-pulse">Loading candidates…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <UserPlus size={36} className="text-slate-300 mb-3" />
          <p className="text-sm font-black text-slate-500 mb-1">
            {searchTerm || posFilter !== 'All' ? 'No candidates match your filter' : 'No candidates yet'}
          </p>
          <p className="text-xs text-slate-400 mb-5">
            {searchTerm || posFilter !== 'All' ? 'Try adjusting your search.' : 'Register the first candidate for this election.'}
          </p>
          {canManage && !searchTerm && posFilter === 'All' && (
            <button onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] rounded-xl text-xs font-bold cursor-pointer transition-all">
              <Plus size={14} /> Add First Candidate
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CandidateCard key={c.id} c={c}
              canManage={canManage}
              onView={setViewCandidate}
              onEdit={openEdit}
              onDelete={c => setDeleteConfirm({ show: true, id: c.id, name: c.full_name })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CandidateManager;
