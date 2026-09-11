import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import {
  TrendingUp, TrendingDown, FileText, Printer,
  Search, RefreshCw,
  Plus, X, ChevronDown, Shield, CreditCard,
  Building2, Receipt, BarChart3, AlertTriangle, Zap,
  Package,
} from 'lucide-react';
import { fmtCurrency, fmtDate, usePagination, Toast, KpiCard } from './auditorHelpers';
import { printFinancialReport } from './printFinancialReport';
import { printDamageLog } from './printDamageLog';
import DamageReportModal from './DamageReportModal';
import DamageReportDetailModal from './DamageReportDetailModal';
import DelinquentReviewModal from './DelinquentReviewModal';
import AddExpenseModal from './AddExpenseModal';
import DuesTab from './DuesTab';
import CourtIncomeTab from './CourtIncomeTab';
import ExpensesTab from './ExpensesTab';
import UnpaidDuesTab from './UnpaidDuesTab';
import FacilitiesTab from './FacilitiesTab';

// ─── Main Component ───────────────────────────────────────────────────────────
const AuditorDashboard = () => {
  const [activeTab,    setActiveTab]    = useState('dues');
  const [loading,      setLoading]      = useState(true);
  const [showExpModal,     setShowExpModal]     = useState(false);
  const [showExpFilter,    setShowExpFilter]    = useState(false);
  const [showTabFilter,    setShowTabFilter]    = useState(false);
  const [tabPeriod,        setTabPeriod]        = useState('all');
  const [tabFrom,          setTabFrom]          = useState('');
  const [tabTo,            setTabTo]            = useState('');
  const [expPeriod,        setExpPeriod]        = useState('all');
  const [expFrom,          setExpFrom]          = useState('');
  const [expTo,            setExpTo]            = useState('');
  const [search,       setSearch]       = useState('');
  const [toast,        setToast]        = useState({ show: false, message: '', type: 'success' });

  // ── Report filter (print report only) ────────────────────────────────────
  const [reportFrom,    setReportFrom]    = useState('');
  const [reportTo,      setReportTo]      = useState('');
  const [reportPeriod,  setReportPeriod]  = useState('all'); // all|last7d|this_month|last_month|this_year|last_year|custom
  const [showReportFilter,  setShowReportFilter]  = useState(false);


  // ── Facilities & Amenities state ────────────────────────────────────────────
  const [amenityRes,     setAmenityRes]     = useState([]);
  const [facilSubTab,    setFacilSubTab]    = useState('current');
  const [showDmgModal,   setShowDmgModal]   = useState(false);
  const [dmgTarget,      setDmgTarget]      = useState(null);
  const [damageReports,  setDamageReports]  = useState([]);
  const [viewingDamage,  setViewingDamage]  = useState(null);
  const [damageStatusFilter, setDamageStatusFilter] = useState('All');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [duesIncome,   setDuesIncome]   = useState({ records: [], total: 0 });
  const [courtIncome,  setCourtIncome]  = useState({ records: [], total: 0 });
  const [expenses,     setExpenses]     = useState({ records: [], total: 0 });
  const [unpaid,       setUnpaid]       = useState({ records: [], total: 0 });
  const [monthlyDue,   setMonthlyDue]   = useState(150); // used to detect advance payments (amount > 1x due)

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 0. Current monthly due amount (for advance payment detection)
      try {
        const { data: settings } = await supabase.from('hoa_settings').select('monthly_due_amount').eq('id', 1).single();
        if (settings?.monthly_due_amount != null) setMonthlyDue(Number(settings.monthly_due_amount));
      } catch (_e) { /* keep default */ }

      // 1. Monthly dues (paid)
      const { data: paidDues } = await supabase
        .from('payments')
        .select('*, profiles(full_name, account_status)')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false });

      const duesTotal = (paidDues || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      setDuesIncome({ records: paidDues || [], total: duesTotal });

      // 2. Court rental income (completed court reservations)
      const { data: courtFacilities } = await supabase
        .from('facilities')
        .select('id, name')
        .ilike('name', '%court%');

      const courtIds = (courtFacilities || []).map(f => f.id);

      let courtRes = [];
      if (courtIds.length > 0) {
        const { data } = await supabase
          .from('reservations')
          .select('*, profiles!user_id(full_name), facilities(name, rate)')
          .in('facility_id', courtIds)
          .eq('status', 'Completed')
          .order('date', { ascending: false });
        courtRes = data || [];
      }

      // Parse rate string (e.g. "₱500" → 500)
      courtRes = courtRes.map(r => ({
        ...r,
        amount: parseFloat((r.facilities?.rate || '0').toString().replace(/[^0-9.]/g, '')) || 0,
      }));
      const courtTotal = courtRes.reduce((s, r) => s + r.amount, 0);
      setCourtIncome({ records: courtRes, total: courtTotal });

      // 3. HOA Expenses
      const { data: exp } = await supabase
        .from('hoa_expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      const expTotal = (exp || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      setExpenses({ records: exp || [], total: expTotal });

      // 4. Unpaid / Overdue dues
      const { data: upd } = await supabase
        .from('payments')
        .select('*, profiles(full_name, account_status)')
        .in('status', ['unpaid', 'overdue', 'pending'])
        .order('due_date', { ascending: true });

      const updTotal = (upd || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      setUnpaid({ records: upd || [], total: updTotal });


      // 5. Amenity item reservations (chairs, tents, etc.)
      const { data: amenity } = await supabase
        .from('reservations')
        .select('*, facilities(name, category, amount), profiles!user_id(full_name, email)')
        .order('created_at', { ascending: false });
      setAmenityRes((amenity || []).filter(r => r.facilities?.category === 'Amenity Item'));

      // 6. Damage reports filed from the Return History tab (see DamageReportModal).
      // These land in the shared 'reports' table under category 'maintenance'
      // alongside resident-submitted issues, so they're distinguished by the
      // "Condition:" marker DamageReportModal always writes into the description.
      const { data: damage } = await supabase
        .from('reports')
        .select('*')
        .eq('category', 'maintenance')
        .ilike('description', '%Condition:%')
        .order('created_at', { ascending: false });
      setDamageReports(damage || []);

    } catch (e) {
      showToast('Failed to load financial data: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Verify all payments for a resident ──────────────────────────────────
  const [verifyingId,   setVerifyingId]   = useState(null);
  const [reviewTarget,  setReviewTarget]  = useState(null); // { userId, fullName } | null
  const handleVerifyResident = async (userId, fullName) => {
    setVerifyingId(userId);
    try {
      const ids = duesIncome.records
        .filter(p => p.user_id === userId && !p.audited)
        .map(p => p.id);
      if (!ids.length) {
        // Nothing left to verify at the payment level, but the resident is
        // still flagged delinquent — open the review modal instead of
        // leaving this click as a silent dead end.
        setReviewTarget({ userId, fullName });
        return;
      }
      const { error } = await supabase
        .from('payments')
        .update({ audited: true })
        .in('id', ids);
      if (error) throw error;
      await logAudit('VERIFY_PAYMENTS', `Auditor verified ${ids.length} payment(s) for ${fullName}.`);
      showToast(`${ids.length} payment(s) verified for ${fullName}.`);
      fetchAll();
    } catch (e) {
      showToast('Failed to verify: ' + e.message, 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  // ── Log a delinquent-account review — see DelinquentReviewModal ─────────
  const handleReviewDelinquentAccount = async (userId, fullName, note) => {
    try {
      await logAudit('REVIEW_DELINQUENT_ACCOUNT', `Auditor reviewed delinquent account for ${fullName} (ID: ${userId})${note ? `: ${note}` : ''}.`);
      showToast(`Review logged for ${fullName}.`);
      return true;
    } catch (e) {
      showToast('Failed to log review: ' + e.message, 'error');
      return false;
    }
  };

  // ── Resolve a damage report — e.g. once the resident has paid for or ────
  // replaced the item. There's no separate "resolution notes" column, so the
  // note is appended to the report's own description with a timestamp, same
  // approach DamageReportModal uses to build the description in the first place.
  const handleUpdateDamageReport = async (reportId, newStatus, note) => {
    try {
      const target = damageReports.find(r => r.id === reportId);
      const resolvedNote = note
        ? `\n\n[${newStatus} — ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}]: ${note}`
        : '';
      const updatedDescription = (target?.description || '') + resolvedNote;

      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus, description: updatedDescription })
        .eq('id', reportId);
      if (error) throw error;

      await logAudit('UPDATE_DAMAGE_REPORT', `Set status to "${newStatus}" for damage report ID: ${reportId}${note ? ` — ${note}` : ''}`);
      setDamageReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus, description: updatedDescription } : r));
      showToast('Damage report updated.');
      return true;
    } catch (e) {
      showToast('Failed to update: ' + e.message, 'error');
      return false;
    }
  };

  const handlePrintDamageLog = () => {
    printDamageLog(damageReports);
  };

  const getTabPeriodRange = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    switch (tabPeriod) {
      case 'last7d':     { const f = new Date(now); f.setDate(f.getDate()-7); return { from: ymd(f), to: ymd(now) }; }
      case 'this_month': return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to: ymd(now) };
      case 'last_month': { const f = new Date(now.getFullYear(), now.getMonth()-1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0); return { from: ymd(f), to: ymd(t) }; }
      case 'this_year':  return { from: `${now.getFullYear()}-01-01`, to: ymd(now) };
      case 'last_year':  { const ly = now.getFullYear()-1; return { from: `${ly}-01-01`, to: `${ly}-12-31` }; }
      case 'custom':     return { from: tabFrom, to: tabTo };
      default:           return { from: '', to: '' };
    }
  };


  const getTabPeriodLabel = () => {
    const now = new Date();
    switch (tabPeriod) {
      case 'last7d':     return 'Last 7 Days';
      case 'this_month': return now.toLocaleString('default', { month: 'long', year: 'numeric' });
      case 'last_month': { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toLocaleString('default', { month: 'long', year: 'numeric' }); }
      case 'this_year':  return `Year ${now.getFullYear()}`;
      case 'last_year':  return `Year ${now.getFullYear()-1}`;
      case 'custom':     return tabFrom && tabTo ? `${tabFrom} – ${tabTo}` : null;
      default:           return null;
    }
  };


  const getFiltered = () => {
    const term = search.toLowerCase();
    const filter = (records, fields) =>
      !term ? records : records.filter(r => fields.some(f => {
        const val = f.split('.').reduce((o, k) => o?.[k], r);
        return (val || '').toString().toLowerCase().includes(term);
      }));

    // Apply tab date filter for dues/court/unpaid
    const { from: tFrom, to: tTo } = getTabPeriodRange();
    const dateFilter = (records, dateKey) =>
      records.filter(r => {
        const d = (r[dateKey] || '').split('T')[0];
        if (tFrom && d && d < tFrom) return false;
        if (tTo   && d && d > tTo)   return false;
        return true;
      });

    switch (activeTab) {
      case 'dues':    return dateFilter(filter(duesIncome.records,  ['profiles.full_name', 'reference_no']), 'paid_at');
      case 'court':   return dateFilter(filter(courtIncome.records, ['profiles.full_name', 'facilities.name']), 'date');
      case 'expenses':return filter(expenses.records,    ['description', 'category']); // expenses uses filteredExpensesForTab
      case 'unpaid':  return dateFilter(filter(unpaid.records,      ['profiles.full_name', 'reference_no']), 'due_date');
      default:        return [];
    }
  };
  const filteredRecords = getFiltered();

  // Expenses tab date + text filter
  const getExpPeriodLabel = () => {
    const now = new Date();
    switch (expPeriod) {
      case 'last7d':     return 'Last 7 Days';
      case 'this_month': return now.toLocaleString('default', { month: 'long', year: 'numeric' });
      case 'last_month': { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toLocaleString('default', { month: 'long', year: 'numeric' }); }
      case 'this_year':  return `Year ${now.getFullYear()}`;
      case 'last_year':  return `Year ${now.getFullYear()-1}`;
      case 'custom':     return expFrom && expTo ? `${expFrom} – ${expTo}` : null;
      default:           return null;
    }
  };


  const getExpPeriodRange = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    switch (expPeriod) {
      case 'last7d':     { const f = new Date(now); f.setDate(f.getDate()-7); return { from: ymd(f), to: ymd(now) }; }
      case 'this_month': return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to: ymd(now) };
      case 'last_month': { const f = new Date(now.getFullYear(), now.getMonth()-1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0); return { from: ymd(f), to: ymd(t) }; }
      case 'this_year':  return { from: `${now.getFullYear()}-01-01`, to: ymd(now) };
      case 'last_year':  { const ly = now.getFullYear()-1; return { from: `${ly}-01-01`, to: `${ly}-12-31` }; }
      case 'custom':     return { from: expFrom, to: expTo };
      default:           return { from: '', to: '' };
    }
  };


  const filteredExpensesForTab = React.useMemo(() => {
    const { from, to } = getExpPeriodRange();
    const term = search.toLowerCase();
    return (expenses.records || []).filter(e => {
      const d = e.expense_date || '';
      if (from && d && d < from) return false;
      if (to   && d && d > to)   return false;
      if (term) {
        const hit = ['description','category'].some(f => (e[f]||'').toLowerCase().includes(term));
        if (!hit) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses.records, expPeriod, expFrom, expTo, search]);

  // ── Print report filter (independent of on-screen tab filters) ───────────
  const getPeriodRange = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    switch (reportPeriod) {
      case 'last7d': {
        const from = new Date(now); from.setDate(from.getDate() - 7);
        return { from: ymd(from), to: ymd(now) };
      }
      case 'this_month':
        return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to: ymd(now) };
      case 'last_month': {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last  = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: ymd(first), to: ymd(last) };
      }
      case 'this_year':
        return { from: `${now.getFullYear()}-01-01`, to: ymd(now) };
      case 'last_year': {
        const ly = now.getFullYear() - 1;
        return { from: `${ly}-01-01`, to: `${ly}-12-31` };
      }
      case 'custom':
        return { from: reportFrom, to: reportTo };
      default:
        return { from: '', to: '' };
    }
  };

  const getPeriodLabel = () => {
    const now = new Date();
    switch (reportPeriod) {
      case 'last7d':     return 'Last 7 Days';
      case 'this_month': return now.toLocaleString('default', { month: 'long', year: 'numeric' });
      case 'last_month': { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toLocaleString('default', { month: 'long', year: 'numeric' }); }
      case 'this_year':  return `Year ${now.getFullYear()}`;
      case 'last_year':  return `Year ${now.getFullYear() - 1}`;
      case 'custom':     return reportFrom && reportTo ? `${fmtDate(reportFrom)} – ${fmtDate(reportTo)}` : reportFrom ? `From ${fmtDate(reportFrom)}` : reportTo ? `Up to ${fmtDate(reportTo)}` : null;
      default:           return null;
    }
  };

  // ── Print report date filter ───
  const filterForReport = (records, dateKey) => {
    const { from, to } = getPeriodRange();
    return (records || []).filter(r => {
      if (from && r[dateKey] && r[dateKey] < from) return false;
      if (to   && r[dateKey] && r[dateKey] > to)   return false;
      return true;
    });
  };

  const handlePrintReport = () => {
    const filteredDues    = filterForReport(duesIncome.records,  'paid_at');
    const filteredCourt   = filterForReport(courtIncome.records, 'date');
    const filteredExpense = filterForReport(expenses.records,    'expense_date');

    printFinancialReport({
      duesIncome:  { records: filteredDues,    total: filteredDues.reduce((s, p) => s + Number(p.amount || 0), 0) },
      courtIncome: { records: filteredCourt,   total: filteredCourt.reduce((s, r) => s + Number(r.amount || 0), 0) },
      expenses:    { records: filteredExpense, total: filteredExpense.reduce((s, e) => s + Number(e.amount || 0), 0) },
      period: getPeriodLabel(),
    });
  };


  // Advance payment detection (amount is a multiple of monthlyDue)
  const monthsCoveredBy = (amount) => Math.max(1, Math.round(Number(amount || 0) / (monthlyDue || 1)));

  // ── Consolidated dues: one row per resident ──────────────────────────────
  const consolidatedDues = React.useMemo(() => {
    const map = {};
    const term = search.toLowerCase();
    (duesIncome.records || []).forEach(p => {
      const name = p.profiles?.full_name || '—';
      if (term && !name.toLowerCase().includes(term) && !(p.reference_no || '').toLowerCase().includes(term)) return;
      if (!map[p.user_id]) {
        map[p.user_id] = {
          user_id:      p.user_id,
          full_name:    name,
          total:        0,
          count:        0,
          last_paid:    p.paid_at,
          audited:      true,
          isDelinquent: p.profiles?.account_status === 'delinquent',
          hasAdvance:   false,
          advanceAmount: 0,
        };
      }
      map[p.user_id].total  += Number(p.amount || 0);
      map[p.user_id].count  += monthsCoveredBy(p.amount);
      if (!map[p.user_id].last_paid || (p.paid_at && p.paid_at > map[p.user_id].last_paid))
        map[p.user_id].last_paid = p.paid_at;
      if (!p.audited) map[p.user_id].audited = false;
      if (monthsCoveredBy(p.amount) > 1) {
        map[p.user_id].hasAdvance = true;
        map[p.user_id].advanceAmount += Number(p.amount || 0);
      }
    });
    return Object.values(map).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [duesIncome.records, search, monthlyDue]);

  // ── Auto-verify clean (non-delinquent) residents' paid dues ──────────────
  const [autoVerifying, setAutoVerifying] = useState(false);
  useEffect(() => {
    if (!duesIncome.records?.length || autoVerifying) return;

    const idsToAutoVerify = duesIncome.records
      .filter(p => !p.audited && p.profiles?.account_status !== 'delinquent')
      .map(p => p.id);

    if (!idsToAutoVerify.length) return;

    (async () => {
      setAutoVerifying(true);
      try {
        const { error } = await supabase
          .from('payments')
          .update({ audited: true })
          .in('id', idsToAutoVerify);
        if (error) throw error;

        const namesAffected = [...new Set(
          duesIncome.records.filter(p => idsToAutoVerify.includes(p.id)).map(p => p.profiles?.full_name)
        )];
        await logAudit('AUTO_VERIFY_PAYMENTS',
          `System auto-verified ${idsToAutoVerify.length} payment(s) for ${namesAffected.length} resident(s) with no red flags: ${namesAffected.join(', ')}.`);
        fetchAll();
      } catch (e) {
        // Silent fail — manual Verify still works
      } finally {
        setAutoVerifying(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duesIncome.records]);

  // ── Consolidated unpaid: one row per resident, total balance ────────────
  const consolidatedUnpaid = React.useMemo(() => {
    const map = {};
    const term = search.toLowerCase();
    (unpaid.records || []).forEach(p => {
      const name = p.profiles?.full_name || '—';
      if (term && !name.toLowerCase().includes(term)) return;
      if (!map[p.user_id]) {
        map[p.user_id] = {
          user_id:   p.user_id,
          full_name: name,
          balance:   0,
          months:    0,
          oldest:    p.due_date,
          newest:    p.due_date,
          hasOverdue: false,
          isDelinquent: p.profiles?.account_status === 'delinquent',
        };
      }
      map[p.user_id].balance += Number(p.amount || 0);
      map[p.user_id].months  += 1;
      if (p.due_date < map[p.user_id].oldest) map[p.user_id].oldest = p.due_date;
      if (p.due_date > map[p.user_id].newest) map[p.user_id].newest = p.due_date;
      if (p.status === 'overdue') map[p.user_id].hasOverdue = true;
    });
    return Object.values(map).sort((a, b) => (b.isDelinquent - a.isDelinquent) || (b.balance - a.balance));
  }, [unpaid.records, search]);

  // ── Pagination for each tab ──────────────────────────────────────────────
  const duesPag     = usePagination(consolidatedDues,    6);
  const courtPag    = usePagination(activeTab === 'court'    ? filteredRecords : [], 6);
  const expensesPag = usePagination(activeTab === 'expenses' ? filteredExpensesForTab : [], 6);
  const unpaidPag   = usePagination(consolidatedUnpaid,  6);

  // ── Net balance ──────────────────────────────────────────────────────────
  const totalIncome  = duesIncome.total + courtIncome.total;
  const netBalance       = totalIncome - expenses.total;

  // ── Advance payments (multi-month dues) ──────────────────────────────────
  const advanceResidentCount = consolidatedDues.filter(r => r.hasAdvance).length;
  const advanceTotal = consolidatedDues.reduce((s, r) => s + r.advanceAmount, 0);
  const MONTHLY_EXPENSE  = 37600;  // ₱22k security + ₱14k electricity + ₱1.2k sweepers + ₱0.4k water
  const MONTHLY_INCOME   = 280 * 150; // 280 residents × ₱150


    // ── Facilities computed values ───────────────────────────────────────────────
  const facilCurrent = React.useMemo(() =>
    amenityRes.filter(r => r.status === 'Approved'),
  [amenityRes]);
  const facilHistory = React.useMemo(() =>
    amenityRes.filter(r => r.status === 'Completed'),
  [amenityRes]);
  const facilSearch  = activeTab === 'facilities' ? search : '';
  const filtFacilCurrent = React.useMemo(() => {
    const t = facilSearch.toLowerCase();
    return !t ? facilCurrent : facilCurrent.filter(r =>
      (r.profiles?.full_name||'').toLowerCase().includes(t) ||
      (r.facilities?.name||'').toLowerCase().includes(t));
  }, [facilCurrent, facilSearch]);
  const filtFacilHistory = React.useMemo(() => {
    const t = facilSearch.toLowerCase();
    return !t ? facilHistory : facilHistory.filter(r =>
      (r.profiles?.full_name||'').toLowerCase().includes(t) ||
      (r.facilities?.name||'').toLowerCase().includes(t));
  }, [facilHistory, facilSearch]);
  const facilCurPag  = usePagination(filtFacilCurrent,  6);
  const facilHistPag = usePagination(filtFacilHistory,  6);

  const filtDamageReports = React.useMemo(() => {
    const t = facilSearch.toLowerCase();
    return damageReports.filter(r => {
      const matchSearch = !t || (r.description || '').toLowerCase().includes(t);
      const matchStatus = damageStatusFilter === 'All' || (r.status || 'Pending') === damageStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [damageReports, facilSearch, damageStatusFilter]);
  const damagesPag = usePagination(filtDamageReports, 6);

  const tabs = [
    { key: 'dues',     label: 'Dues Collected',  icon: CreditCard,   count: duesIncome.records.length,  color: 'text-[#006837]'   },
    { key: 'court',    label: 'Court Income',     icon: Building2,    count: courtIncome.records.length, color: 'text-teal-600'    },
    { key: 'expenses', label: 'HOA Expenses',     icon: Receipt,      count: expenses.records.length,    color: 'text-red-500'     },
    { key: 'unpaid',   label: 'Unpaid Dues',      icon: AlertTriangle,count: consolidatedUnpaid.length,   color: 'text-amber-600'   },
    { key: 'facilities', label: 'Chairs & Tents', icon: Package, count: amenityRes.length, color: 'text-emerald-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 space-y-6">
      <Toast toast={toast} />




      {showExpModal && <AddExpenseModal onClose={() => setShowExpModal(false)} onSave={() => { fetchAll(); setExpPeriod('this_month'); }} onError={(msg) => showToast(msg, 'error')} />}
      {showDmgModal && dmgTarget && <DamageReportModal target={dmgTarget} onClose={() => { setShowDmgModal(false); setDmgTarget(null); }} onSave={fetchAll} onError={(msg) => showToast(msg, 'error')} />}
      <DamageReportDetailModal report={viewingDamage} onClose={() => setViewingDamage(null)} onSave={handleUpdateDamageReport} />
      <DelinquentReviewModal target={reviewTarget} onClose={() => setReviewTarget(null)} onSubmit={handleReviewDelinquentAccount} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Shield size={22} className="text-[#006837]" /> Audit Reports
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Financial monitoring — dues, court income, expenses, uncollected accounts, and amenities</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative">
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="relative">
            <button
              onClick={() => setShowReportFilter(p => !p)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-sm cursor-pointer transition-all">
              <Printer size={14} /> Print Report
            </button>

            {showReportFilter && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-black text-slate-800">Select Report Period</p>
                  <button onClick={() => setShowReportFilter(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
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
                    <button key={p.key} onClick={() => { setReportPeriod(p.key); if (p.key !== 'custom') { setReportFrom(''); setReportTo(''); } }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border-2 cursor-pointer transition-all text-left
                        ${reportPeriod === p.key ? 'bg-[#006837] border-[#006837] text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-[#006837]/40 hover:text-[#006837]'}
                        ${p.key === 'custom' ? 'col-span-2' : ''}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {reportPeriod === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">From</label>
                      <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To</label>
                      <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowReportFilter(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={() => { handlePrintReport(); setShowReportFilter(false); }}
                    className="flex-1 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5">
                    <Printer size={12} /> Print
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Dues Collected"   value={fmtCurrency(duesIncome.total)}  icon={TrendingUp}   bg="bg-[#006837]/10" color="text-[#006837]"  sub={`${duesIncome.records.length} payments`}   />
        <KpiCard label="Paid in Advance"  value={fmtCurrency(advanceTotal)}      icon={Zap}          bg="bg-purple-50"    color="text-purple-600" sub={`${advanceResidentCount} resident${advanceResidentCount !== 1 ? 's' : ''}`} />
        <KpiCard label="Court Income"     value={fmtCurrency(courtIncome.total)} icon={Building2}    bg="bg-teal-50"      color="text-teal-600"   sub={`${courtIncome.records.length} reservations`} />
        <KpiCard label="Total Expenses"   value={fmtCurrency(expenses.total)}    icon={TrendingDown} bg="bg-red-50"       color="text-red-500"    sub={`${expenses.records.length} entries`}      />
        <KpiCard
          label={netBalance >= 0 ? 'Net Surplus' : 'Net Deficit'}
          value={fmtCurrency(Math.abs(netBalance))}
          icon={BarChart3}
          bg={netBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}
          color={netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}
          sub={`Total income: ${fmtCurrency(totalIncome)}`}
        />
      </div>

      {/* ── Action toolbar (replaces statcards) ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-slate-400 font-semibold">
          {activeTab === 'expenses' && expPeriod !== 'all' && (
            <span className="bg-[#006837]/10 text-[#006837] px-2.5 py-1 rounded-full font-bold">
              Filtered: {getExpPeriodLabel()}
            </span>
          )}
          {activeTab !== 'expenses' && activeTab !== 'facilities' && tabPeriod !== 'all' && (
            <span className="bg-[#006837]/10 text-[#006837] px-2.5 py-1 rounded-full font-bold">
              Filtered: {getTabPeriodLabel()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">

          {/* ── Filter button — Dues, Court, Unpaid tabs ── */}
          {['dues','court','unpaid'].includes(activeTab) && (
            <div className="relative">
              <button onClick={() => setShowTabFilter(p => !p)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold rounded-xl shadow-sm cursor-pointer whitespace-nowrap">
                <ChevronDown size={14} /> Filter{tabPeriod !== 'all' ? `: ${getTabPeriodLabel()}` : ''}
              </button>
              {showTabFilter && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-[200]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-black text-slate-800">Filter by Period</p>
                    <button onClick={() => setShowTabFilter(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
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
                        onClick={() => { setTabPeriod(p.key); if (p.key !== 'custom') { setTabFrom(''); setTabTo(''); } }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border-2 cursor-pointer transition-all text-left
                          ${tabPeriod === p.key ? 'bg-[#006837] border-[#006837] text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-[#006837]/40 hover:text-[#006837]'}
                          ${p.key === 'custom' ? 'col-span-2' : ''}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {tabPeriod === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">From</label>
                        <input type="date" value={tabFrom} onChange={e => setTabFrom(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To</label>
                        <input type="date" value={tabTo} onChange={e => setTabTo(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                      </div>
                    </div>
                  )}
                  <button onClick={() => setShowTabFilter(false)}
                    className="w-full py-2.5 bg-[#006837] hover:bg-[#004d29] text-white text-xs font-bold rounded-xl cursor-pointer">
                    Apply Filter
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Filter button — HOA Expenses tab ── */}
          {activeTab === 'expenses' && (
            <div className="relative">
              <button onClick={() => setShowExpFilter(p => !p)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold rounded-xl shadow-sm cursor-pointer whitespace-nowrap">
                <ChevronDown size={14} /> Filter{expPeriod !== 'all' ? `: ${getExpPeriodLabel()}` : ''}
              </button>
              {showExpFilter && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-[200]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-black text-slate-800">Filter Expenses</p>
                    <button onClick={() => setShowExpFilter(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
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
                        onClick={() => { setExpPeriod(p.key); if (p.key !== 'custom') { setExpFrom(''); setExpTo(''); } }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border-2 cursor-pointer transition-all text-left
                          ${expPeriod === p.key ? 'bg-[#006837] border-[#006837] text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-[#006837]/40 hover:text-[#006837]'}
                          ${p.key === 'custom' ? 'col-span-2' : ''}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {expPeriod === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">From</label>
                        <input type="date" value={expFrom} onChange={e => setExpFrom(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To</label>
                        <input type="date" value={expTo} onChange={e => setExpTo(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#006837]/20" />
                      </div>
                    </div>
                  )}
                  <button onClick={() => setShowExpFilter(false)}
                    className="w-full py-2.5 bg-[#006837] hover:bg-[#004d29] text-white text-xs font-bold rounded-xl cursor-pointer">
                    Apply Filter
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Record New Expenses ── */}
          {activeTab === 'expenses' && (
            <button onClick={() => setShowExpModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#006837] hover:bg-[#004d29] text-white text-sm font-bold rounded-xl shadow-sm cursor-pointer transition-all whitespace-nowrap">
              <Plus size={14} /> Record New Expenses
            </button>
          )}
        </div>
      </div>


      {/* ── Tab navigation + search ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
            {tabs.map(t => (
              <button key={t.key} onClick={() => { setActiveTab(t.key); setSearch(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap
                  ${activeTab === t.key ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <t.icon size={12} />
                {t.label}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-[#006837]/10 text-[#006837]' : 'bg-slate-200 text-slate-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search + action button */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative sm:w-56 w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
              <p className="text-sm text-slate-400 animate-pulse">Loading financial records…</p>
            </div>
          ) : (activeTab !== 'facilities' && filteredRecords.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText size={36} className="text-slate-200 mb-2" />
              <p className="text-sm font-bold text-slate-400">No records found</p>
            </div>
          ) : (
            <>
              {activeTab === 'dues' && (
                <DuesTab
                  pagination={duesPag}
                  residentCount={consolidatedDues.length}
                  duesTotal={duesIncome.total}
                  verifyingId={verifyingId}
                  onVerify={handleVerifyResident}
                />
              )}

              {activeTab === 'court' && (
                <CourtIncomeTab pagination={courtPag} courtTotal={courtIncome.total} />
              )}

              {activeTab === 'expenses' && (
                <ExpensesTab
                  pagination={expensesPag}
                  expensesTotal={filteredExpensesForTab.reduce((s, e) => s + Number(e.amount || 0), 0)}
                />
              )}

              {activeTab === 'unpaid' && (
                <UnpaidDuesTab
                  pagination={unpaidPag}
                  residentCount={consolidatedUnpaid.length}
                  unpaidTotal={unpaid.total}
                />
              )}

              {activeTab === 'facilities' && (
                <FacilitiesTab
                  subTab={facilSubTab}
                  setSubTab={setFacilSubTab}
                  currentCount={facilCurrent.length}
                  historyCount={facilHistory.length}
                  damagesCount={damageReports.length}
                  currentPagination={facilCurPag}
                  historyPagination={facilHistPag}
                  damagesPagination={damagesPag}
                  onReportDamage={(r) => { setDmgTarget(r); setShowDmgModal(true); }}
                  onViewDamage={setViewingDamage}
                  onPrintDamageLog={handlePrintDamageLog}
                  damageStatusFilter={damageStatusFilter}
                  setDamageStatusFilter={setDamageStatusFilter}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditorDashboard;
