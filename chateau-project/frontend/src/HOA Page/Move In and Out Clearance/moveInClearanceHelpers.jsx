import React, { useState } from 'react';
import { supabase } from '../supabaseAdmin';
import { Eye, ZoomIn, ZoomOut, X, FileText } from 'lucide-react';

// Shared between MoveInClearance.jsx (row list) and ClearanceDetailModal.jsx
// (the "View Details" modal), so both agree on status colors, requirements,
// and how a private-bucket document is opened.

export const STATUS_CONFIG = {
  pending:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100',   dot: 'bg-amber-400',   label: 'Pending'  },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-400', label: 'Approved' },
  rejected: { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100',     dot: 'bg-red-400',     label: 'Rejected' },
};

export const StatusPill = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['pending'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// The CREVHAI physical clearance form's requirements checklist — varies by
// clearance type (move in/out) and resident type (owner/tenant).
export const getRequirements = (isMoveIn, isOwner) => {
  if (isMoveIn && isOwner) return ['Orientation with HOA President or HOA Treasurer'];
  if (isMoveIn && !isOwner) return [
    'HOA move out clearance or Barangay Clearance submitted',
    'Xerox copy of contract submitted to HOA',
    'Orientation with HOA President or Treasurer',
  ];
  if (!isMoveIn) return [
    'Cleared in all obligations with CREVHAI',
    'Clearance from Homeowner or Agent (for Renter)',
  ];
  return [];
};

// ── Extract the storage path from a full Supabase Storage URL ────────────────
// e.g. "https://….supabase.co/storage/v1/object/public/move-in-docs/proof-of-ownership/file.jpg"
//   → "proof-of-ownership/file.jpg"
export const extractStoragePath = (value) => {
  if (!value) return null;
  // Already a bare path (no protocol)
  if (!value.startsWith('http')) return value;
  // Pull everything after the bucket name in the URL
  const marker = '/move-in-docs/';
  const idx = value.indexOf(marker);
  if (idx !== -1) return value.slice(idx + marker.length);
  return null;
};

// ── DocLink — views a signed URL for a private bucket file, in-app ───────────
// The bucket "move-in-docs" is PRIVATE, so public URLs return 404.
// createSignedUrl generates a short-lived (60 min) authenticated link, which
// is then shown in an in-app lightbox (never a new tab) — images are
// click-to-zoom, PDFs render inline via an iframe.
export const DocLink = ({ value, label }) => {
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState(false);
  const [signedUrl,  setSignedUrl]  = useState(null);
  const [zoomed,     setZoomed]     = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    setErr(false);
    try {
      const path = extractStoragePath(value);
      if (!path) throw new Error('Cannot resolve path');
      const { data, error } = await supabase.storage
        .from('move-in-docs')
        .createSignedUrl(path, 3600); // 1-hour signed URL
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      setSignedUrl(data.signedUrl);
      setZoomed(false);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const close = () => { setSignedUrl(null); setZoomed(false); };

  if (err) return <span className="text-sm text-red-500 italic">Failed to open — check storage permissions</span>;

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm font-bold text-[#006837] hover:underline cursor-pointer disabled:opacity-60">
        {loading
          ? <><span className="w-3 h-3 border-2 border-[#006837]/30 border-t-[#006837] rounded-full animate-spin" /> Opening…</>
          : <><Eye size={13} /> View Document</>}
      </button>

      {signedUrl && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4" onClick={close}>
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
          <div className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col transition-all duration-200
              ${zoomed ? 'max-w-5xl max-h-[94vh]' : 'max-w-lg max-h-[85vh]'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <FileText size={14} className="text-[#006837]" /> {label || 'Document'}
              </p>
              <div className="flex items-center gap-1.5">
                {!/\.pdf($|\?)/i.test(signedUrl) && (
                  <button onClick={() => setZoomed(z => !z)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 cursor-pointer transition-all"
                    title={zoomed ? 'Zoom out' : 'Zoom in'}>
                    {zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                  </button>
                )}
                <button onClick={close}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 cursor-pointer transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-4 flex items-center justify-center bg-slate-50 flex-1">
              {/\.pdf($|\?)/i.test(signedUrl)
                ? <iframe src={signedUrl} title={label || 'Document'} className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white" />
                : <img src={signedUrl} alt={label || 'Document'} onClick={() => setZoomed(z => !z)}
                    className={`rounded-lg object-contain transition-all duration-200 cursor-zoom-in
                      ${zoomed ? 'max-w-none max-h-none w-auto cursor-zoom-out' : 'max-w-full max-h-[65vh]'}`} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
