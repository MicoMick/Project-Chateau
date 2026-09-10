import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone, FileEdit, Plus, Search, MoreVertical, Pin,
  AlertTriangle, X, Paperclip, Calendar, Trash2, CheckCircle2,
  Loader2, Eye, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import { getCategoryColor } from './announcementsHelpers';
import AnnouncementDetailModal from './AnnouncementDetailModal';

// FormattedContent moved to ./AnnouncementDetailModal — it's only used there,
// the row list below shows a raw line-clamped preview instead.

// ─── Pagination hook ─────────────────────────────────────────────────────────
const usePagination = (items, rowsPerPage = 10) => {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
  // Reset on filter change
  React.useEffect(() => { setPage(1); }, [items.length]);
  const paginated = items.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  return { paginated, page, setPage, totalPages, total: items.length };
};

// ─── Pagination bar ───────────────────────────────────────────────────────────
const PaginationBar = ({ page, totalPages, setPage, total, rowsPerPage }) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * rowsPerPage + 1;
  const to   = Math.min(page * rowsPerPage, total);
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }
  return (
    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-slate-500 font-medium">
        Showing <span className="font-bold text-slate-700">{from}–{to}</span> of <span className="font-bold text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm font-bold transition-all">‹</button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={i} className="w-8 h-8 flex items-center justify-center text-slate-300 text-sm">…</span>
            : <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer
                  ${page === p ? 'bg-[#006837] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
        )}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm font-bold transition-all">›</button>
      </div>
    </div>
  );
};


const RequireRole = ({ userRole, allowedRoles, children }) => {
  if (allowedRoles.includes(userRole) || userRole === 'super_admin') return children;
  return null;
};

// getCategoryColor moved to ./announcementsHelpers — shared with the
// extracted AnnouncementDetailModal.

