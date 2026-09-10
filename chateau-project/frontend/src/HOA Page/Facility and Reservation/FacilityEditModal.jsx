import React from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, AlertTriangle, Package, Building2 } from 'lucide-react';
import { getItemAgreement, UploadZone, inputCls, labelCls } from './facilityHelpers';

/**
 * FacilityEditModal — the "Edit Details" modal for one facility/item, opened
 * from a FacilityCard's Edit button on the Amenity Management page. Split
 * out of Facility.jsx's generic FacilityFormModal (still used for Add
 * Facility / Add Item) because the edit form specifically needed a wider,
 * more readable layout and a different field set for Amenity Facilities.
 *
 * Landscape layout on purpose: identity/media/status on the left, the
 * category-specific details on the right — reads faster side-by-side than
 * one long stacked column, same as the other "View/Edit Details" modals in
 * this app.
 *
 * For Amenity Facilities, Capacity was dropped from this form and replaced
 * with Opening/Closing Time — capacity rarely changes once a facility exists,
 * while operating hours are the field admins actually need to adjust after
 * creation (the Add Facility form already collects hours; this form just
 * never let you edit them afterward).
 *
 * Rendered through a portal straight to <body> — guarantees the backdrop is
 * always truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - facility: the editingFacility draft object (already merged with
 *    transient opening_time/closing_time fields by the caller), or null
 *  - setFacility: (updater) => void — same setState signature as useState
 *  - file, setFile, is360, setIs360: image upload state, owned by the parent
 *    (Facility.jsx) since it's shared with the Add forms' upload flow
 *  - onClose: () => void
 *  - onSubmit: () => void — persists the changes
 */
const FacilityEditModal = ({ facility, setFacility, file, setFile, is360, setIs360, onClose, onSubmit }) => {
  if (!facility) return null;
  const isItem = facility.category === 'Amenity Item';

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#006837]/10 flex items-center justify-center shrink-0">
              {isItem ? <Package size={18} className="text-[#006837]" /> : <Building2 size={18} className="text-[#006837]" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900 truncate">Edit Details</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">{facility.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Landscape body — identity/media/status left, details right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto">

          {/* Left — identity, image, status */}
          <div className="p-7 space-y-5">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={facility.name}
                onChange={e => setFacility(p => ({ ...p, name: e.target.value }))} />
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <div className="relative">
                <select className={`${inputCls} appearance-none cursor-pointer`} value={facility.status}
                  onChange={e => setFacility(p => ({ ...p, status: e.target.value }))}>
                  <option>Available</option><option>Not Available</option><option>Under Maintenance</option><option>Fully Booked</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Photo</label>
              <UploadZone file={file} onFile={setFile} is360={is360} onIs360={setIs360} inputId="edit-img"
                hint={facility.image_360_url && !file ? 'Current image kept — upload to replace' : 'Upload new image'} />
            </div>
          </div>

          {/* Right — category-specific details */}
          <div className="p-7 space-y-5 bg-slate-50/50">
            {isItem ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Available Stock</label>
                    <input type="number" min="0" className={inputCls} value={facility.amount ?? ''}
                      onChange={e => setFacility(p => ({ ...p, amount: e.target.value }))} />
                    <p className="text-xs text-slate-500 mt-1.5">Auto-switches to "Not Available" at 0.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Total Stock</label>
                    <input type="number" min="0" className={inputCls} value={facility.total_quantity ?? ''}
                      onChange={e => setFacility(p => ({ ...p, total_quantity: e.target.value }))} />
                    <p className="text-xs text-slate-500 mt-1.5">Total units owned, including borrowed ones.</p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2.5">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Auto-Generated Borrower's Agreement</p>
                  </div>
                  <ul className="space-y-1.5">
                    {getItemAgreement(facility.name).map(({ label, text }) => (
                      <li key={label} className="text-xs text-amber-900 leading-relaxed flex gap-1.5">
                        <span className="font-black shrink-0">•</span>
                        <span><span className="font-bold">{label}:</span> {text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea rows={4} className={inputCls} value={facility.description || ''}
                    onChange={e => setFacility(p => ({ ...p, description: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Capacity</label>
                    <input className={inputCls} value={facility.capacity || ''}
                      onChange={e => setFacility(p => ({ ...p, capacity: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Hourly Rate (₱)</label>
                    <input className={inputCls} value={facility.rate || ''}
                      onChange={e => setFacility(p => ({ ...p, rate: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Opening Time</label>
                    <input type="time" className={`${inputCls} cursor-pointer`} value={facility.opening_time || ''}
                      onChange={e => setFacility(p => ({ ...p, opening_time: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Closing Time</label>
                    <input type="time" className={`${inputCls} cursor-pointer`} value={facility.closing_time || ''}
                      onChange={e => setFacility(p => ({ ...p, closing_time: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-bold cursor-pointer transition-all">
            Cancel
          </button>
          <button onClick={onSubmit}
            className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all">
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FacilityEditModal;
