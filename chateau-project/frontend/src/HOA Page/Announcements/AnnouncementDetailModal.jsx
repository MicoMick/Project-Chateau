import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Paperclip, Calendar, Tag, User, Pin, AlertTriangle, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { getCategoryColor } from './announcementsHelpers';

// ── AttachmentViewer — opens the attachment in-app instead of a new tab ─────
// Images get a click-to-zoom lightbox, PDFs render inline via an iframe,
// anything else falls back to an "Open file" link (still same-tab navigation
// isn't possible for arbitrary file types without a new tab, so those alone
// keep target="_blank").
const AttachmentViewer = ({ url, onClose }) => {
  const [zoomed, setZoomed] = useState(false);
  const isPdf   = /\.pdf($|\?)/i.test(url);
  const isImage = /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(url);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
      <div className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col transition-all duration-200
          ${zoomed ? 'max-w-5xl max-h-[94vh]' : 'max-w-2xl max-h-[85vh]'}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Paperclip size={14} className="text-[#006837]" /> Attachment
          </p>
          <div className="flex items-center gap-1.5">
            {isImage && (
              <button onClick={() => setZoomed(z => !z)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 cursor-pointer transition-all"
                title={zoomed ? 'Zoom out' : 'Zoom in'}>
                {zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 cursor-pointer transition-all">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4 flex items-center justify-center bg-slate-50 flex-1">
          {isPdf ? (
            <iframe src={url} title="Attachment" className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white" />
          ) : isImage ? (
            <img src={url} alt="Attachment" onClick={() => setZoomed(z => !z)}
              className={`rounded-lg object-contain transition-all duration-200 cursor-zoom-in
                ${zoomed ? 'max-w-none max-h-none w-auto cursor-zoom-out' : 'max-w-full max-h-[65vh]'}`} />
          ) : (
            <div className="text-center py-10">
              <p className="text-sm font-semibold text-slate-600 mb-3">Preview isn't available for this file type.</p>
              <a href={url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#006837] hover:underline">
                <Paperclip size={14} /> Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Formatted content renderer ──────────────────────────────────────────────
// Only used inside this modal — the row list shows a raw line-clamped preview
// instead, so it doesn't need this formatting.
const FormattedContent = ({ text }) => {
  if (!text) return null;

  // Respect existing line breaks; otherwise split into sentences
  let raw = text.trim();
  const hasLineBreaks = raw.includes('\n');

  let blocks;
  if (hasLineBreaks) {
    blocks = raw.split(/\n+/).map(b => b.trim()).filter(Boolean);
  } else {
    // Sentence-boundary split
    blocks = raw
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .reduce((acc, sentence, i) => {
        // ~2 sentences per paragraph
        if (i % 2 === 0) acc.push(sentence);
        else acc[acc.length - 1] += ' ' + sentence;
        return acc;
      }, []);
  }

  const bulletRe = /^[-*•]\s+/;
  const numberRe = /^\d+[.)]\s+/;

  // Group consecutive bullet/number lines into a single <ul>/<ol>
  const elements = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (bulletRe.test(block)) {
      const items = [];
      while (i < blocks.length && bulletRe.test(blocks[i])) {
        items.push(blocks[i].replace(bulletRe, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1.5 mb-4">
          {items.map((it, idx) => <li key={idx} className="text-sm text-slate-800 leading-relaxed">{it}</li>)}
        </ul>
      );
    } else if (numberRe.test(block)) {
      const items = [];
      while (i < blocks.length && numberRe.test(blocks[i])) {
        items.push(blocks[i].replace(numberRe, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1.5 mb-4">
          {items.map((it, idx) => <li key={idx} className="text-sm text-slate-800 leading-relaxed">{it}</li>)}
        </ol>
      );
    } else {
      elements.push(
        <p key={`p-${i}`} className="text-sm text-slate-800 leading-relaxed mb-3 last:mb-0">{block}</p>
      );
      i++;
    }
  }

  return <div>{elements}</div>;
};

/**
 * AnnouncementDetailModal — the full "View Details" breakdown for one
 * announcement, opened from the eye icon on an Announcements.jsx row. The row
 * itself only shows a single-line-clamped preview, so the full formatted
 * content — plus every meta field (category, status, posting window, author,
 * attachment) — lives here where there's room to actually read it.
 *
 * Landscape layout on purpose: meta info on the left, the full announcement
 * content on the right — the same side-by-side spread used by the other
 * "View Details" modals in this app, for the same reason (faster to scan
 * than one long stacked column).
 *
 * Rendered through a portal straight to <body> — guarantees the backdrop is
 * always truly viewport-relative regardless of what's above it in the tree.
 *
 * Props:
 *  - announcement: the announcements row, or null to hide the modal
 *  - onClose: () => void
 */
const AnnouncementDetailModal = ({ announcement, onClose }) => {
  const [showAttachment, setShowAttachment] = useState(false);

  if (!announcement) return null;

  return (
    <>
    {createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900 truncate">{announcement.title}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getCategoryColor(announcement.category)}`}>
                {announcement.category}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                ${announcement.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {announcement.status}
              </span>
              {announcement.is_emergency && (
                <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full bg-red-600 text-white uppercase tracking-wide">
                  <AlertTriangle size={11} /> Urgent
                </span>
              )}
              {announcement.is_pinned && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                  <Pin size={11} /> Pinned
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Landscape body — meta left, full content right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-y-auto">

          {/* Left — meta info */}
          <div className="p-7 space-y-4">
            <div className="flex items-start gap-2.5">
              <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Posted</p>
                <p className="text-sm font-semibold text-slate-900">
                  {new Date(announcement.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            {(announcement.start_date || announcement.end_date) && (
              <div className="flex items-start gap-2.5">
                <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Period</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {announcement.start_date || '—'} to {announcement.end_date || '—'}
                  </p>
                </div>
              </div>
            )}

            {announcement.author_name && (
              <div className="flex items-start gap-2.5">
                <User size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Posted By</p>
                  <p className="text-sm font-semibold text-slate-900">{announcement.author_name}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2.5">
              <Tag size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</p>
                <p className="text-sm font-semibold text-slate-900">{announcement.category}</p>
              </div>
            </div>

            {announcement.attachment_url && (
              <button onClick={() => setShowAttachment(true)}
                className="flex items-center gap-2 text-sm font-bold text-[#006837] hover:underline pt-2 cursor-pointer">
                <Paperclip size={14} /> View Attachment
              </button>
            )}
          </div>

          {/* Right — full content */}
          <div className="p-7 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={13} /> Full Announcement
            </p>
            <div className="bg-white rounded-2xl p-5 border border-slate-100">
              <FormattedContent text={announcement.content} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-bold cursor-pointer transition-all">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
    )}
    {showAttachment && (
      <AttachmentViewer url={announcement.attachment_url} onClose={() => setShowAttachment(false)} />
    )}
    </>
  );
};

export default AnnouncementDetailModal;