const Toast = ({ toast }) => {
  if (!toast.show) return null;
  return (
    <div className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border
      animate-in fade-in slide-in-from-top-4 duration-300
      ${toast.type === 'success'
        ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
        : 'bg-red-50 border-red-100 text-red-800'}`}>
      {toast.type === 'success'
        ? <CheckCircle2 size={16} className="text-emerald-500" />
        : <AlertTriangle  size={16} className="text-red-500"   />}
      <p className="text-sm font-bold">{toast.message}</p>
    </div>
  );
};

const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all";
const labelCls = "block text-xs font-bold text-slate-600 mb-1.5";

// ─── Fixed-position dropdown (avoids overflow:hidden clipping) ──────────────
const PortalMenu = ({ anchorRef, open, onClose, children }) => {
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top:   rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
  }, [open, anchorRef]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[500]" onClick={onClose} />
      <div
        style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 501 }}
        className="w-44 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden"
      >
        {children}
      </div>
    </>
  );
};

// ─── Row menu button with portal dropdown ─────────────────────────────────────
const RowMenu = ({ ann, currentUserRole, onEdit, onPin, onDelete }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
      >
        <MoreVertical size={14} />
      </button>

      <PortalMenu anchorRef={btnRef} open={open} onClose={() => setOpen(false)}>
        <div className="p-1.5 space-y-0.5">
          <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','board_member']}>
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer"
            >
              <FileEdit size={13} /> Edit
            </button>
            <button
              onClick={() => { onPin(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer"
            >
              <Pin size={13} /> {ann.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            <div className="border-t border-slate-50 my-1" />
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-xl cursor-pointer"
            >
              <Trash2 size={13} /> Delete
            </button>
          </RequireRole>
        </div>
      </PortalMenu>
    </>
  );
};

// ─── ModalForm (kept outside parent — avoids remount on keystroke) ──────────
const ModalForm = ({
  isEdit, onClose, onSaveDraft, onPublish,
  newTitle, setNewTitle, newContent, setNewContent,
  newCategory, setNewCategory, isEmergency, setIsEmergency,
  startDate, setStartDate, endDate, setEndDate,
  attachmentUrl, isUploading, handleFileUpload,
}) => createPortal(
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-black text-slate-900">
          {isEdit ? 'Edit Announcement' : 'New Announcement'}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer">
          <X size={18} />
        </button>
      </div>
      <div className="p-6 overflow-y-auto flex-1 space-y-5">
        <div>
          <label className={labelCls}>Title <span className="text-red-400">*</span></label>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Announcement title…" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category</label>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
              className={inputCls + ' cursor-pointer'}>
              {['General','Financial','Event','Maintenance','Election','Security'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Attachment</label>
            <div>
              <input type="file" id="fileUpload" className="hidden" onChange={handleFileUpload} />
              <label htmlFor="fileUpload"
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium cursor-pointer hover:bg-slate-100 transition-all">
                {isUploading
                  ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                  : <><Paperclip size={14} /> {attachmentUrl ? 'File attached ✓' : 'Attach file'}</>}
              </label>
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Content <span className="text-red-400">*</span></label>
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
            rows={7} placeholder="Write your announcement… Press Enter for a new paragraph, or start a line with - for a bullet point."
            className={inputCls + ' resize-none'} />
          <p className="text-[10px] text-slate-400 mt-1.5">Tip: press Enter between paragraphs, and start a line with "-" to create a bullet list.</p>
        </div>
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-2xl">
          <div>
            <p className="text-sm font-bold text-red-800">Emergency / High Priority</p>
            <p className="text-xs text-red-500 mt-0.5">Highlights this announcement in red for all residents</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isEmergency}
              onChange={e => setIsEmergency(e.target.checked)} />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className={inputCls + ' cursor-pointer'} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className={inputCls + ' cursor-pointer'} />
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
        <button disabled={isUploading} onClick={onSaveDraft}
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-bold cursor-pointer disabled:opacity-50">
          Save as Draft
        </button>
        <button disabled={isUploading} onClick={onPublish}
          className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl text-sm font-bold shadow-lg shadow-[#006837]/20 cursor-pointer disabled:opacity-50">
          {isEdit ? 'Update & Publish' : 'Publish Now'}
        </button>
      </div>
    </div>
  </div>,
  document.body
);

// ─── Main component ───────────────────────────────────────────────────────────

const Announcements = () => {
  const [activeCategory,    setActiveCategory]    = useState('All Categories');
  const [activeStatus,      setActiveStatus]      = useState('All Status');
  const [searchTerm,        setSearchTerm]        = useState('');
  const [showModal,         setShowModal]         = useState(false);
  const [selectedAnn,       setSelectedAnn]       = useState(null);
  const [showDetails,       setShowDetails]       = useState(false);
  const [showEditOverlay,   setShowEditOverlay]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [toast,             setToast]             = useState({ show: false, message: '', type: 'success' });
  const [announcements,     setAnnouncements]     = useState([]);
  const [loading,           setLoading]           = useState(true);

  const [newTitle,      setNewTitle]      = useState('');
  const [newCategory,   setNewCategory]   = useState('General');
  const [newContent,    setNewContent]    = useState('');
  const [isEmergency,   setIsEmergency]   = useState(false);
  const [startDate,     setStartDate]     = useState(new Date().toISOString().split('T')[0]);
  const [endDate,       setEndDate]       = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isUploading,   setIsUploading]   = useState(false);

  const currentUserRole = localStorage.getItem('userRole') || 'resident';

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const ext  = file.name.split('.').pop();
      const path = `attachments/${Math.random()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('announcements').upload(path, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('announcements').getPublicUrl(path);
      setAttachmentUrl(data.publicUrl);
      await logAudit('FILE_UPLOAD', `Uploaded attachment: ${path}`);
      showToast('File uploaded successfully');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setIsUploading(false); }
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  // ── Auto-post Monthly Dues announcement (1st of each month) ──────────────
  useEffect(() => {
    const runMonthlyAnnouncement = async () => {
      const today = new Date();
      if (today.getDate() !== 1) return; // Only on the 1st

      const month     = today.getMonth();
      const year      = today.getFullYear();
      const todayStr  = today.toISOString().split('T')[0];

      const MONTH_NAMES = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December',
      ];

      const annTitle = `Monthly HOA Dues — ${MONTH_NAMES[month]} ${year}`;

      // Already posted today?
      const { data: existing } = await supabase
        .from('announcements')
        .select('id')
        .eq('title', annTitle)
        .gte('created_at', todayStr + 'T00:00:00')
        .limit(1);

      if (existing?.length) return;

      const lastDay   = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const content   = `This is your monthly reminder that HOA dues of ₱150 are now due for ${MONTH_NAMES[month]} ${year}. ` +
                        `Please settle your payment on or before ${lastDay}. ` +
                        `For payments and inquiries, please contact the HOA Treasurer or any board member. Thank you for your continued support of our community.`;

      const { error } = await supabase.from('announcements').insert([{
        title:       annTitle,
        content,
        category:    'Financial',
        status:      'published',
        is_emergency: false,
        is_pinned:    false,
        start_date:   todayStr,
        end_date:     lastDay,
        author_name:  'System',
      }]);

      if (error) {
        console.error('[AutoAnnouncement] Failed:', error.message);
        return;
      }

      // Push notification to residents
      await supabase.from('notifications').insert([{
        title:   annTitle,
        message: `Monthly HOA dues of ₱150 are due for ${MONTH_NAMES[month]} ${year}. Due date: ${lastDay}.`,
        is_read: false,
        created_at: new Date().toISOString(),
      }]);

      await supabase.from('system_logs').insert([{
        activity:   'AUTO_MONTHLY_ANNOUNCEMENT',
        details:    `System auto-posted Monthly Dues announcement for ${MONTH_NAMES[month]} ${year}.`,
        severity:   'info',
        created_at: new Date().toISOString(),
      }]);

      // Refresh list
      fetchAnnouncements();
    };

    runMonthlyAnnouncement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const resetForm = () => {
    setNewTitle(''); setNewContent(''); setNewCategory('General');
    setIsEmergency(false);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(''); setAttachmentUrl(''); setSelectedAnn(null);
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      await logAudit('DELETE_ANNOUNCEMENT', `Deleted announcement ID: ${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      setShowDeleteConfirm(false); setPendingDeleteItem(null);
      showToast('Announcement deleted');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleOpenEdit = (ann) => {
    setSelectedAnn(ann); setNewTitle(ann.title); setNewCategory(ann.category);
    setNewContent(ann.content); setIsEmergency(ann.is_emergency);
    setStartDate(ann.start_date); setEndDate(ann.end_date);
    setAttachmentUrl(ann.attachment_url || '');
    setShowEditOverlay(true);
  };

  const handleAddAnnouncement = async (status) => {
    if (!newTitle || !newContent) { showToast('Title and Content required', 'error'); return; }
    try {
      const { error } = await supabase.from('announcements').insert([{
        title: newTitle, content: newContent, category: newCategory,
        is_emergency: isEmergency, status, start_date: startDate, end_date: endDate,
        author_name: 'Admin User', attachment_url: attachmentUrl,
      }]);
      if (error) throw error;
      await logAudit('CREATE_ANNOUNCEMENT', `Created: "${newTitle}" → ${status}`);
      if (status === 'published') {
        await supabase.from('notifications').insert([{
          title:   isEmergency ? `🚨 EMERGENCY: ${newTitle}` : `Announcement: ${newTitle}`,
          message: newContent.substring(0, 100) + '…',
          is_read: false, created_at: new Date().toISOString(),
        }]);
      }
      fetchAnnouncements(); setShowModal(false); resetForm();
      showToast(`Announcement ${status} successfully`);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateAnnouncement = async (status) => {
    if (!selectedAnn?.id || !newTitle || !newContent) {
      showToast('Title and Content required', 'error'); return;
    }
    try {
      const { error } = await supabase.from('announcements').update({
        title: newTitle, content: newContent, category: newCategory,
        is_emergency: isEmergency, status, start_date: startDate, end_date: endDate,
        attachment_url: attachmentUrl,
      }).eq('id', selectedAnn.id);
      if (error) throw error;
      await logAudit('UPDATE_ANNOUNCEMENT', `Updated: "${newTitle}" → ${status}`);
      if (status === 'published') {
        await supabase.from('notifications').insert([{
          title:   isEmergency ? `🚨 EMERGENCY: ${newTitle}` : `New Announcement: ${newTitle}`,
          message: newContent.substring(0, 100) + '…',
          is_read: false, created_at: new Date().toISOString(),
        }]);
      }
      fetchAnnouncements(); setShowEditOverlay(false); resetForm();
      showToast(`Announcement ${status}`);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleTogglePin = async (id) => {
    try {
      const target = announcements.find(a => a.id === id);
      const pinned = !target.is_pinned;
      const { error } = await supabase.from('announcements').update({ is_pinned: pinned }).eq('id', id);
      if (error) throw error;
      await logAudit('TOGGLE_PIN', `${pinned ? 'Pinned' : 'Unpinned'}: "${target.title}"`);
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_pinned: pinned } : a));
      showToast('Pin status updated');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const categories = ['All Categories','General','Financial','Event','Maintenance','Election','Security'];
  const published  = announcements.filter(a => a.status === 'published').length;
  const drafts     = announcements.filter(a => a.status === 'draft').length;

  const filtered = announcements
    .filter(a => {
      const matchSearch   = a.title.toLowerCase().includes(searchTerm.toLowerCase())
                         || a.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = activeCategory === 'All Categories' || a.category === activeCategory;
      const matchStatus   = activeStatus === 'All Status'
        || (activeStatus === 'Published' && a.status === 'published')
        || (activeStatus === 'Drafts'    && a.status === 'draft');
      return matchSearch && matchCategory && matchStatus;
    })
    .sort((a, b) => (a.is_pinned === b.is_pinned ? 0 : a.is_pinned ? -1 : 1));
  const { paginated: paginatedAnn, page: annPage, setPage: setAnnPage, totalPages: annTotalPages, total: filteredTotal } = usePagination(filtered, 5);

  const formProps = {
    newTitle, setNewTitle, newContent, setNewContent,
    newCategory, setNewCategory, isEmergency, setIsEmergency,
    startDate, setStartDate, endDate, setEndDate,
    attachmentUrl, isUploading, handleFileUpload,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">
      <Toast toast={toast} />

      {showModal && (
        <ModalForm isEdit={false}
          onClose={() => { setShowModal(false); resetForm(); }}
          onSaveDraft={() => handleAddAnnouncement('draft')}
          onPublish={()   => handleAddAnnouncement('published')}
          {...formProps} />
      )}

      {showEditOverlay && (
        <ModalForm isEdit={true}
          onClose={() => { setShowEditOverlay(false); resetForm(); }}
          onSaveDraft={() => handleUpdateAnnouncement('draft')}
          onPublish={()   => handleUpdateAnnouncement('published')}
          {...formProps} />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && pendingDeleteItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">Delete Announcement?</h3>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setPendingDeleteItem(null); }}
                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleDelete(pendingDeleteItem.id)}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-100 cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      <AnnouncementDetailModal
        announcement={showDetails ? selectedAnn : null}
        onClose={() => { setShowDetails(false); setSelectedAnn(null); }}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Megaphone size={22} className="text-[#006837]" /> Announcements
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and publish community announcements</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={fetchAnnouncements}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <RequireRole userRole={currentUserRole} allowedRoles={['president','vice_president','secretary','board_member']}>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#006837]/20 transition-all cursor-pointer">
              <Plus size={16} /> New Announcement
            </button>
          </RequireRole>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Published', value: published,            icon: Megaphone, bg: 'bg-[#006837]/10', color: 'text-[#006837]' },
          { label: 'Drafts',    value: drafts,               icon: FileEdit,  bg: 'bg-slate-100',    color: 'text-slate-600' },
          { label: 'Total',     value: announcements.length, icon: Calendar,  bg: 'bg-blue-50',      color: 'text-blue-600'  },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
                <p className="text-3xl font-black text-slate-900">{k.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${k.bg}`}><k.icon size={18} className={k.color} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── List ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search announcements…"
              className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
          </div>
          <div className="flex gap-2 flex-wrap lg:ml-auto">
            <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
              {['All Status','Published','Drafts'].map(s => (
                <button key={s} onClick={() => setActiveStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                    ${activeStatus === s ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
              <p className="text-sm text-slate-500 animate-pulse">Loading announcements…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <Megaphone size={36} className="mb-2" />
              <p className="text-sm font-semibold text-slate-500">No announcements found</p>
            </div>
          ) : paginatedAnn.map(ann => (
            <div key={ann.id}
              className={`px-5 py-4 flex items-start gap-4 transition-colors relative
                ${ann.is_emergency
                  ? 'bg-red-50/50 hover:bg-red-50/80 border-l-4 border-red-500'
                  : 'hover:bg-slate-50/60'}`}>
              <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${ann.is_emergency ? 'bg-red-100' : 'bg-[#006837]/10'}`}>
                <Megaphone size={16} className={ann.is_emergency ? 'text-red-600' : 'text-[#006837]'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-bold truncate ${ann.is_emergency ? 'text-red-700' : 'text-slate-900'}`}>
                        {ann.is_pinned && <Pin size={12} className="inline text-amber-500 mr-1" />}
                        {ann.title}
                      </p>
                      {ann.is_emergency && (
                        <span className="text-xs font-black px-2 py-0.5 bg-red-600 text-white rounded-full uppercase shrink-0 tracking-wide">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5 line-clamp-1">{ann.content}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getCategoryColor(ann.category)}`}>
                        {ann.category}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                        ${ann.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {ann.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setSelectedAnn(ann); setShowDetails(true); }}
                      className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="View details">
                      <Eye size={14} />
                    </button>
                    <RowMenu
                      ann={ann}
                      currentUserRole={currentUserRole}
                      onEdit={() => handleOpenEdit(ann)}
                      onPin={() => handleTogglePin(ann.id)}
                      onDelete={() => { setPendingDeleteItem(ann); setShowDeleteConfirm(true); }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && filtered.length > 0 && (
          <>
            <PaginationBar page={annPage} totalPages={annTotalPages} setPage={setAnnPage} total={filtered.length} rowsPerPage={5} />
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {filtered.length} announcement{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Announcements;
