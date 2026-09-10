import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Users, Clock, Eye, Edit, Trash2,
  ChevronDown, X, CheckCircle2, AlertCircle,
  Loader2, HelpCircle, Layers, Tag, DollarSign,
  WifiOff, Wrench, AlertTriangle, Building2, Package,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { Pannellum } from 'pannellum-react';
import logger from '../auditLogger';
import { fmt12, getItemAgreement, getItemAgreementText, UploadZone, inputCls, labelCls } from './facilityHelpers';
import FacilityEditModal from './FacilityEditModal';

// ─── Role guard ───────────────────────────────────────────────────────────────
const RequireRole = ({ userRole, allowedRoles, children }) => {
  if (allowedRoles.includes(userRole) || userRole === 'super_admin') return children;
  return null;
};

const logActivity = async (supabase, userEmail, activity, severity, details) => {
  try {
    await supabase.from('system_logs').insert([{
      user_email: userEmail, activity, severity, details,
      created_at: new Date().toISOString(),
    }]);
  } catch (err) { console.error('Failed to log:', err); }
};

// fmt12, getItemAgreement, getItemAgreementText, UploadZone moved to
// ./facilityHelpers — shared with the extracted FacilityEditModal.

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  'Available':         { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400', icon: CheckCircle2 },
  'Not Available':     { bg: 'bg-red-50',       text: 'text-red-600',     border: 'border-red-200',     dot: 'bg-red-400',     icon: WifiOff       },
  'Under Maintenance': { bg: 'bg-amber-50',     text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   icon: Wrench        },
  'Fully Booked':      { bg: 'bg-slate-100',    text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400',   icon: AlertTriangle },
};
const getStatus = (s) => STATUS_CFG[s] || STATUS_CFG['Available'];

// inputCls, labelCls moved to ./facilityHelpers — shared with FacilityEditModal.

// ─── TransactionModal ─────────────────────────────────────────────────────────
const TransactionModal = ({ status, message, onClose }) => {
  if (!status) return null;
  const cfg = {
    loading: { icon: <Loader2 className="w-10 h-10 text-[#006837] animate-spin" />, title: 'Processing…', bg: 'bg-[#006837]/10' },
    success: { icon: <CheckCircle2 className="w-10 h-10 text-[#006837]" />,         title: 'Done!',         bg: 'bg-[#006837]/10' },
    error:   { icon: <AlertCircle  className="w-10 h-10 text-red-500" />,            title: 'Failed',        bg: 'bg-red-50'       },
  }[status];
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className={`w-16 h-16 ${cfg.bg} rounded-2xl flex items-center justify-center mx-auto mb-5`}>{cfg.icon}</div>
        <h3 className="text-lg font-black text-slate-900 mb-1">{cfg.title}</h3>
        <p className="text-slate-500 text-sm mb-6">{message}</p>
        {status !== 'loading' && (
          <button onClick={onClose} className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all cursor-pointer">
            Continue
          </button>
        )}
      </div>
    </div>
  );
};

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-1">Delete this item?</h3>
        <p className="text-slate-400 text-sm mb-6">This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 cursor-pointer transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 shadow-lg shadow-red-100 cursor-pointer transition-all">Delete</button>
        </div>
      </div>
    </div>
  );
};

