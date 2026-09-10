import React, { useState, useEffect } from 'react';
import {
  Search, FileText, AlertCircle, CheckCircle2,
  Eye, Trash2, X, Calendar,
  ChevronDown, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import { RequireRole, StatusPill } from './reportsHelpers';
import ReportDetailModal from './ReportDetailModal';

// ─── Pagination hook ─────────────────────────────────────────────────────────
const usePagination = (items, rowsPerPage = 10) => {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
  // Reset to page 1 whenever the list changes (filter/search)
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


// RequireRole, STATUS_CONFIG, StatusPill moved to ./reportsHelpers — shared
// with the extracted ReportDetailModal so both agree on role gating and
// status colors.

const KpiCard = ({ label, value, icon: Icon, iconBg, iconColor }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-xl ${iconBg}`}><Icon size={20} className={iconColor} /></div>
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value}</p>
    </div>
  </div>
);

// ─── Row actions — View and Delete exposed directly, no dropdown ─────────────
const RowActions = ({ currentUserRole, onView, onDelete }) => (
  <div className="flex items-center gap-2 justify-end">
    <button
      onClick={onView}
      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
      title="View & Respond"
    >
      <Eye size={15} />
    </button>
    <RequireRole userRole={currentUserRole} allowedRoles={['president', 'secretary', 'board_member']}>
      <button
        onClick={onDelete}
        className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors cursor-pointer"
        title="Delete Report"
      >
        <Trash2 size={15} />
      </button>
    </RequireRole>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Reports = () => {
  const [activeFilter,           setActiveFilter]           = useState('All');
  const [searchQuery,            setSearchTerm]             = useState('');
  const [selectedResidentFilter, setSelectedResidentFilter] = useState('All');
  const [selectedReport,         setSelectedReport]         = useState(null);
  const [reports,                setReports]                = useState([]);
  const [loading,                setLoading]                = useState(true);
  const [toast,                  setToast]                  = useState({ show: false, message: '', type: 'success' });
  const [deleteConfirmation,     setDeleteConfirmation]     = useState({ show: false, id: null });

  const [showDateFilter,  setShowDateFilter]  = useState(false);
  const [datePeriod,      setDatePeriod]      = useState('all');
  const [dateFrom,        setDateFrom]        = useState('');
  const [dateTo,          setDateTo]          = useState('');

  const filters = ['All', 'Pending', 'In Progress', 'Resolved', 'On Hold', 'Denied'];
  const currentUserRole = localStorage.getItem('userRole') || 'resident';

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // fetchPreviousFeedback, previousFeedback, selectedStatus, isImageExpanded,
  // feedbackText moved into ReportDetailModal — it owns that state now.

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select(`id, user_id, category, description, photo_url, video_url, created_at, status, profiles(full_name)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setReports(data.map(item => ({
          id:             item.id,
          user_id:        item.user_id,
          resident:       item.profiles?.full_name || 'Unknown Resident',
          category:       item.category,
          description:    item.description,
          status:         item.status || 'Pending',
          created_at_iso: item.created_at,
          date:           new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          rptNo:          `RPT-${item.id.toString().slice(0,4).toUpperCase()}`,
          imageUrl:       item.photo_url || null,
          videoUrl:       item.video_url || null,
        })));
      }
    } catch (e) { console.error('Error fetching reports:', e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchReports();
    const channel = supabase
      .channel('reports-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchReports)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const today         = new Date().toISOString().split('T')[0];
  const currentMonth  = new Date().getMonth();
  const currentYear   = new Date().getFullYear();
  const dailyReceived   = reports.filter(r => r.created_at_iso?.startsWith(today)).length;
  const monthlyReceived = reports.filter(r => {
    const d = new Date(r.created_at_iso);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;
  const resolvedCount = reports.filter(r => r.status === 'Resolved').length;
  const residentOptions = [...new Set(reports.map(r => r.resident))].sort();

  // Passed to ReportDetailModal as onSend — it owns the status/feedback draft
  // state, this just persists the change and reports back whether it worked.
  const handleSendFeedback = async (report, newStatus, message) => {
    if (!message.trim()) { showToast('Please write a message', 'error'); return false; }
    try {
      const { error: statusError } = await supabase
        .from('reports').update({ status: newStatus }).eq('id', report.id);
      if (statusError) throw statusError;

      const { error: notifError } = await supabase.from('notifications').insert([{
        user_id:   report.user_id,
        report_id: report.id,
        title:     `Status Update: ${report.category}`,
        message,
        is_read:   false,
      }]);
      if (notifError) throw notifError;

      await logAudit('UPDATE_REPORT_STATUS', `Set status to "${newStatus}" for report ID: ${report.id}`);
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: newStatus } : r));
      setSelectedReport(prev => prev && prev.id === report.id ? { ...prev, status: newStatus } : prev);
      showToast('Feedback sent and status updated!');
      return true;
    } catch (e) { showToast(e.message, 'error'); return false; }
  };

  const handleDeleteReport = async () => {
    const id = deleteConfirmation.id;
    try {
      await supabase.from('notifications').delete().eq('report_id', id);
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
      await logAudit('DELETE_REPORT', `Deleted report ID: ${id}`);
      setDeleteConfirmation({ show: false, id: null });
      showToast('Report deleted successfully');
      fetchReports();
    } catch (e) { showToast('Error deleting report: ' + e.message, 'error'); }
  };

  // ── Date period filter helpers ────────────────────────────────────────────────
  const getDatePeriodRange = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    switch (datePeriod) {
      case 'last7d':     { const f = new Date(now); f.setDate(f.getDate()-7); return { from: ymd(f), to: ymd(now) }; }
      case 'this_month': return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to: ymd(now) };
      case 'last_month': { const f = new Date(now.getFullYear(), now.getMonth()-1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0); return { from: ymd(f), to: ymd(t) }; }
      case 'this_year':  return { from: `${now.getFullYear()}-01-01`, to: ymd(now) };
      case 'last_year':  { const ly = now.getFullYear()-1; return { from: `${ly}-01-01`, to: `${ly}-12-31` }; }
      case 'custom':     return { from: dateFrom, to: dateTo };
      default:           return { from: '', to: '' };
    }
  };

  const getDatePeriodLabel = () => {
    const now = new Date();
    switch (datePeriod) {
      case 'last7d':     return 'Last 7 Days';
      case 'this_month': return now.toLocaleString('default', { month: 'long', year: 'numeric' });
      case 'last_month': { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toLocaleString('default', { month: 'long', year: 'numeric' }); }
      case 'this_year':  return `Year ${now.getFullYear()}`;
      case 'last_year':  return `Year ${now.getFullYear()-1}`;
      case 'custom':     return dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : null;
      default:           return null;
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesFilter   = activeFilter === 'All' || report.status.toLowerCase() === activeFilter.toLowerCase();
    const matchesResident = selectedResidentFilter === 'All' || report.resident === selectedResidentFilter;
    const matchesSearch   = report.resident.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            report.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            report.description.toLowerCase().includes(searchQuery.toLowerCase());
    const { from, to } = getDatePeriodRange();
    const d = (report.created_at_iso || '').split('T')[0];
    const matchesDate = (!from || d >= from) && (!to || d <= to);
    return matchesFilter && matchesSearch && matchesResident && matchesDate;
  });
  const { paginated: paginatedReports, page: repPage, setPage: setRepPage, totalPages: repTotalPages, total: filteredReportsTotal } = usePagination(filteredReports, 5);

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">

      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[400] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border
          animate-in fade-in slide-in-from-top-4 duration-300
          ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white p-7 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 size={22} />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">Delete Report?</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmation({ show: false, id: null })}
                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDeleteReport}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-lg shadow-red-100 cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FileText size={22} className="text-[#006837]" /> Resident Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Review and respond to resident-submitted issues</p>
        </div>
        <button onClick={fetchReports}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer transition-all shrink-0">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Received Today"      value={dailyReceived}   icon={FileText}     iconBg="bg-blue-50"    iconColor="text-blue-600"    />
        <KpiCard label="Received This Month" value={monthlyReceived} icon={Calendar}     iconBg="bg-purple-50"  iconColor="text-purple-600"  />
        <KpiCard label="Total Resolved"      value={resolvedCount}   icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="relative w-full lg:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all"
              placeholder="Search reports…"
              value={searchQuery}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center lg:ml-auto">
            <select
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer"
              value={selectedResidentFilter}
              onChange={e => setSelectedResidentFilter(e.target.value)}
            >
              <option value="All">All Residents</option>
              {residentOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 flex-wrap">
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                    ${activeFilter === f ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  {f}
                </button>
              ))}
            </div>

            {/* ── Period Filter button ── */}
            <div className="relative">
              <button onClick={() => setShowDateFilter(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap
                  ${datePeriod !== 'all' ? 'bg-[#006837] border-[#006837] text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                <ChevronDown size={12} />
                {datePeriod !== 'all' ? getDatePeriodLabel() : 'Filter Date'}
              </button>

              {showDateFilter && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-[200]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-black text-slate-800">Filter by Period</p>
                    <button onClick={() => setShowDateFilter(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                      <X size={14} className="text-slate-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {[
                      { key: 'all',        label: 'All Records'  },
                      { key: 'last7d',     label: 'Last 7 Days'  },
                      { key: 'this_month', label: 'This Month'   },
                      { key: 'last_month', label: 'Last Month'   },
                      { key: 'this_year',  label: 'This Year'    },
                      { key: 'last_year',  label: 'Last Year'    },
                      { key: 'custom',     label: 'Custom Range' },
                    ].map(p => (
                      <button key={p.key}
                        onClick={() => { setDatePeriod(p.key); if (p.key !== 'custom') { setDateFrom(''); setDateTo(''); } }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border-2 cursor-pointer transition-all text-left
                          ${datePeriod === p.key ? 'bg-[#006837] border-[#006837] text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-[#006837]/40 hover:text-[#006837]'}
                          ${p.key === 'custom' ? 'col-span-2' : ''}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {datePeriod === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                      </div>
                    </div>
                  )}
                  <button onClick={() => setShowDateFilter(false)}
                    className="w-full py-2.5 bg-[#006837] hover:bg-[#004d29] text-white text-xs font-bold rounded-xl cursor-pointer">
                    Apply Filter
                  </button>
                  {datePeriod !== 'all' && (
                    <button onClick={() => { setDatePeriod('all'); setDateFrom(''); setDateTo(''); setShowDateFilter(false); }}
                      className="w-full py-2 mt-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer">
                      Clear Filter
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table — note: NO overflow-hidden here so dropdowns escape freely */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium animate-pulse">Loading reports…</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-slate-300">
              <FileText size={40} className="mb-3" />
              <p className="text-sm font-semibold text-slate-500">No reports found for "{activeFilter}"</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Resident','Category','Description','Status','Date',''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedReports.map(report => (
                  <tr key={report.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#006837]/10 flex items-center justify-center text-[#006837] font-bold text-xs uppercase shrink-0">
                          {report.resident.charAt(0)}
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[140px]">{report.resident}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg capitalize">
                        {report.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-600 truncate max-w-[200px]">{report.description}</p>
                    </td>
                    <td className="px-5 py-4"><StatusPill status={report.status} /></td>
                    <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{report.date}</td>
                    <td className="px-5 py-4 text-right">
                      <RowActions
                        currentUserRole={currentUserRole}
                        onView={() => setSelectedReport(report)}
                        onDelete={() => setDeleteConfirmation({ show: true, id: report.id })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filteredReports.length > 0 && (
          <>
            <PaginationBar page={repPage} totalPages={repTotalPages} setPage={setRepPage} total={filteredReports.length} rowsPerPage={5} />
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
                {activeFilter !== 'All' ? ` • Filtered by "${activeFilter}"` : ''}
              </p>
            </div>
          </>
        )}
      </div>

      <ReportDetailModal
        report={selectedReport}
        currentUserRole={currentUserRole}
        onClose={() => setSelectedReport(null)}
        onSend={handleSendFeedback}
      />
    </div>
  );
};

export default Reports;