// ─── Facility Card ────────────────────────────────────────────────────────────
const FacilityCard = ({ fac, onView, onEdit, onDelete, currentUserRole }) => {
  const st  = getStatus(fac.status);
  const St  = st.icon;
  const isItem = fac.category === 'Amenity Item';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden shrink-0">
        {fac.image_360_url
          ? <img src={fac.image_360_url} alt={fac.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
              {isItem ? <Package size={36} /> : <Building2 size={36} />}
              <p className="text-[10px] font-bold uppercase tracking-wider">No Image</p>
            </div>}

        {/* Category pill */}
        <div className="absolute top-3 left-3">
          <span className="flex items-center gap-1 bg-slate-900/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            {isItem ? <Package size={9} /> : <Building2 size={9} />}
            {isItem ? 'Item' : 'Facility'}
          </span>
        </div>

        {/* Status pill */}
        <div className="absolute top-3 right-3">
          <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
            <St size={9} />
            {fac.status}
          </span>
        </div>

        {/* 360 badge */}
        {fac.is_360 && (
          <div className="absolute bottom-3 right-3 bg-[#006837] text-white text-[9px] font-black px-2 py-0.5 rounded-full">360°</div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <h4 className="font-black text-slate-900 text-sm leading-tight">{fac.name}</h4>
          {!isItem && (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
              {fac.description || 'No description provided.'}
            </p>
          )}
          {isItem && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                <Package size={9} /> {fac.amount ?? 0} available
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                <Layers size={9} /> {fac.total_quantity ?? fac.amount ?? 0} total stock
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle size={9} /> Liability agreement applies
              </span>
            </div>
          )}
        </div>

        {/* Metadata chips */}
        {!isItem && (
          <div className="flex flex-wrap gap-1.5">
            {fac.capacity && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                <Users size={10} className="text-[#006837]" /> {fac.capacity}
              </span>
            )}
            {fac.rate && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                <DollarSign size={10} className="text-[#006837]" /> {fac.rate}
              </span>
            )}
            {fac.hours && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                <Clock size={10} className="text-[#006837]" /> {fmt12(fac.hours)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button onClick={() => onView(fac)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
          <Eye size={13} /> View
        </button>
        <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary']}>
          <button onClick={() => onEdit(fac)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#006837]/10 hover:bg-[#006837]/20 text-[#006837] text-xs font-bold rounded-xl cursor-pointer transition-all">
            <Edit size={13} /> Edit
          </button>
          <button onClick={() => onDelete(fac.id)}
            className="w-10 flex items-center justify-center py-2.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl cursor-pointer transition-all border border-red-100">
            <Trash2 size={13} />
          </button>
        </RequireRole>
      </div>
    </div>
  );
};

// ─── Add Facility / Add Item modal — landscape, two columns ─────────────────
// `left` and `right` are JSX nodes rather than a flat children list, so each
// caller controls exactly how its fields split across the two columns.
const FacilityFormModal = ({ title, subtitle, icon: Icon, onClose, onSubmit, submitLabel, left, right }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
    <div
      className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-11 h-11 rounded-2xl bg-[#006837]/10 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-[#006837]" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* Landscape body — two columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto">
        <div className="p-7 space-y-5">{left}</div>
        <div className="p-7 space-y-5 bg-slate-50/50">{right}</div>
      </div>

      {/* Footer */}
      <div className="px-7 py-5 border-t border-slate-100 flex gap-3 shrink-0">
        <button onClick={onClose}
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-bold cursor-pointer transition-all">
          Cancel
        </button>
        <button onClick={onSubmit}
          className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all">
          {submitLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Facility = () => {
  const [facilities,          setFacilities]          = useState([]);
  const [isLoading,           setIsLoading]           = useState(true);
  const [search,              setSearch]              = useState('');
  const [categoryFilter,      setCategoryFilter]      = useState('All');
  const [viewingFacility,     setViewingFacility]     = useState(null);
  const [editingFacility,     setEditingFacility]     = useState(null);
  const [isAddFacilityOpen,   setIsAddFacilityOpen]   = useState(false);
  const [isAddItemOpen,       setIsAddItemOpen]       = useState(false);
  const [transaction,         setTransaction]         = useState({ status: null, message: '' });
  const [confirmData,         setConfirmData]         = useState({ isOpen: false, id: null });
  const [file,                setFile]                = useState(null);
  const [is360,               setIs360]               = useState(false);

  const [newFacility, setNewFacility] = useState({ name: '', description: '', capacity: '', rate: '', opening_time: '', closing_time: '', status: 'Available' });
  const [newItem,     setNewItem]     = useState({ name: '', status: 'Available', amount: '' });

  const currentUserRole = localStorage.getItem('userRole') || 'resident';

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('facilities').select('*').order('created_at', { ascending: false });
      if (!error) setFacilities(data);
      setIsLoading(false);
    })();
  }, []);

  // ── Upload helper ────────────────────────────────────────────────────────
  const uploadImage = async () => {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const path = `${Math.random()}.${ext}`;
    const { error } = await supabase.storage.from('amenity-images').upload(path, file);
    if (error) throw error;
    return supabase.storage.from('amenity-images').getPublicUrl(path).data.publicUrl;
  };

  // ── Add Facility ─────────────────────────────────────────────────────────
  const handleAddFacility = async () => {
    setTransaction({ status: 'loading', message: 'Creating facility…' });
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const url = await uploadImage();
      const { data, error } = await supabase.from('facilities').insert([{
        name: newFacility.name, description: newFacility.description,
        capacity: newFacility.capacity, rate: `₱${newFacility.rate}`,
        hours: `${newFacility.opening_time} - ${newFacility.closing_time}`,
        status: newFacility.status, category: 'Amenity Facility',
        image_360_url: url, is_360: is360,
      }]).select();
      if (error) throw error;
      await logActivity(supabase, user?.email, 'Create Facility', 'info', `Created: ${newFacility.name}`);
      setFacilities(p => [data[0], ...p]);
      setIsAddFacilityOpen(false);
      setFile(null); setIs360(false);
      setNewFacility({ name: '', description: '', capacity: '', rate: '', opening_time: '', closing_time: '', status: 'Available' });
      setTransaction({ status: 'success', message: 'Facility created successfully!' });
    } catch (e) {
      await logActivity(supabase, user?.email, 'Create Facility Failed', 'error', e.message);
      setTransaction({ status: 'error', message: e.message });
    }
  };

  // ── Add Item ─────────────────────────────────────────────────────────────
  const handleAddItem = async () => {
    setTransaction({ status: 'loading', message: 'Adding item…' });
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const url = await uploadImage();
      // Description is now fully auto-generated from the liability terms —
      // there's no separate free-text description field anymore.
      const fullDescription = getItemAgreementText(newItem.name);
      const amountVal = parseInt(newItem.amount, 10) || 0;
      const { data, error } = await supabase.from('facilities').insert([{
        name: newItem.name, description: fullDescription,
        status: amountVal > 0 ? newItem.status : 'Not Available',
        category: 'Amenity Item', amount: amountVal, total_quantity: amountVal,
        image_360_url: url, is_360: is360,
      }]).select();
      if (error) throw error;
      await logActivity(supabase, user?.email, 'Add Amenity Item', 'info', `Added: ${newItem.name}`);
      setFacilities(p => [data[0], ...p]);
      setIsAddItemOpen(false);
      setFile(null); setIs360(false);
      setNewItem({ name: '', status: 'Available', amount: '' });
      setTransaction({ status: 'success', message: 'Item added successfully!' });
    } catch (e) {
      await logActivity(supabase, user?.email, 'Add Amenity Item Failed', 'error', e.message);
      setTransaction({ status: 'error', message: e.message });
    }
  };

  // ── Update ───────────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    setTransaction({ status: 'loading', message: 'Saving changes…' });
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const url = file ? await uploadImage() : editingFacility.image_360_url;
      // Amenity Items: description is fully auto-generated from liability terms.
      // Amenity Facilities: keep whatever free text the admin wrote.
      const finalDescription = editingFacility.category === 'Amenity Item'
        ? getItemAgreementText(editingFacility.name)
        : editingFacility.description;

      // Auto-sync status with stock for Amenity Items: 0 left → Not Available.
      // If admin restocks above 0 while it was auto-flipped, bring it back to Available.
      let finalStatus = editingFacility.status;
      if (editingFacility.category === 'Amenity Item') {
        const amt = parseInt(editingFacility.amount, 10) || 0;
        if (amt <= 0) finalStatus = 'Not Available';
        else if (editingFacility.status === 'Not Available' && amt > 0) finalStatus = 'Available';
      }

      // opening_time/closing_time are transient fields the edit form uses to
      // split the DB's single `hours` string into two time inputs — they
      // aren't real columns, so they're rebuilt into `hours` here and never
      // sent to Supabase directly.
      const { opening_time, closing_time, ...facilityFields } = editingFacility;
      const finalHours = editingFacility.category === 'Amenity Facility'
        ? `${opening_time || ''} - ${closing_time || ''}`
        : editingFacility.hours;

      const updated = { ...facilityFields, description: finalDescription, status: finalStatus, hours: finalHours, image_360_url: url, is_360: is360 };
      const { error } = await supabase.from('facilities').update(updated).eq('id', editingFacility.id);
      if (error) throw error;
      await logActivity(supabase, user?.email, 'Update Facility', 'info', `Updated: ${editingFacility.name}`);
      setFacilities(p => p.map(f => f.id === editingFacility.id ? updated : f));
      setEditingFacility(null); setFile(null); setIs360(false);
      setTransaction({ status: 'success', message: 'Changes saved!' });
    } catch (e) {
      await logActivity(supabase, user?.email, 'Update Failed', 'error', e.message);
      setTransaction({ status: 'error', message: e.message });
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const executeDelete = async () => {
    const id   = confirmData.id;
    const item = facilities.find(f => f.id === id);
    setConfirmData({ isOpen: false, id: null });
    setTransaction({ status: 'loading', message: 'Deleting…' });
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const { error } = await supabase.from('facilities').delete().eq('id', id);
      if (error) throw error;
      await logActivity(supabase, user?.email, 'Delete Facility', 'info', `Deleted: ${item?.name}`);
      setFacilities(p => p.filter(f => f.id !== id));
      setTransaction({ status: 'success', message: 'Item removed.' });
    } catch (e) {
      await logActivity(supabase, user?.email, 'Delete Failed', 'error', e.message);
      setTransaction({ status: 'error', message: e.message });
    }
  };

  const filtered = facilities.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) &&
    (categoryFilter === 'All' || f.category === categoryFilter)
  );

  const counts = {
    total:       facilities.length,
    available:   facilities.filter(f => f.status === 'Available').length,
    maintenance: facilities.filter(f => f.status === 'Under Maintenance').length,
    facilities:  facilities.filter(f => f.category === 'Amenity Facility').length,
    items:       facilities.filter(f => f.category === 'Amenity Item').length,
  };

  return (
    <section className="space-y-6">
      <TransactionModal status={transaction.status} message={transaction.message} onClose={() => setTransaction({ status: null, message: '' })} />
      <ConfirmModal isOpen={confirmData.isOpen} onConfirm={executeDelete} onCancel={() => setConfirmData({ isOpen: false, id: null })} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Building2 size={22} className="text-[#006837]" /> Amenity Management
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage community facilities, items, and availability</p>
        </div>
        <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary']}>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => { setIsAddItemOpen(true); setFile(null); setIs360(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm cursor-pointer transition-all">
              <Plus size={15} /> Add Item
            </button>
            <button onClick={() => { setIsAddFacilityOpen(true); setFile(null); setIs360(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#006837]/20 cursor-pointer transition-all">
              <Plus size={15} /> Add Facility
            </button>
          </div>
        </RequireRole>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',        value: counts.total,       color: 'text-slate-700'    },
          { label: 'Available',    value: counts.available,   color: 'text-emerald-700'  },
          { label: 'Maintenance',  value: counts.maintenance, color: 'text-amber-700'    },
          { label: 'Facilities',   value: counts.facilities,  color: 'text-[#006837]'    },
          { label: 'Items',        value: counts.items,       color: 'text-blue-700'     },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-black ${k.color} mt-0.5`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search amenities…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {['All','Amenity Facility','Amenity Item'].map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                ${categoryFilter === cat ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {cat === 'All' ? 'All' : cat === 'Amenity Facility' ? 'Facilities' : 'Items'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
          <p className="text-sm text-[#006837] font-semibold animate-pulse">Loading amenities…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <Building2 size={36} className="text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-400">No amenities found</p>
          <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(fac => (
            <FacilityCard key={fac.id} fac={fac} currentUserRole={currentUserRole}
              onView={setViewingFacility}
              onEdit={f => {
                // Hours are stored as a single "HH:MM - HH:MM" string — split
                // it back into the two time inputs the edit form now uses.
                const [opening_time = '', closing_time = ''] = (f.hours || '').split(' - ').map(s => s.trim());
                setEditingFacility({ ...f, opening_time, closing_time });
                setIs360(f.is_360 || false);
                setFile(null);
              }}
              onDelete={id => setConfirmData({ isOpen: true, id })}
            />
          ))}
        </div>
      )}

      {/* ── Add Facility Modal ── */}
      {isAddFacilityOpen && (
        <FacilityFormModal title="Add New Facility" subtitle="Amenity Facility" icon={Building2}
          onClose={() => setIsAddFacilityOpen(false)}
          onSubmit={handleAddFacility} submitLabel="Create Facility"
          left={<>
            <div><label className={labelCls}>Facility Name</label><input className={inputCls} placeholder="e.g. Covered Court" value={newFacility.name} onChange={e => setNewFacility(p => ({...p, name: e.target.value}))} /></div>
            <div>
              <label className={labelCls}>Status</label>
              <div className="relative">
                <select className={`${inputCls} appearance-none cursor-pointer`} value={newFacility.status} onChange={e => setNewFacility(p => ({...p, status: e.target.value}))}>
                  <option>Available</option><option>Not Available</option><option>Under Maintenance</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Photo</label>
              <UploadZone file={file} onFile={setFile} is360={is360} onIs360={setIs360} inputId="add-fac-img" hint="Upload facility photo" />
            </div>
          </>}
          right={<>
            <div><label className={labelCls}>Description</label><textarea rows={4} className={inputCls} placeholder="Describe the facility…" value={newFacility.description} onChange={e => setNewFacility(p => ({...p, description: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Capacity</label><input className={inputCls} placeholder="e.g. 50 pax" value={newFacility.capacity} onChange={e => setNewFacility(p => ({...p, capacity: e.target.value}))} /></div>
              <div><label className={labelCls}>Hourly Rate (₱)</label><input type="number" className={inputCls} placeholder="0.00" value={newFacility.rate} onChange={e => setNewFacility(p => ({...p, rate: e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Opening Time</label><input type="time" className={`${inputCls} cursor-pointer`} value={newFacility.opening_time} onChange={e => setNewFacility(p => ({...p, opening_time: e.target.value}))} /></div>
              <div><label className={labelCls}>Closing Time</label><input type="time" className={`${inputCls} cursor-pointer`} value={newFacility.closing_time} onChange={e => setNewFacility(p => ({...p, closing_time: e.target.value}))} /></div>
            </div>
          </>}
        />
      )}

      {/* ── Add Item Modal ── */}
      {isAddItemOpen && (
        <FacilityFormModal title="Add Amenity Item" subtitle="Amenity Item" icon={Package}
          onClose={() => setIsAddItemOpen(false)}
          onSubmit={handleAddItem} submitLabel="Add Item"
          left={<>
            <div><label className={labelCls}>Item Name</label><input className={inputCls} placeholder="e.g. Folding Chairs" value={newItem.name} onChange={e => setNewItem(p => ({...p, name: e.target.value}))} /></div>
            <div>
              <label className={labelCls}>Status</label>
              <div className="relative">
                <select className={`${inputCls} appearance-none cursor-pointer`} value={newItem.status} onChange={e => setNewItem(p => ({...p, status: e.target.value}))}>
                  <option>Available</option><option>Not Available</option><option>Under Maintenance</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Photo</label>
              <UploadZone file={file} onFile={setFile} is360={is360} onIs360={setIs360} inputId="add-item-img" hint="Upload item photo" />
            </div>
          </>}
          right={<>
            <div>
              <label className={labelCls}>Total Stock</label>
              <input type="number" min="0" className={inputCls} placeholder="e.g. 43" value={newItem.amount}
                onChange={e => setNewItem(p => ({...p, amount: e.target.value}))} />
              <p className="text-xs text-slate-500 mt-1.5">Total units the HOA owns — all of them start out available to borrow.</p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <div className="flex items-center gap-2 mb-2.5">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Borrower's Agreement</p>
              </div>
              <ul className="space-y-1.5">
                {getItemAgreement(newItem.name || 'item').map(({ label, text }) => (
                  <li key={label} className="text-xs text-amber-900 leading-relaxed flex gap-1.5">
                    <span className="font-black shrink-0">•</span>
                    <span><span className="font-bold">{label}:</span> {text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>}
        />
      )}

      {/* ── Edit Modal ── */}
      <FacilityEditModal
        facility={editingFacility}
        setFacility={setEditingFacility}
        file={file} setFile={setFile}
        is360={is360} setIs360={setIs360}
        onClose={() => { setEditingFacility(null); setFile(null); }}
        onSubmit={handleUpdate}
      />

      {/* ── View Modal ── */}
      {viewingFacility && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col lg:flex-row" style={{ height: '78vh' }}>
              {/* Image panel */}
              <div className="lg:w-[58%] bg-slate-900 relative overflow-hidden shrink-0">
                {viewingFacility.image_360_url ? (
                  viewingFacility.is_360 && viewingFacility.show360 ? (
                    <Pannellum width="100%" height="100%" image={viewingFacility.image_360_url}
                      pitch={10} yaw={180} hfov={110} autoLoad showZoomCtrl={false} />
                  ) : (
                    <img src={viewingFacility.image_360_url} alt={viewingFacility.name} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-600">
                    <Building2 size={48} className="opacity-20" />
                    <p className="text-sm font-bold opacity-40 uppercase tracking-widest">No Image</p>
                  </div>
                )}
                {/* Overlay controls */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  {viewingFacility.is_360 && (
                    <button onClick={() => setViewingFacility(p => ({...p, show360: !p.show360}))}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer
                        ${viewingFacility.show360 ? 'bg-white text-[#006837]' : 'bg-[#006837] text-white'}`}>
                      {viewingFacility.show360 ? 'Exit 360°' : '360° View'}
                    </button>
                  )}
                  <div className="ml-auto">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${getStatus(viewingFacility.status).bg} ${getStatus(viewingFacility.status).text} ${getStatus(viewingFacility.status).border}`}>
                      {viewingFacility.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info panel */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <button onClick={() => setViewingFacility(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#006837] cursor-pointer transition-colors group">
                    ← Back
                  </button>

                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border
                      ${viewingFacility.category === 'Amenity Item' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-[#006837]/10 text-[#006837] border-[#006837]/20'}`}>
                      {viewingFacility.category}
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 mt-3 leading-tight">{viewingFacility.name}</h2>
                    {viewingFacility.category === 'Amenity Facility' && (
                      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                        {viewingFacility.description || 'No description.'}
                      </p>
                    )}
                  </div>

                  {/* Liability agreement — Amenity Items only */}
                  {viewingFacility.category === 'Amenity Item' && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                      <div className="flex items-center gap-2 mb-2.5">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Borrower's Agreement</p>
                      </div>
                      <ul className="space-y-2">
                        {getItemAgreement(viewingFacility.name).map(({ label, text }) => (
                          <li key={label} className="text-xs text-amber-800 leading-relaxed flex gap-2">
                            <span className="font-black shrink-0">•</span>
                            <span><span className="font-bold">{label}:</span> {text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="space-y-2.5">
                    {viewingFacility.category === 'Amenity Item' && (
                      <>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="w-8 h-8 bg-[#006837]/10 rounded-lg flex items-center justify-center shrink-0">
                            <Package size={14} className="text-[#006837]" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Available Stock</p>
                            <p className="text-sm font-bold text-slate-800">{viewingFacility.amount ?? 0} unit{(viewingFacility.amount ?? 0) !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="w-8 h-8 bg-[#006837]/10 rounded-lg flex items-center justify-center shrink-0">
                            <Layers size={14} className="text-[#006837]" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Stock</p>
                            <p className="text-sm font-bold text-slate-800">
                              {viewingFacility.total_quantity ?? viewingFacility.amount ?? 0} unit{(viewingFacility.total_quantity ?? viewingFacility.amount ?? 0) !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    {viewingFacility.capacity && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 bg-[#006837]/10 rounded-lg flex items-center justify-center shrink-0">
                          <Users size={14} className="text-[#006837]" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Capacity</p>
                          <p className="text-sm font-bold text-slate-800">{viewingFacility.capacity}</p>
                        </div>
                      </div>
                    )}
                    {viewingFacility.hours && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 bg-[#006837]/10 rounded-lg flex items-center justify-center shrink-0">
                          <Clock size={14} className="text-[#006837]" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hours</p>
                          <p className="text-sm font-bold text-slate-800">{fmt12(viewingFacility.hours)}</p>
                        </div>
                      </div>
                    )}
                    {viewingFacility.rate && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 bg-[#006837]/10 rounded-lg flex items-center justify-center shrink-0">
                          <DollarSign size={14} className="text-[#006837]" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rate</p>
                          <p className="text-sm font-bold text-slate-800">{viewingFacility.rate}/hr</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 border-t border-slate-100 shrink-0">
                  <button onClick={() => setViewingFacility(null)}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl cursor-pointer transition-all">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Facility;
