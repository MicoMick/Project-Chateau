import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Plus, CreditCard, AlertCircle, CheckCircle2, DollarSign,
  Edit2, Trash2, X, Filter, Loader2, Download,
  Calendar, Users, ChevronDown, LayoutList, TableProperties, Printer, Mail,
  Eye, FileText, XCircle, QrCode, Upload, RefreshCw, ZoomIn, ZoomOut, History,
} from 'lucide-react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import ChateauLogo from '../../assets/ChataueLogo.png';
import ResidentFilterSelect from '../Resident Management/ResidentFilterSelect';

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
      <p className="text-xs text-slate-400 font-medium">
        Showing <span className="font-bold text-slate-600">{from}–{to}</span> of <span className="font-bold text-slate-600">{total}</span>
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


// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHLY_DUE_DEFAULT = 150; // fallback used only until /hoa_settings has loaded

// ─── Standard monthly bill breakdown ──────────────────────────────────────────
// The monthly due is not one flat charge — it's the sum of these operating
// costs, split per resident (~280 residents in Chateau).
// Electricity has no fixed cost (it's an actual utility bill that varies),
// so its per-resident share is computed at generation time from the total.
const BILL_LINE_ITEMS_BASE = [
  { label: 'Security Guard Salary', category: 'Salaries',    fixedTotal: 22000, type: 'Fixed'    },
  { label: 'Electricity Bill',      category: 'Utilities',   fixedTotal: 14000, type: 'Variable' }, // actual bill — varies monthly
  { label: 'Street Sweeper Salary', category: 'Maintenance', fixedTotal: 1200,  type: 'Fixed'    },
  { label: 'Water Bill',            category: 'Utilities',   fixedTotal: 400,   type: 'Variable' }, // actual bill — varies monthly
];
const ESTIMATED_RESIDENT_COUNT = 280;

// Builds the per-resident breakdown for one month's bill, given the current
// monthly due amount (configurable by Treasurer/President — see hoa_settings).
// Each resident's due is divided proportionally across the 4 categories,
// so the SOA can show exactly what portion of their due funds what.
const buildLineItemBreakdown = (monthlyDueAmount = MONTHLY_DUE_DEFAULT) => {
  const totalBase = BILL_LINE_ITEMS_BASE.reduce((s, i) => s + i.fixedTotal, 0); // ₱37,600
  const items = [];
  let sumSoFar = 0;
  BILL_LINE_ITEMS_BASE.forEach((item, idx) => {
    // Last item absorbs any rounding difference so items sum to EXACTLY the due amount
    const amount = idx === BILL_LINE_ITEMS_BASE.length - 1
      ? Math.round((monthlyDueAmount - sumSoFar) * 100) / 100
      : Math.round((item.fixedTotal / totalBase) * monthlyDueAmount * 100) / 100;
    sumSoFar = Math.round((sumSoFar + amount) * 100) / 100;
    items.push({ label: item.label, category: item.category, type: item.type, amount });
  });
  return items;
};


// ─── Helpers ──────────────────────────────────────────────────────────────────
const RequireRole = ({ userRole, allowedRoles, children }) => {
  if (allowedRoles.includes(userRole) || userRole === 'super_admin') return children;
  return null;
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const getMonthYear = (date) => {
  const d = new Date(date);
  return { month: d.getMonth(), year: d.getFullYear() };
};

// ─── Reference number generator ───────────────────────────────────────────────
// Generates a per-resident, per-month ref like SOA-202607-1F7A7D — same format
// as the Statement of Account's own reference number, so both match.
const generateRefNo = (month, year, userId) => {
  const mm = String(month + 1).padStart(2, '0');
  const uid = (userId || 'XXXXXX').slice(0, 6).toUpperCase();
  return `SOA-${year}${mm}-${uid}`;
};

// ─── Local date helper ────────────────────────────────────────────────────────
// Returns today's date as YYYY-MM-DD in the device's local timezone.
// Using toISOString() would return UTC, which is 8 hours behind PHT and shows
// the wrong date late at night (e.g. 06/07 instead of 06/08 at 1 AM PHT).
const localToday = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ─── Address label helper ──────────────────────────────────────────────────────
// Block/Lot values in the DB sometimes already include the word "Blk"/"Lot"
// (e.g. "Blk 55") and sometimes don't (e.g. "55"). This strips any existing
// label before re-prefixing, so we never get "Blk Blk 55".
const stripLabel = (val, label) => {
  if (!val) return '';
  const re = new RegExp(`^${label}\\.?\\s*`, 'i');
  return String(val).replace(re, '').trim();
};

// ── Duplicate-name detection ──────────────────────────────────────────────
// No signup flow in this app checks for an existing profile before creating
// a new one (registration happens outside this codebase, via Supabase Auth),
// so the same person can end up with two separate `profiles` rows — each then
// billed its own monthly dues. Flags matching names so Treasurer/President
// catch it here rather than paying/tracking two accounts for one resident.
const normalizeName = (name) => (name || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
const buildNameCounts = (list) => list.reduce((acc, r) => {
  const key = normalizeName(r.full_name);
  if (key) acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
const DuplicateBadge = () => (
  <span
    title="Another resident profile has this same name — likely a duplicate account for the same person."
    className="inline-flex items-center gap-1 shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
    <AlertCircle size={9} /> Possible Duplicate
  </span>
);

const buildFullAddress = (block, lot, street) => {
  const parts = [];
  const b = stripLabel(block, 'blk|block');
  const l = stripLabel(lot, 'lot');
  if (b) parts.push(`Blk ${b}`);
  if (l) parts.push(`Lot ${l}`);
  if (street) parts.push(street);
  return parts.join(', ') || 'N/A';
};

// ─── Statement of Account (SOA) printer ───────────────────────────────────────
// Generates a printable per-resident billing statement, similar in spirit to
// AuditorDashboard's printFinancialReport — opens a new window, builds HTML,
// then triggers the browser print dialog.
const printSOA = (resident, paidHistory = [], viewMode = 'both', monthlyDueAmount = MONTHLY_DUE_DEFAULT, qrCodeUrl = null) => {
  const fmtCurrency = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short',  day: 'numeric', year: 'numeric' }) : '—';
  const fmtDateL = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'long',   day: 'numeric', year: 'numeric' }) : '—';
  const fmtMonth = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'long',   year: 'numeric' }) : '—';
  const fmtMonthAbbr = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short' }) : '—';
  // A single payment can cover more than one month's due (paid in advance).
  // In that case, show the period as a range ending on the payment's due_date
  // rather than labeling it with just the due month.
  const fmtPaidPeriod = (p) => {
    const months = monthlyDueAmount > 0 ? Math.round(Number(p.amount || 0) / monthlyDueAmount) : 1;
    if (months > 1 && p.due_date) {
      const end = new Date(p.due_date);
      const start = new Date(end);
      start.setMonth(start.getMonth() - (months - 1));
      return start.getFullYear() === end.getFullYear()
        ? `${fmtMonthAbbr(start)} to ${fmtMonthAbbr(end)} ${end.getFullYear()}`
        : `${fmtMonthAbbr(start)} ${start.getFullYear()} to ${fmtMonthAbbr(end)} ${end.getFullYear()}`;
    }
    return fmtMonth(p.due_date);
  };

  const showOutstanding = viewMode === 'outstanding' || viewMode === 'both';
  const showHistory     = viewMode === 'history'     || viewMode === 'both';

  // Ascending copy (oldest → newest) — used for date-range math (earliest due
  // date, period span). Order-independent of how the table is displayed.
  const unpaidListAsc    = (resident.unpaidList || []).slice().sort((a, b) => new Date(a.due_date||0) - new Date(b.due_date||0));
  // Display copy (newest → oldest) — so when a new month's due is generated,
  // it appears above older unpaid dues in the printed/emailed table.
  const unpaidListDesc   = unpaidListAsc.slice().reverse();
  const totalDue         = unpaidListAsc.reduce((s, p) => s + Number(p.amount || 0), 0);
  const today            = localToday();
  const isSettled        = unpaidListAsc.length === 0;
  const monthsUnpaidCount = unpaidListAsc.length;
  const latestStatementDate = isSettled ? null
    : unpaidListAsc.reduce((l, p) => (p.statement_date && p.statement_date > l ? p.statement_date : l), unpaidListAsc[0]?.statement_date || today);
  const earliestDueDate  = isSettled ? null : unpaidListAsc[0]?.due_date;

  // Payment history — chronological order (January → July, etc.), oldest first.
  // Capped to the most recent 12 entries, but that cap is applied before the
  // chronological sort so we keep the newest 12 without disturbing their order.
  const paidHistoryChrono = paidHistory
    .slice()
    .sort((a, b) => new Date(b.due_date || b.paid_at || 0) - new Date(a.due_date || a.paid_at || 0))
    .slice(0, 12)
    .sort((a, b) => new Date(a.due_date || a.paid_at || 0) - new Date(b.due_date || b.paid_at || 0));

  // Reference number — YearMonth + first 6 chars of user id
  const soaRef = `SOA-${today.slice(0,7).replace('-','')}` +
    `-${(resident.id || resident.user_id || 'XXXXXX').slice(0,6).toUpperCase()}`;

  // Breakdown — use stored line_items or freshly computed
  const sampleLineItems = unpaidListAsc.find(p => Array.isArray(p.line_items) && p.line_items.length)?.line_items
    || buildLineItemBreakdown(monthlyDueAmount);

  const TH = `background:#006837;color:#fff;text-align:left;padding:7px 9px;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;`;
  const THR = TH + 'text-align:right;';

  const breakdownRows = isSettled ? '' : sampleLineItems.map((item, i) => {
    const bg   = i % 2 === 0 ? '#f8fafc' : '#fff';
    const type = item.type;
    const badge = type
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;border:1px solid;${
          type === 'Fixed'
            ? 'color:#166534;background:#f0fdf4;border-color:#bbf7d0;'
            : 'color:#64748b;background:#f8fafc;border-color:#e2e8f0;'
        }">${type}</span>`
      : '';
    return `<tr>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};">${item.label}${badge}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};font-size:10px;color:#64748b;">${item.category}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};text-align:right;">${fmtCurrency(item.amount)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;background:${bg};text-align:right;font-weight:bold;">${fmtCurrency(item.amount * monthsUnpaidCount)}</td>
    </tr>`;
  }).join('');

  const unpaidRows = unpaidListDesc.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#fef2f2' : '#fff'}">
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtMonth(p.due_date)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">Monthly HOA Dues</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtDate(p.statement_date)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtDate(p.due_date)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-size:10px;">${p.reference_no || '—'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-weight:bold;text-align:center;color:${p.status === 'overdue' ? '#dc2626' : '#d97706'};text-transform:capitalize;">${p.status || 'Unpaid'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;">${fmtCurrency(p.amount)}</td>
    </tr>`).join('');

  const paidRows = paidHistoryChrono.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#f0fdf4' : '#fff'}">
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtPaidPeriod(p)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;">${fmtDate(p.paid_at)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-size:10px;">${p.payer_reference_no || '—'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;font-size:10px;">${p.reference_no || '—'}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;color:#166534;">${fmtCurrency(p.amount)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <title>Statement of Account — ${resident.full_name}</title>
  <style>
    *{box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#f1f5f9;color:#1e293b;}
    .page{max-width:760px;margin:28px auto;background:#fff;border-radius:12px;overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,.10);}
    /* Letterhead */
    .lh{background:#006837;padding:0;}
    .lh-inner{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 26px;}
    .lh h1{margin:0;font-size:20px;font-weight:900;color:#fff;letter-spacing:-.3px;}
    .lh .org{font-size:11px;color:#a7f3d0;margin:3px 0 0;}
    .lh .doc-type{font-size:9px;font-weight:bold;color:#a7f3d0;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;}
    .lh .ref-no{font-size:12px;font-weight:900;color:#FFF200;letter-spacing:.04em;}
    .lh .issued{font-size:10px;color:#a7f3d0;margin-top:5px;}
    /* Status banner */
    .status-bar{padding:11px 26px;border-bottom:2px solid;display:flex;justify-content:space-between;align-items:center;}
    .status-bar.unpaid{background:#fef2f2;border-color:#fecaca;}
    .status-bar.settled{background:#f0fdf4;border-color:#bbf7d0;}
    .status-bar .slbl{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;}
    .status-bar.unpaid .slbl{color:#b91c1c;}
    .status-bar.settled .slbl{color:#166534;}
    .status-bar .sdl{font-size:11px;color:#991b1b;margin-top:2px;}
    .status-bar .total-amt{font-size:22px;font-weight:900;color:#dc2626;text-align:right;}
    .status-bar .total-lbl{font-size:9px;font-weight:bold;color:#b91c1c;text-transform:uppercase;letter-spacing:.05em;text-align:right;}
    /* Account block */
    .acct{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0;}
    .acct-cell{padding:16px 26px;}
    .acct-cell:first-child{border-right:1px solid #f1f5f9;}
    .acct-lbl{font-size:9px;font-weight:bold;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;}
    .acct-val{font-size:13px;font-weight:900;color:#0f172a;margin-top:4px;}
    .acct-sub{font-size:11px;color:#64748b;margin-top:2px;}
    /* Body */
    .body{padding:18px 26px;}
    h2{font-size:11.5px;color:#006837;margin:18px 0 7px;border-bottom:2px solid #006837;
      padding-bottom:4px;text-transform:uppercase;letter-spacing:.04em;}
    h2:first-child{margin-top:0;}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px;}
    th{${TH}}
    td{padding:7px 9px;border-bottom:1px solid #f1f5f9;}
    /* Breakdown note */
    .bkd-note{font-size:10px;color:#94a3b8;font-style:italic;margin:0 0 7px;}
    /* Payment instructions */
    .pay-box{background:#fffbeb;border:1.5px solid #f59e0b;border-radius:8px;padding:13px 16px;margin:14px 0;}
    .pay-box .plbl{font-size:10px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;}
    .pay-box p{margin:0;font-size:10.5px;color:#78350f;line-height:1.7;}
    /* Footer */
    .footer{background:#f8fafc;border-top:2px solid #e2e8f0;padding:13px 26px;}
    .footer p{margin:0;font-size:10px;color:#94a3b8;line-height:1.6;}
    @media print{
      body{background:#fff;}
      .page{margin:0;border-radius:0;box-shadow:none;max-width:100%;}
      @page{margin:8mm;size:A4;}
    }
  </style></head>
  <body>
  <div class="page">

    <!-- Letterhead -->
    <div class="lh">
      <div class="lh-inner">
        <div>
          <div class="doc-type">Official Document</div>
          <h1>Statement of Account</h1>
          <div class="org">Chateau Real Executive Village Homeowners Association Inc. (CREVHAI)</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;color:#a7f3d0;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;">Reference No.</div>
          <div class="ref-no">${soaRef}</div>
          <div class="issued">Issued: ${fmtDateL(today)}</div>
        </div>
      </div>
    </div>

    <!-- Status banner -->
    <div class="status-bar ${isSettled ? 'settled' : 'unpaid'}">
      <div>
        <div class="slbl">${isSettled ? '✓ Account Status: Fully Settled' : '⚠ Account Status: Payment Required'}</div>
        ${!isSettled ? `<div class="sdl">Payment due on or before <strong>${fmtDateL(earliestDueDate)}</strong></div>` : ''}
      </div>
      ${!isSettled ? `<div>
        <div class="total-lbl">Total Amount Due</div>
        <div class="total-amt">${fmtCurrency(totalDue)}</div>
      </div>` : ''}
    </div>

    <!-- Account info -->
    <div class="acct">
      <div class="acct-cell">
        <div class="acct-lbl">Account Holder</div>
        <div class="acct-val">${resident.full_name}</div>
        <div class="acct-sub">${resident.fullAddress || resident.street || 'N/A'}</div>
      </div>
      <div class="acct-cell">
        <div class="acct-lbl">Billing Summary</div>
        <div class="acct-val" style="${monthsUnpaidCount > 0 ? 'color:#dc2626;' : 'color:#166534;'}">
          ${monthsUnpaidCount > 0
            ? `${monthsUnpaidCount} month${monthsUnpaidCount !== 1 ? 's' : ''} unpaid`
            : 'No outstanding balance'}
        </div>
        <div class="acct-sub">Monthly due: <strong>${fmtCurrency(monthlyDueAmount)}</strong>
          ${monthsUnpaidCount > 1 ? ` · Period: ${fmtMonth(unpaidListAsc[0]?.due_date)} – ${fmtMonth(unpaidListAsc[unpaidListAsc.length-1]?.due_date)}` : ''}</div>
      </div>
    </div>

    <div class="body">

    ${showOutstanding ? (!isSettled ? `
    <!-- Breakdown -->
    <h2>Monthly Due Breakdown — What Your ${fmtCurrency(monthlyDueAmount)}/month Covers</h2>
    <p class="bkd-note">* Fixed costs are charged at the same rate every month. Variable costs are estimates based on actual utility bills.</p>
    <table>
      <thead><tr>
        <th>Item</th>
        <th>Category</th>
        <th style="text-align:right;">Per Month</th>
        <th style="text-align:right;">&times; ${monthsUnpaidCount} Month${monthsUnpaidCount !== 1 ? 's' : ''}</th>
      </tr></thead>
      <tbody>${breakdownRows}</tbody>
      <tfoot><tr>
        <td colspan="3" style="text-align:right;font-weight:bold;background:#f0fdf4;border-top:2px solid #006837;">Total:</td>
        <td style="text-align:right;font-weight:900;background:#f0fdf4;border-top:2px solid #006837;color:#006837;font-size:13px;">${fmtCurrency(totalDue)}</td>
      </tr></tfoot>
    </table>

    <!-- Outstanding charges — newest due shown first, so a freshly-generated
         month's due appears above older unpaid months -->
    <h2>Outstanding Charges</h2>
    <table>
      <thead><tr>
        <th>Period</th><th>Description</th><th>Statement Date</th><th>Due Date</th>
        <th>Reference #</th><th style="text-align:center;">Status</th><th style="text-align:right;">Amount</th>
      </tr></thead>
      <tbody>${unpaidRows}</tbody>
      <tfoot><tr>
        <td colspan="6" style="text-align:right;font-weight:bold;background:#fef2f2;border-top:2px solid #dc2626;">Total Amount Due:</td>
        <td style="text-align:right;font-weight:900;background:#fef2f2;border-top:2px solid #dc2626;color:#dc2626;font-size:13px;">${fmtCurrency(totalDue)}</td>
      </tr></tfoot>
    </table>

    <!-- Payment instructions -->
    <div class="pay-box">
      <div class="plbl">&#128179; Payment Instructions</div>
      <p>Please settle your outstanding balance on or before <strong>${fmtDateL(earliestDueDate)}</strong> to avoid late penalties.<br>
      Payments may be made at the <strong>HOA Office</strong> or through your designated <strong>HOA Treasurer</strong>.<br>
      Present this document as your billing reference — Ref. No. <strong>${soaRef}</strong>.</p>
      ${qrCodeUrl ? `
      <div style="margin-top:12px;text-align:center;">
        <img src="${qrCodeUrl}" alt="GCash QR Code" style="max-width:160px;border:1px solid #e2e8f0;border-radius:8px;" />
        <p style="margin:6px 0 0;font-size:10px;color:#92700e;font-weight:bold;">Scan this QR Code to pay directly</p>
      </div>
      ` : ''}
    </div>
    ` : `
    <!-- Settled -->
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:18px;text-align:center;margin-bottom:16px;">
      <div style="font-size:24px;margin-bottom:4px;">&#10003;</div>
      <div style="font-size:14px;font-weight:900;color:#166534;">Account Fully Settled</div>
      <div style="font-size:11px;color:#15803d;margin-top:4px;">No outstanding dues. Thank you for your prompt payments!</div>
    </div>
    `) : ''}

    ${showHistory ? (paidHistoryChrono.length ? `
    <!-- Payment history — chronological order, oldest month first -->
    <h2>Past Recent Payment History</h2>
    <table>
      <thead><tr>
        <th>Period</th><th>Date Paid</th><th>Your Ref #</th><th>HOA Ref #</th>
        <th style="text-align:right;">Amount</th>
      </tr></thead>
      <tbody>${paidRows}</tbody>
    </table>` : `
    <h2>Past Recent Payment History</h2>
    <p style="font-size:11px;color:#94a3b8;font-style:italic;">No payment history on record yet.</p>
    `) : ''}

    </div><!-- end .body -->

    <!-- Footer -->
    <div class="footer">
      <p>This is an official Statement of Account issued by the <strong>Chateau Real Executive Village
      Homeowners Association Inc. (CREVHAI)</strong> on ${fmtDateL(today)}. This document is system-generated
      and is valid without a manual signature. For disputes or inquiries, please contact the HOA Treasurer's
      office within 5 business days. Ref. No.: <strong>${soaRef}</strong>.</p>
    </div>

  </div><!-- end .page -->
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1050');
  if (!win) { alert('Please allow popups to print the Statement of Account.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
};


// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, iconColor, bgColor }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between flex-1 hover:shadow-md transition-shadow">
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{title}</p>
      <h3 className="text-3xl font-black text-slate-900 mt-0.5">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl ${bgColor}`}>
      <Icon size={24} className={iconColor} />
    </div>
  </div>
);

// ─── TransactionModal ─────────────────────────────────────────────────────────
const TransactionModal = ({ status, message, onClose }) => {
  if (!status) return null;
  const configs = {
    loading: { icon: <Loader2 className="w-12 h-12 text-[#006837] animate-spin" />, title: 'Processing…',   bg: 'bg-[#006837]/10' },
    success: { icon: <CheckCircle2 className="w-12 h-12 text-emerald-600" />,        title: 'Success!',      bg: 'bg-emerald-50'    },
    error:   { icon: <AlertCircle  className="w-12 h-12 text-red-600" />,            title: 'Action Failed', bg: 'bg-red-50'        },
  };
  const cur = configs[status];
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className={`w-20 h-20 ${cur.bg} rounded-full flex items-center justify-center mx-auto mb-5`}>{cur.icon}</div>
        <h3 className="text-xl font-black text-slate-900 mb-2">{cur.title}</h3>
        <p className="text-slate-500 text-sm mb-7">{message}</p>
        {status !== 'loading' && (
          <button onClick={onClose}
            className="w-full py-3.5 bg-[#006837] hover:bg-[#004d29] text-white font-bold rounded-2xl transition-all cursor-pointer">
            Continue
          </button>
        )}
      </div>
    </div>
  );
};

// ─── ModalOverlay ─────────────────────────────────────────────────────────────
const ModalOverlay = ({ title, subtitle, isOpen, onClose, children, actionLabel, onAction }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-7">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">{title}</h2>
              <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"><X size={18} /></button>
          </div>
          <div className="space-y-5">{children}</div>
          <div className="flex gap-3 mt-8">
            <button onClick={onClose}
              className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer">
              Cancel
            </button>
            <button onClick={onAction}
              className="flex-1 px-5 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer">
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Standing Ledger View ──────────────────────────────────────────────────────
// Mirrors the physical paper ledger: one row per resident, shows standing + last payment date
const StandingLedger = ({ residentsList, payments, monthlyDue }) => {
  const [search,          setSearch]          = useState('');
  const [streetFilter,    setStreetFilter]    = useState('All');
  const [standingFilter,  setStandingFilter]  = useState('All');

  // A payment covering more than one month's due at once (amount is a
  // multiple of the monthly due) is an advance payment. Only counts once the
  // Treasurer has actually approved it — i.e. status is 'paid', not still
  // 'pending_verification'.
  const monthsCoveredBy = (amount) => Math.max(1, Math.round(Number(amount || 0) / (monthlyDue || 1)));

  const nameCounts = buildNameCounts(residentsList);

  // Build one row per resident
  const rows = residentsList.map(r => {
    const rPayments = payments.filter(p => p.user_id === r.id);
    const paidPayments = rPayments.filter(p => (p.status || '').toLowerCase() === 'paid');

    // Last payment date
    const lastPaid = paidPayments.length > 0
      ? paidPayments.sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))[0]
      : null;

    // Standing: "Good" if latest due is paid; "No Record" if no payments at all; otherwise "Overdue/Pending"
    const latestDue = rPayments.sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))[0];
    let standing = 'No Record';
    let standingColor = 'bg-slate-100 text-slate-500 border-slate-200';
    if (latestDue) {
      const s = (latestDue.status || '').toLowerCase();
      if (s === 'paid') {
        if (monthsCoveredBy(latestDue.amount) > 1) { standing = 'Paid in Advance'; standingColor = 'bg-purple-50 text-purple-700 border-purple-100'; }
        else                                       { standing = 'Good';           standingColor = 'bg-emerald-50 text-emerald-700 border-emerald-100'; }
      }
      else if (s === 'overdue')            { standing = 'Overdue'; standingColor = 'bg-red-50 text-red-600 border-red-100';            }
      else if (s === 'pending' || s === 'unpaid') { standing = 'Pending'; standingColor = 'bg-amber-50 text-amber-700 border-amber-100'; }
    }

    return {
      id:           r.id,
      full_name:    r.full_name || '—',
      isDuplicate:  nameCounts[normalizeName(r.full_name)] > 1,
      block:        r.block || '—',
      lot:          r.lot   || '—',
      street:       r.street || '—',
      resident_type: r.resident_type || '—',
      standing,
      standingColor,
      lastPaidDate: lastPaid?.paid_at
        ? new Date(lastPaid.paid_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'No record',
      totalPaid: paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
      unpaidCount: rPayments.filter(p => ['unpaid','pending','pending_verification','overdue'].includes((p.status||'').toLowerCase())).length,
      // Accumulated balance — sum of ALL unpaid dues (grace period adds up)
      unpaidBalance: rPayments
        .filter(p => ['unpaid','pending','pending_verification','overdue'].includes((p.status||'').toLowerCase()))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    };
  });

  // Unique streets for filter dropdown
  const streets = ['All', ...new Set(rows.map(r => r.street).filter(s => s && s !== '—').sort())];

  const filtered = rows.filter(r =>
    (streetFilter === 'All' || r.street === streetFilter) &&
    (standingFilter === 'All' || r.standing === standingFilter) &&
    (!search || r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.block.toLowerCase().includes(search.toLowerCase()) ||
    r.lot.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => (a.unpaidBalance > 0 ? 0 : 1) - (b.unpaidBalance > 0 ? 0 : 1));
  const { paginated: paginatedPayment, page: payPage, setPage: setPayPage, totalPages: payTotalPages, total: filteredTotal } = usePagination(filtered, 5);

  const printLedger = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const rowsToUse = filtered.length > 0 ? filtered : rows;

    // ── Group residents by street — preserving the order they appear ──────────
    const streetGroups = [];
    const seen = {};
    rowsToUse.forEach(r => {
      const st = r.street || 'Unknown Street';
      if (!seen[st]) { seen[st] = true; streetGroups.push({ street: st, residents: [] }); }
      streetGroups.find(g => g.street === st).residents.push(r);
    });
    // Sort groups alphabetically by street name
    streetGroups.sort((a, b) => a.street.localeCompare(b.street));

    // ── Build table rows — street header + resident rows per group ────────────
    let globalIdx = 1;
    const tableRows = streetGroups.map(group => {
      const streetHeader = `
        <tr>
          <td colspan="8"
            style="background:#FFF200;color:#006837;font-weight:bold;font-size:12px;
                   padding:6px 10px;border:1px solid #006837;letter-spacing:0.5px;
                   text-transform:uppercase;">
            ${group.street}
          </td>
        </tr>`;
      const residentRows = group.residents.map(r => {
        const idx = globalIdx++;
        const isEven = idx % 2 === 0;
        const standingColor =
          r.standing === 'Good'           ? '#166534' :
          r.standing === 'Paid in Advance'? '#7e22ce' :
          r.standing === 'Overdue'        ? '#dc2626' :
          r.standing === 'Pending'        ? '#92400e' : '#64748b';
        return `
        <tr style="background:${isEven ? '#f0fdf4' : '#ffffff'};">
          <td style="padding:5px 8px;font-size:11px;text-align:center;border:1px solid #e2e8f0;">${idx}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.block}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.lot}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.full_name.split(' ').slice(-1)[0]}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.full_name.split(' ').slice(0,-1).join(' ')}</td>
          <td style="padding:5px 8px;font-size:11px;text-transform:capitalize;border:1px solid #e2e8f0;">${r.resident_type}</td>
          <td style="padding:5px 8px;font-size:11px;font-weight:bold;color:${standingColor};border:1px solid #e2e8f0;">${r.standing}</td>
          <td style="padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;">${r.lastPaidDate}</td>
          <td style="padding:5px 8px;font-size:11px;font-weight:bold;color:${r.unpaidBalance > 0 ? '#dc2626' : '#166534'};text-align:right;border:1px solid #e2e8f0;">${r.unpaidBalance > 0 ? '₱' + r.unpaidBalance.toLocaleString('en-PH') : '—'}</td>
        </tr>`;
      }).join('');
      return streetHeader + residentRows;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Monthly Dues Ledger — ${today}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      h2 { text-align: center; font-size: 15px; font-weight: bold; margin-bottom: 4px; }
      p.subtitle { text-align: center; font-size: 11px; color: #555; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #006837; }
      th { background: #006837; color: #FFF200; padding: 7px 8px; font-size: 11px; font-weight: bold; border: 1px solid #004d29; text-align: left; }
      @media print { body { margin: 8px; } @page { size: landscape; margin: 10mm; } }
    </style>
    </head><body>
    <h2>Updated Monthly Dues Payment as of ${today}</h2>
    <p class="subtitle">Chateau Real Executive Village Homeowners Association Inc. (CREVHAI) — Standing Ledger</p>
    <table>
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Block</th>
          <th>Lot</th>
          <th>Last Name</th>
          <th>First Name</th>
          <th>Status</th>
          <th>Standing</th>
          <th>Date of Last Payment</th>
          <th>Balance Owed</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    </body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=750');
    w.document.write(html);
    w.document.close();
    w.focus();
    // Trigger the print dialog but DON'T auto-close the tab afterward —
    // closing unconditionally also closes the tab if the person clicks
    // "Cancel" in the print dialog, losing the ledger. The person can close
    // the tab themselves once they're done (same behavior as the SOA printer).
    w.onload = () => { w.print(); };
  };

  const goodCount    = rows.filter(r => r.standing === 'Good').length;
  const advanceCount = rows.filter(r => r.standing === 'Paid in Advance').length;
  const overdueCount = rows.filter(r => r.standing === 'Overdue').length;
  const pendingCount = rows.filter(r => r.standing === 'Pending').length;
  const noRecord     = rows.filter(r => r.standing === 'No Record').length;


  // ── Export to CSV — matches physical ledger column order ─────────────────
  const exportToCSV = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const headers = ['Block','Lot','Street','Last Name','First Name','Status','Standing','Date of Last Payment','Unpaid Dues'];

    const csvRows = [
      // Title row like the physical ledger
      [`Updated Monthly Dues Payment as of ${today}`],
      [],
      headers,
      ...filtered.map(r => {
        // Split full_name into Last, First if possible (assumes "First Last" format)
        const parts     = r.full_name.split(' ');
        const lastName  = parts.length > 1 ? parts[parts.length - 1] : r.full_name;
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
        return [
          r.block,
          r.lot,
          r.street,
          lastName,
          firstName,
          r.resident_type,
          r.standing,
          r.lastPaidDate,
          r.unpaidCount > 0 ? `${r.unpaidCount} unpaid` : 'Good',
        ];
      }),
    ];

    const csvContent = csvRows
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Monthly_Dues_Standing_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <TableProperties size={15} className="text-[#006837]" />
              Monthly Dues Standing Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Mirrors the physical ledger — one row per resident, showing current standing and last payment date
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006837] hover:bg-[#004d29] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all shrink-0"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={printLedger}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-all shrink-0"
          >
            <Printer size={13} /> Print Ledger
          </button>
        </div>

        {/* Mini KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          {[
            { label: 'Good Standing',   value: goodCount,    color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
            { label: 'Paid in Advance', value: advanceCount, color: 'bg-purple-50 text-purple-700 border-purple-100'    },
            { label: 'Overdue',         value: overdueCount, color: 'bg-red-50 text-red-600 border-red-100'            },
            { label: 'Pending',         value: pendingCount, color: 'bg-amber-50 text-amber-700 border-amber-100'      },
            { label: 'No Record',       value: noRecord,     color: 'bg-slate-100 text-slate-500 border-slate-200'     },
          ].map(k => (
            <div key={k.label} className={`p-3 rounded-xl border text-center ${k.color}`}>
              <p className="text-xl font-black">{k.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search resident, block, lot…"
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
          </div>
          <select
            value={streetFilter}
            onChange={e => setStreetFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer shrink-0"
          >
            {streets.map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All Streets' : s}</option>
            ))}
          </select>
          <select
            value={standingFilter}
            onChange={e => setStandingFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer shrink-0"
          >
            <option value="All">All Standings</option>
            <option value="Good">Good</option>
            <option value="Paid in Advance">Paid in Advance</option>
            <option value="Overdue">Overdue</option>
            <option value="Pending">Pending</option>
            <option value="No Record">No Record</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Resident','Block','Lot','Street','Type','Standing','Last Payment','Unpaid Dues'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-300 text-sm">No residents found</td></tr>
            ) : paginatedPayment.map(r => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    {r.full_name}
                    {r.isDuplicate && <DuplicateBadge />}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{r.block}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{r.lot}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-[120px] truncate">{r.street}</td>
                <td className="px-4 py-3 text-sm text-slate-500 capitalize">{r.resident_type}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${r.standingColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      r.standing === 'Good' ? 'bg-emerald-400' :
                      r.standing === 'Paid in Advance' ? 'bg-purple-400' :
                      r.standing === 'Overdue' ? 'bg-red-400' :
                      r.standing === 'Pending' ? 'bg-amber-400' : 'bg-slate-300'
                    }`} />
                    {r.standing}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{r.lastPaidDate}</td>
                <td className="px-4 py-3">
                  {r.unpaidBalance > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black text-red-600">
                        ₱{r.unpaidBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-red-400 font-semibold">
                        {r.unpaidCount} month{r.unpaidCount !== 1 ? 's' : ''} overdue
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-600 font-bold">Settled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <>
          <PaginationBar page={payPage} totalPages={payTotalPages} setPage={setPayPage} total={filtered.length} rowsPerPage={10} />
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{filtered.length} of {rows.length} residents</p>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Payment Component ───────────────────────────────────────────────────
const Payment = () => {
  const [searchTerm,       setSearchTerm]       = useState('');
  const [statusFilter,     setStatusFilter]     = useState('All');
  const [residentFilter,   setResidentFilter]   = useState('All');
  const [activeView,       setActiveView]       = useState('transactions'); // 'transactions' | 'paid' | 'standing'

  // Paid tab filters
  const [paidSearchTerm,     setPaidSearchTerm]     = useState('');
  const [paidResidentFilter, setPaidResidentFilter] = useState('All');

  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false);

  // ── Proof-of-payment verification (resident-submitted, status 'pending_verification') ──
  const [proofReviewPayment, setProofReviewPayment] = useState(null); // the payment row being reviewed
  const [proofReviewImage,   setProofReviewImage]   = useState(null); // proof_url shown in lightbox
  const [proofReviewZoomed,  setProofReviewZoomed]  = useState(false); // toggled by clicking the proof image
  const [verifyingPaymentId, setVerifyingPaymentId]  = useState(null);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false); // "make sure it's finalized" step, gated by a countdown
  const [approveCountdown,     setApproveCountdown]     = useState(0);
  const [selectedPayment,       setSelectedPayment]       = useState(null);
  const [isConfirmVoidOpen,     setIsConfirmVoidOpen]     = useState(false);
  const [isUnpaidBreakdownOpen, setIsUnpaidBreakdownOpen] = useState(false);
  const [breakdownPayments,     setBreakdownPayments]     = useState([]);
  const [residentsList,     setResidentsList]     = useState([]);

  // ── Historical settlement (pre-app dues paid in real life, no in-app proof) ──
  // A Treasurer can't mark these paid directly — that's the same abuse risk as
  // marking any due paid without proof. Instead this sends a request to
  // approval_requests, which only takes effect once the President approves it
  // in Pending Approval — same two-step pattern already used for Void.
  const [historicalSettlementPayment, setHistoricalSettlementPayment] = useState(null);
  const [historicalNote,              setHistoricalNote]              = useState('');

  const [transaction,          setTransaction]          = useState({ status: null, message: '' });
  const [editFormData,         setEditFormData]         = useState({ amount: '', status: '', due_date: '', reference_no: '', paid_at: '', payer_reference_no: '' });
  const [payments,             setPayments]             = useState([]);
  const [loading,              setLoading]              = useState(true);

  const currentUserRole = localStorage.getItem('userRole') || 'resident';

  // ── Configurable monthly due (Treasurer/President only) ─────────────────────
  // Stored in hoa_settings (single row, id=1). Falls back to MONTHLY_DUE_DEFAULT
  // until the fetch below resolves, and again if the table doesn't exist yet.
  const [monthlyDue,           setMonthlyDue]           = useState(MONTHLY_DUE_DEFAULT);
  const [isEditDueOpen,        setIsEditDueOpen]        = useState(false);
  const [editDueValue,         setEditDueValue]         = useState('');
  const [savingDue,            setSavingDue]            = useState(false);

  // ── GCash QR code (Treasurer/President only) ─────────────────────────────────
  // Also stored on the hoa_settings single row, as photo_url — an image in
  // the public 'hoa-qr-codes' storage bucket. Shown on the printed/emailed SOA
  // so residents can scan-to-pay.
  const [qrCodeUrl,            setQrCodeUrl]            = useState(null);
  const [uploadingQr,          setUploadingQr]          = useState(false);
  const [isQrModalOpen,        setIsQrModalOpen]        = useState(false);

  const fetchMonthlyDue = async () => {
    try {
      const { data, error } = await supabase.from('hoa_settings').select('monthly_due_amount, photo_url').eq('id', 1).single();
      if (!error && data) {
        if (data.monthly_due_amount != null) setMonthlyDue(Number(data.monthly_due_amount));
        setQrCodeUrl(data.photo_url || null);
      }
    } catch (_e) {
      // hoa_settings not set up yet — keep the defaults.
    }
  };

  const handleUploadQrCode = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please upload an image file (PNG or JPG).'); return; }
    setUploadingQr(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `gcash-qr-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('hoa-qr-codes').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('hoa-qr-codes').getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      const { error: updateErr } = await supabase.from('hoa_settings').update({
        photo_url: publicUrl,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      }).eq('id', 1);
      if (updateErr) throw updateErr;

      setQrCodeUrl(publicUrl);
      await logAudit('UPDATE_QR_CODE', 'Updated the GCash payment QR code shown on the Statement of Account.');
    } catch (e) {
      alert('Failed to upload QR code: ' + e.message);
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSaveMonthlyDue = async () => {
    const newAmount = Number(editDueValue);
    if (!newAmount || newAmount <= 0) { alert('Enter a valid amount greater than 0.'); return; }
    setSavingDue(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('hoa_settings').update({
        monthly_due_amount: newAmount,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      }).eq('id', 1);
      if (error) throw error;
      setMonthlyDue(newAmount);
      await logAudit('UPDATE_MONTHLY_DUE', `Monthly due changed from ₱${monthlyDue} to ₱${newAmount}.`);
      setIsEditDueOpen(false);
    } catch (e) {
      alert('Failed to update monthly due: ' + e.message);
    } finally {
      setSavingDue(false);
    }
  };

  // ── Approve or reject a resident-submitted proof of payment ─────────────────
  // Payment rows land in status 'pending_verification' once a resident submits
  // payer_reference_no + proof_url (+ submitted_at) from the mobile app.
  const handleVerifyPayment = async (payment, decision) => {
    if (!payment) return;
    setVerifyingPaymentId(payment.id);
    try {
      let updates;
      if (decision === 'approve') {
        updates = {
          status: 'paid',
          paid_at: payment.submitted_at || new Date().toISOString(),
        };
        // Advance payments submitted from the mobile app land here without a
        // HOA reference number — only the per-month generator normally
        // assigns one. Backfill it now so the SOA / payment history always
        // shows a HOA REF # instead of "—".
        if (!payment.reference_no) {
          const { month, year } = getMonthYear(payment.due_date || new Date());
          updates.reference_no = generateRefNo(month, year, payment.user_id);
        }
      } else {
        // Reject — revert to unpaid/overdue (based on due date) and clear the
        // submission so the resident can resubmit a corrected proof.
        const isPastDue = payment.due_date && new Date(payment.due_date) < new Date();
        updates = {
          status: isPastDue ? 'overdue' : 'unpaid',
          payer_reference_no: null,
          proof_url: null,
          submitted_at: null,
        };
      }
      const { error } = await supabase.from('payments').update(updates).eq('id', payment.id);
      if (error) throw error;

      const residentName = residentsList.find(r => r.id === payment.user_id)?.full_name || 'Resident';
      const monthsCovered = monthsCoveredBy(payment.amount);
      const advanceNote = monthsCovered > 1 ? ` (covers ${monthsCovered} months — advance payment)` : '';
      await logAudit(
        decision === 'approve' ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
        `${decision === 'approve' ? 'Approved' : 'Rejected'} submitted proof of payment for ${residentName} — ₱${Number(payment.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}${advanceNote}, due ${payment.due_date || '—'}.`,
      );

      // ── Auto-reactivate if approving cleared the resident's last unpaid due ──
      if (decision === 'approve') {
        const { data: residentData } = await supabase
          .from('profiles').select('id, full_name, account_status')
          .eq('id', payment.user_id).single();

        if (residentData?.account_status === 'delinquent') {
          const { data: stillUnpaid } = await supabase
            .from('payments').select('id')
            .eq('user_id', payment.user_id)
            .in('status', ['unpaid', 'overdue', 'pending', 'pending_verification'])
            .limit(1);

          if (!stillUnpaid?.length) {
            await supabase.from('profiles')
              .update({ account_status: 'active' }).eq('id', payment.user_id);
            await logAudit('AUTO_REACTIVATE',
              `${residentData.full_name} auto-reactivated — all dues are now paid.`);
            fetchResidentsList();
          }
        }
      }

      await fetchPayments();
      setProofReviewPayment(null);
    } catch (e) {
      alert('Failed to update payment: ' + e.message);
    } finally {
      setVerifyingPaymentId(null);
    }
  };

  // ── Bulk-send SOA emails to every resident with an outstanding balance ──
  // Calls the 'send-soa-emails' Supabase Edge Function (see
  // supabase/functions/send-soa-emails/index.ts). Requires RESEND_API_KEY
  // to be set as an Edge Function secret before this will actually deliver mail.
  const [sendingSOA,        setSendingSOA]        = useState(false);
  const [showSendConfirm,   setShowSendConfirm]   = useState(false);
  const [sendSOAResult,     setSendSOAResult]     = useState(null);
  const [sendSOAViewMode,   setSendSOAViewMode]   = useState('both'); // 'outstanding' | 'history' | 'both' — applied to bulk email

  // ── Per-resident SOA print — content filter modal ──────────────────────────
  // Lets the treasurer choose, right before printing, whether the statement
  // shows outstanding charges only or past payment history only.
  const [soaPrintTarget, setSoaPrintTarget] = useState(null); // { resident, paidHistory } | null
  const [soaPrintChoice, setSoaPrintChoice] = useState('outstanding'); // 'outstanding' | 'history' | 'both'

  const handleSendAllSOA = async () => {
    setSendingSOA(true);
    setSendSOAResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-soa-emails', {
        body: { viewMode: sendSOAViewMode },
      });
      if (error) throw error;
      setSendSOAResult({ type: 'success', ...data });
      await logAudit('BULK_SEND_SOA', `Sent ${data.sent || 0} SOA email(s), ${data.failed || 0} failed.`);
    } catch (e) {
      setSendSOAResult({ type: 'error', error: e.message });
    } finally {
      setSendingSOA(false);
      setShowSendConfirm(false);
    }
  };

  const fetchAll = () => { fetchPayments(); fetchResidentsList(); fetchMonthlyDue(); };

  useEffect(() => { fetchAll(); }, []);

  // ── "Make sure it's finalized" countdown for the Approve confirmation ────────
  // Forces a short pause before Approve is clickable, so a treasurer can't
  // reflexively double-click through the confirmation without a beat to
  // actually re-check the proof.
  useEffect(() => {
    if (!isApproveConfirmOpen) return;
    setApproveCountdown(5);
    const interval = setInterval(() => {
      setApproveCountdown(c => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isApproveConfirmOpen]);

  // ── Extracted: generate dues for current month ──────────────────────────────
  // Called automatically on the 1st, OR manually via the demo test button.
  // force=true skips the "already generated this month" check.
  //
  // statement_date = the day the bill is issued (today, when this runs)
  // due_date       = the deadline to pay — last day of the SAME month
  // This keeps "when was I billed" clearly separate from "when must I pay".
  const runGenerateDues = async (force = false) => {
    const today          = new Date();
    today.setHours(0, 0, 0, 0);
    const month          = today.getMonth();
    const year           = today.getFullYear();
    const statementDate  = localToday();                                   // today — when the bill is issued
    const monthEnd        = new Date(year, month + 1, 0).toISOString().split('T')[0]; // due date — end of month
    const monthStart      = new Date(year, month,     1).toISOString().split('T')[0];

    const { data: residentsRaw } = await supabase
      .from('profiles').select('id, full_name, resident_type')
      .eq('account_status', 'active').order('full_name');
    // Tenants aren't billed for HOA dues — only owners/residents are (see fetchResidentsList above).
    const residents = (residentsRaw || []).filter(r => (r.resident_type || '').toLowerCase() !== 'tenant');
    if (!residents?.length) return { skipped: true, reason: 'No active residents found.' };

    // Per-resident idempotency — a resident who already has a payment row for
    // this month (e.g. paid in advance, or back-filled as 'pending' on
    // approval) must be skipped individually, not used to bail out of billing
    // everyone else. This used to check "does ANY row exist this month" and
    // skip the WHOLE batch if so, which silently left every other resident
    // unbilled for the month whenever even one resident already had a row.
    let residentsNeeding = residents;
    if (!force) {
      // Lower bound only — a row's due_date is the LAST month an advance
      // payment covers (see monthsCoveredBy/formatMonthCoverage further down
      // this component), so a resident who prepaid Aug+Sep in July has ONE
      // row with due_date = Sep 30. Adding an upper bound of monthEnd would
      // put that row outside August's window and wrongly bill them again for
      // a month they already paid for.
      const { data: existingFromThisMonthOn } = await supabase
        .from('payments').select('user_id, amount, due_date')
        .gte('due_date', monthStart);
      const currentIdx = year * 12 + month;
      const alreadyBilled = new Set();
      (existingFromThisMonthOn || []).forEach(p => {
        if (!p.due_date) return;
        const d = new Date(p.due_date);
        const dueIdx = d.getFullYear() * 12 + d.getMonth();
        const covered = monthsCoveredBy(p.amount);
        const startIdx = dueIdx - (covered - 1);
        if (startIdx <= currentIdx && currentIdx <= dueIdx) alreadyBilled.add(p.user_id);
      });
      residentsNeeding = residents.filter(r => !alreadyBilled.has(r.id));
      if (!residentsNeeding.length) return { skipped: true, reason: 'Already generated for this month.' };
    }

    const lineItems = buildLineItemBreakdown(monthlyDue);

    const rows = residentsNeeding.map(r => ({
      user_id:        r.id,
      amount:         monthlyDue,
      statement_date: statementDate,
      due_date:       monthEnd,
      status:         'unpaid',
      reference_no:   generateRefNo(month, year, r.id),
      line_items:     lineItems,
    }));

    const { error } = await supabase.from('payments').insert(rows);
    if (error) return { success: false, error: error.message };

    await logAudit('AUTO_MONTHLY_DUE',
      `Generated ₱${monthlyDue} monthly dues for ${rows.length} residents — ${MONTHS[month]} ${year}. Statement: ${statementDate}, Due: ${monthEnd}.`);
    fetchPayments();
    return { success: true, count: rows.length, month: MONTHS[month], year };
  };

  // ── Back-fill past dues for a resident with NO payment records at all ────────
  // Mirrors AccountApproval.jsx's backfillPastDues, but callable on-demand
  // from this page. A brand-new resident normally gets Jan→current-month dues
  // generated the moment their account is approved — but if that step was
  // skipped, failed silently, or their account predates the feature, they're
  // left with zero payment rows and show up here as "No Record" with no way
  // to open their detail view. This regenerates the missing months (as
  // 'pending', same as a fresh approval) so View Detail always has something
  // to show. Months after the current one are left alone — those keep coming
  // from the regular auto-generate-dues job, not from here.
  const backfillPastDuesForResident = async (residentId) => {
    try {
      const lineItems = buildLineItemBreakdown(monthlyDue);
      const now = new Date();
      const year = now.getFullYear();
      const currentMonth = now.getMonth();

      const { data: existing } = await supabase.from('payments').select('due_date').eq('user_id', residentId);
      const existingMonths = new Set((existing || []).map(p => (p.due_date || '').slice(0, 7)));

      const rows = [];
      for (let m = 0; m <= currentMonth; m++) {
        const lastDay = new Date(year, m + 1, 0).getDate();
        const dueDate = `${year}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        if (existingMonths.has(dueDate.slice(0, 7))) continue;
        rows.push({
          user_id:        residentId,
          amount:         monthlyDue,
          statement_date: `${year}-${String(m + 1).padStart(2, '0')}-01`,
          due_date:       dueDate,
          status:         'pending',
          reference_no:   generateRefNo(m, year, residentId),
          line_items:     lineItems,
        });
      }
      if (!rows.length) return [];

      const { data: inserted, error } = await supabase.from('payments').insert(rows).select();
      if (error) throw error;

      const residentName = residentsList.find(res => res.id === residentId)?.full_name || 'Resident';
      await logAudit('BACKFILL_DUES',
        `${residentName} — back-filled ${rows.length} past due(s) as Pending (${MONTHS[0]}–${MONTHS[currentMonth]} ${year}) for Treasurer verification`);

      return inserted || [];
    } catch (e) {
      console.error('Back-filling past dues failed:', e.message);
      return [];
    }
  };

  // ── Balance-based delinquency check ──────────────────────────────────────
  // Flags any active resident whose total unpaid balance is ≥ ₱450 (3 months).
  // The graceDays param is kept for backward-compat but no longer used.
  const runDelinquencyCheck = async (graceDays = null) => {
    const DELINQUENT_THRESHOLD = monthlyDue * 3; // 3 months unpaid, at the current due amount

    // Fetch all unpaid payments grouped by resident.
    // 'pending' is excluded — those are unverified back-filled dues on newly
    // approved residents (see AccountApproval.jsx) and shouldn't by themselves
    // flip a brand-new resident straight to delinquent before the Treasurer
    // has had a chance to verify whether they were already paid.
    const { data: unpaidPayments, error: fetchErr } = await supabase
      .from('payments')
      .select('user_id, amount')
      .in('status', ['unpaid', 'overdue', 'pending_verification']);

    if (fetchErr || !unpaidPayments?.length) return { success: true, count: 0 };

    // Sum balance per resident — flag those >= threshold
    const balanceMap = {};
    unpaidPayments.forEach(p => {
      balanceMap[p.user_id] = (balanceMap[p.user_id] || 0) + Number(p.amount || 0);
    });

    const eligibleIds = Object.entries(balanceMap)
      .filter(([, bal]) => bal >= DELINQUENT_THRESHOLD)
      .map(([id]) => id);

    if (!eligibleIds.length) return { success: true, count: 0 };

    // Only flag those who are currently active (don't re-flag already delinquent)
    const { data: activeResidents } = await supabase
      .from('profiles').select('id, full_name')
      .in('id', eligibleIds).eq('account_status', 'active');

    if (!activeResidents?.length) return { success: true, count: 0 };

    const idsToFlag = activeResidents.map(r => r.id);
    const { error } = await supabase.from('profiles')
      .update({ account_status: 'delinquent' }).in('id', idsToFlag);

    if (error) return { success: false, error: error.message };

    await logAudit('AUTO_DELINQUENT',
      `Marked ${idsToFlag.length} resident(s) as delinquent — unpaid balance ≥ ₱${DELINQUENT_THRESHOLD}. Residents: ${activeResidents.map(r => r.full_name).join(', ')}`);
    return { success: true, count: idsToFlag.length, names: activeResidents.map(r => r.full_name) };
  };

  // NOTE: Monthly dues generation + delinquency checks used to auto-run here
  // on every Payments page load. That's now handled server-side by the
  // `generate-monthly-dues` Edge Function, scheduled via Supabase Cron to run
  // every midnight (PHT) — independent of whether anyone opens this page.
  // runGenerateDues() and runDelinquencyCheck() below are kept for the manual
  // "force generate" test button and other UI actions that still call them directly.

  const fetchResidentsList = async () => {
    try {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, phone, block, lot, street, resident_type')
        .order('full_name');
      // Tenants aren't billed for HOA dues — exclude them from every table on this page.
      const owners = (data || []).filter(r => (r.resident_type || '').toLowerCase() !== 'tenant');
      setResidentsList(owners);
    } catch (e) { console.error(e.message); }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data: pData, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (!pData?.length) { setPayments([]); return; }

      // Auto-overdue check
      // 'pending' is excluded on purpose — it's used for back-filled dues on
      // newly-approved residents (see AccountApproval.jsx's backfillPastDues),
      // which represent unverified history rather than a confirmed missed
      // payment. They stay 'pending' until the Treasurer verifies/edits them,
      // instead of silently flipping to 'overdue' once their due date passes.
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const toOverdue = pData.filter(p => p.status !== 'paid' && p.status !== 'overdue' && p.status !== 'pending_verification' && p.status !== 'pending' && p.due_date && new Date(p.due_date) < today).map(p => p.id);
      if (toOverdue.length) {
        await supabase.from('payments').update({ status: 'overdue' }).in('id', toOverdue);
        await logAudit('SYSTEM_AUTO_UPDATE', `Auto-updated ${toOverdue.length} payment(s) to Overdue.`);
        toOverdue.forEach(id => { const p = pData.find(x => x.id === id); if (p) p.status = 'overdue'; });
      }

      const userIds = [...new Set(pData.map(p => p.user_id).filter(Boolean))];
      let profiles  = [];
      if (userIds.length) {
        const { data: pr } = await supabase.from('profiles').select('id, full_name, address, street, email, phone').in('id', userIds);
        profiles = pr || [];
      }
      setPayments(pData.map(p => ({ ...p, profiles: profiles.find(pr => pr.id === p.user_id) || null })));
    } catch (e) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value,
      // Auto-fill paid_at with today when status is switched to 'paid'
      // Clear it if status is switched away from 'paid'
      ...(name === 'status' && value === 'paid' && !prev.paid_at
        ? { paid_at: localToday() }
        : name === 'status' && value !== 'paid'
        ? { paid_at: '' }
        : {}),
    }));
  };

  const submitEditTransaction = async () => {
    if (!selectedPayment) return;
    if (editFormData.status === 'paid' && !editFormData.payer_reference_no?.trim()) {
      setTransaction({ status: 'error', message: 'Please enter the resident\'s payment reference number (GCash/bank transfer #) before marking as paid.' });
      return;
    }
    setTransaction({ status: 'loading', message: 'Updating transaction…' });
    try {
      const payload = {
        amount: editFormData.amount ? Number(editFormData.amount) : null,
        status: editFormData.status, due_date: editFormData.due_date || null, reference_no: editFormData.reference_no || null,
        paid_at: editFormData.status === 'paid' ? (editFormData.paid_at ? new Date(editFormData.paid_at).toISOString() : new Date().toISOString()) : null,
        payer_reference_no: editFormData.status === 'paid' ? (editFormData.payer_reference_no?.trim() || null) : null,
      };

      const { error } = await supabase.from('payments').update(payload).eq('id', selectedPayment.id);
      if (error) throw error;
      await logAudit('EDIT_PAYMENT', `Updated Ref: ${payload.reference_no || selectedPayment.reference_no} → ${payload.status}.`);

      // ── Auto-reactivate delinquent resident if all dues are now paid ────
      // Only runs when the payment being updated is marked as 'paid'
      if (payload.status === 'paid' && selectedPayment.user_id) {
        // Check if the resident is currently delinquent
        const { data: residentData } = await supabase
          .from('profiles')
          .select('id, full_name, account_status')
          .eq('id', selectedPayment.user_id)
          .single();

        if (residentData?.account_status === 'delinquent') {
          // Check if this resident still has any remaining unpaid dues
          const { data: remainingUnpaid } = await supabase
            .from('payments')
            .select('id')
            .eq('user_id', selectedPayment.user_id)
            .in('status', ['unpaid', 'overdue', 'pending', 'pending_verification'])
            .neq('id', selectedPayment.id) // exclude the one we just paid
            .limit(1);

          // No more unpaid dues — reactivate the account
          if (!remainingUnpaid?.length) {
            const { error: reactivateErr } = await supabase
              .from('profiles')
              .update({ account_status: 'active' })
              .eq('id', selectedPayment.user_id);

            if (!reactivateErr) {
              await logAudit(
                'AUTO_REACTIVATE',
                `${residentData.full_name} auto-reactivated — all dues are now paid.`
              );
              setIsEditTransactionOpen(false);
              fetchPayments();
              setTransaction({
                status: 'success',
                message: `Payment recorded. ${residentData.full_name}'s account has been automatically reactivated — all dues are now settled.`,
              });
              return;
            }
          }
        }
      }
      // ────────────────────────────────────────────────────────────────────

      setIsEditTransactionOpen(false);
      fetchPayments();
      setTransaction({ status: 'success', message: 'Transaction updated successfully.' });
    } catch (e) { setTransaction({ status: 'error', message: 'Failed: ' + e.message }); }
  };

  const handleVoidTransaction = async () => {
    if (!selectedPayment) return;
    setIsConfirmVoidOpen(false);
    if (currentUserRole === 'super_admin') {
      setTransaction({ status: 'loading', message: 'Voiding transaction…' });
      try {
        const { error } = await supabase.from('payments').delete().eq('id', selectedPayment.id);
        if (error) throw error;
        await logAudit('VOID_PAYMENT', `Voided Ref: ${selectedPayment.reference_no}.`);
        fetchPayments();
        setTransaction({ status: 'success', message: 'Transaction voided.' });
      } catch (e) { setTransaction({ status: 'error', message: 'Failed: ' + e.message }); }
    } else {
      setTransaction({ status: 'loading', message: 'Submitting void request…' });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('approval_requests').insert([{
          target_table: 'payments', target_id: selectedPayment.id, action_type: 'DELETE',
          requested_data: { reference_no: selectedPayment.reference_no, amount: selectedPayment.amount },
          status: 'PENDING', requested_by: user?.id || null,
        }]);
        if (error) throw error;
        await logAudit('REQUEST_VOID_PAYMENT', `Void request for Ref: ${selectedPayment.reference_no}.`);
        setTransaction({ status: 'success', message: 'Void request sent to the President for approval.' });
      } catch (e) { setTransaction({ status: 'error', message: 'Failed: ' + e.message }); }
    }
  };

  // ── Historical settlement request ─────────────────────────────────────────
  // For a 'pending' due (back-filled — see backfillPastDuesForResident above)
  // that the resident actually already paid in real life before the app
  // existed. There's no in-app proof to submit for a month that already
  // happened, so this can't go through the normal proof-of-payment flow — but
  // a Treasurer also can't just flip it to 'paid' directly (that's exactly the
  // one-click abuse risk the Edit Transaction form already refuses to allow).
  // Instead this sends a request to approval_requests; it only takes effect
  // once the President reviews the note and approves it in Pending Approval.
  const requestHistoricalSettlement = async () => {
    if (!historicalSettlementPayment) return;
    const note = historicalNote.trim();
    if (note.length < 10) {
      setTransaction({ status: 'error', message: 'Please describe how this was verified (OR#, ledger entry, date paid, etc.) — at least a sentence.' });
      return;
    }
    setTransaction({ status: 'loading', message: 'Submitting settlement request…' });
    try {
      const p = historicalSettlementPayment;
      const residentName = (Array.isArray(p.profiles) ? p.profiles[0]?.full_name : p.profiles?.full_name)
        || residentsList.find(r => r.id === p.user_id)?.full_name || 'Resident';
      const monthLabel = formatMonthCoverage(p.due_date, monthsCoveredBy(p.amount));

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('approval_requests').insert([{
        target_table: 'payments', target_id: p.id, action_type: 'UPDATE',
        requested_data: {
          status: 'paid',
          paid_at: new Date().toISOString(),
          payer_reference_no: 'Historical/Manual settlement — pre-app payment',
          reference_no: p.reference_no,
          amount: p.amount,
          // Display-only for the Pending Approval review table — stripped
          // before the actual payments update runs (see PendingApproval.jsx).
          details: `${residentName} — ${monthLabel}: ${note}`,
        },
        status: 'PENDING', requested_by: user?.id || null,
      }]);
      if (error) throw error;

      await logAudit('REQUEST_HISTORICAL_SETTLEMENT',
        `Requested historical settlement for ${residentName} — ${monthLabel}: ${note}`);
      setHistoricalSettlementPayment(null);
      setHistoricalNote('');
      setTransaction({ status: 'success', message: 'Sent to the President for approval. It stays Pending until then.' });
    } catch (e) {
      setTransaction({ status: 'error', message: 'Failed: ' + e.message });
    }
  };

  // A due can only become 'paid' through the proof-of-verification step — a
  // month only reaches 'pending_verification' once the resident has actually
  // submitted a payer_reference_no + proof_url. This modal is a read-only
  // overview of what's owed; it hands off to Review Proof, never sets 'paid' itself.
  const breakdownPendingPayment = breakdownPayments.find(
    p => (p.status || '').toLowerCase() === 'pending_verification'
  ) || null;

  // Full billing history (paid + unpaid) for whoever the modal is open for,
  // newest month first — so past settled months (Jan–Jun, etc.) stay visible
  // below the current unpaid/pending one instead of disappearing entirely.
  const breakdownUserId = breakdownPayments[0]?.user_id;
  const breakdownFullHistory = breakdownUserId
    ? payments
        .filter(p => p.user_id === breakdownUserId)
        .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))
    : breakdownPayments;

  // Summary banner must only total what's still actually owed. breakdownPayments
  // is sometimes seeded with a settled resident's FULL history (see the "View
  // Detail" button for settled rows) just to anchor breakdownUserId above — it
  // is not safe to sum directly, or paid months would inflate "Total Unpaid
  // Balance"/"Months Unpaid".
  const breakdownUnpaidOnly = breakdownFullHistory.filter(p =>
    ['unpaid', 'overdue', 'pending', 'pending_verification'].includes((p.status || '').toLowerCase())
  );

  // A resident can submit one proof-of-payment that covers more than one
  // month at once (e.g. ₱300 against a ₱150 due = paying 2 months ahead in a
  // single submission) — the row's own "amount" is what carries that, since
  // there's no separate row per advance month. Round to the nearest whole
  // month so tiny rounding differences in the per-category breakdown don't
  // misclassify a normal single-month due as a "2 months" one.
  const monthsCoveredBy = (amount) => Math.max(1, Math.round(Number(amount || 0) / (monthlyDue || 1)));
  // A row's due_date is the LAST month it covers — an advance payment of N
  // months rolls the (N-1) preceding months into this same row instead of
  // getting rows of their own, so the label needs to span back from due_date.
  const formatMonthCoverage = (dueDate, months) => {
    if (!dueDate) return '—';
    const end = new Date(dueDate);
    if (months <= 1) return end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
    const sameYear = start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString('en-US', sameYear ? { month: 'short' } : { month: 'short', year: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${startLabel} to ${endLabel}`;
  };
  const breakdownMonthsUnpaid = breakdownUnpaidOnly.reduce((s, p) => s + monthsCoveredBy(p.amount), 0);
  const breakdownAdvanceMonths = breakdownUnpaidOnly
    .filter(p => monthsCoveredBy(p.amount) > 1)
    .reduce((s, p) => s + monthsCoveredBy(p.amount), 0);

  // ── Resident-based table rows — one row per resident, always ─────────────────
  // Amount = unpaid balance (grows as months are generated, resets to ₱0 when paid).
  // Paid receipts are NOT shown as separate rows — the table is resident-centric.
  const mainNameCounts = buildNameCounts(residentsList);
  const residentRows = residentsList.map(r => {
    const rPayments = payments.filter(p => p.user_id === r.id);
    const unpaidList = rPayments.filter(p =>
      ['unpaid','overdue','pending','pending_verification'].includes((p.status || '').toLowerCase())
    ).sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

    const balance = unpaidList.reduce((s, p) => s + Number(p.amount || 0), 0);
    const months  = unpaidList.length;
    const oldest  = unpaidList[0]?.due_date || null;
    const newest  = unpaidList[unpaidList.length - 1]?.due_date || null;

    // Determine standing badge
    const hasAnyPayment = rPayments.length > 0;
    let standing = 'No Record';
    if (hasAnyPayment) {
      standing = months > 0 ? 'Unpaid' : 'Settled';
    }

    // The specific unpaid month (if any) currently awaiting treasurer/president
    // review — resident already submitted payer_reference_no + proof_url.
    const pendingVerification = unpaidList.find(p => (p.status || '').toLowerCase() === 'pending_verification') || null;

    // A resident "paid in advance" if any single payment row's amount covers
    // more than one month at once (e.g. ₱300 against a ₱150 due). Flagged
    // separately from pendingAdvanceVerification so the filter can surface
    // advance payers regardless of status, while the notification badge only
    // counts ones still awaiting the Treasurer's review.
    const hasAdvancePayment = rPayments.some(p => monthsCoveredBy(p.amount) > 1);
    const pendingAdvanceVerification = pendingVerification && monthsCoveredBy(pendingVerification.amount) > 1
      ? pendingVerification : null;

    return {
      _residentRow: true,
      user_id:      r.id,
      full_name:    r.full_name || '—',
      isDuplicate:  mainNameCounts[normalizeName(r.full_name)] > 1,
      street:       r.street || 'N/A',
      fullAddress:  buildFullAddress(r.block, r.lot, r.street),
      block:        r.block || '',
      lot:          r.lot   || '',
      balance,
      months,
      oldest,
      newest,
      standing,
      unpaidList,
      allPayments: rPayments,
      pendingVerification,
      hasAdvancePayment,
      pendingAdvanceVerification,
    };
  });

  // Apply search + resident filter to resident rows
  const consolidatedPayments = residentRows.filter(r => {
    const nameMatch = r.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const residentMatch = residentFilter === 'All' || r.user_id === residentFilter;
    const statusMatch = statusFilter === 'All'
      || (statusFilter === 'Paid'    && r.standing === 'Settled')
      || (statusFilter === 'Unpaid'  && r.unpaidList.some(p => (p.status || '').toLowerCase() === 'unpaid'))
      || (statusFilter === 'Overdue' && r.unpaidList.some(p => (p.status || '').toLowerCase() === 'overdue'))
      || (statusFilter === 'Pending' && r.unpaidList.some(p => (p.status || '').toLowerCase() === 'pending'))
      || (statusFilter === 'PendingVerification' && !!r.pendingVerification)
      || (statusFilter === 'Advance' && r.hasAdvancePayment);
    return nameMatch && residentMatch && statusMatch;
  }).sort((a, b) => (a.months > 0 ? 0 : 1) - (b.months > 0 ? 0 : 1));

  const { paginated: paginatedPayments, page: transPage, setPage: setTransPage, totalPages: transTotalPages } = usePagination(consolidatedPayments, 5);

  // Notification badge — advance payments still awaiting Treasurer verification.
  const advancePendingResidents = residentRows.filter(r => r.pendingAdvanceVerification);

  // ── Paid tab rows — one row per resident with at least one paid due ──────────
  const paidRows = residentsList.map(r => {
    const rPayments  = payments.filter(p => p.user_id === r.id);
    const paidList   = rPayments.filter(p => (p.status || '').toLowerCase() === 'paid')
      .sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0));
    const totalPaid  = paidList.reduce((s, p) => s + Number(p.amount || 0), 0);
    const lastPaid   = paidList[0]?.paid_at || null;
    const stillUnpaid = rPayments.filter(p =>
      ['unpaid','overdue','pending','pending_verification'].includes((p.status || '').toLowerCase())
    ).length;
    // A single paid row's amount can cover more than one month at once (an
    // advance payment), so the real month count is the sum of months each
    // row covers, not the number of rows.
    const paidMonths = paidList.reduce((s, p) => s + monthsCoveredBy(p.amount), 0);
    const hasAdvancePayment = paidList.some(p => monthsCoveredBy(p.amount) > 1);
    return {
      user_id:    r.id,
      full_name:  r.full_name || '—',
      street:     r.street || 'N/A',
      fullAddress: buildFullAddress(r.block, r.lot, r.street),
      totalPaid,
      paidMonths,
      lastPaid,
      stillUnpaid,
      hasAdvancePayment,
    };
  }).filter(r => r.paidMonths > 0);

  const filteredPaid = paidRows.filter(r => {
    const nameMatch     = r.full_name.toLowerCase().includes(paidSearchTerm.toLowerCase());
    const residentMatch = paidResidentFilter === 'All' || r.user_id === paidResidentFilter;
    return nameMatch && residentMatch;
  }).sort((a, b) => (a.stillUnpaid > 0 ? 0 : 1) - (b.stillUnpaid > 0 ? 0 : 1));

  const { paginated: paginatedPaid, page: paidPage, setPage: setPaidPage, totalPages: paidTotalPages } =
    usePagination(filteredPaid, 5);

  const getStatusStyle = (s) => {
    switch ((s || '').toLowerCase()) {
      case 'paid':                return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'pending_verification': return 'bg-blue-50 text-blue-700 border border-blue-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'overdue': return 'bg-red-50 text-red-600 border border-red-100';
      case 'unpaid':  return 'bg-slate-100 text-slate-600 border border-slate-200';
      default:        return 'bg-slate-100 text-slate-500 border border-slate-200';
    }
  };

  const totalCollected = payments.filter(p => p.status?.toLowerCase() === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount   = payments.filter(p => ['pending','unpaid'].includes(p.status?.toLowerCase())).length;
  const pendingVerificationCount = payments.filter(p => p.status?.toLowerCase() === 'pending_verification').length;
  const overdueCount   = payments.filter(p => p.status?.toLowerCase() === 'overdue').length;
  const paidCount      = payments.filter(p => p.status?.toLowerCase() === 'paid').length;


  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#006837]/20 border-t-[#006837] rounded-full animate-spin" />
        <p className="text-[#006837] font-semibold animate-pulse">Loading payment data…</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen space-y-6">

      <TransactionModal status={transaction.status} message={transaction.message}
        onClose={() => { setTransaction({ status: null, message: '' }); fetchPayments(); }} />

      {/* ── Unpaid Breakdown / Mark All Paid Modal ── */}
      {/* Rendered through a portal straight to <body> — same fix as the SOA
          modal below. A `fixed inset-0` overlay nested this deep only covers
          the viewport if every ancestor stays free of transform/filter/
          contain/perspective/will-change; any one of those (now or added
          later) silently shrinks it to that ancestor's box instead, leaving
          part of the real page uncovered/undimmed behind it. A portal makes
          the overlay a direct child of <body>, so it's always guaranteed to
          be truly viewport-relative regardless of what's above it in the tree. */}
      {isUnpaidBreakdownOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsUnpaidBreakdownOpen(false)} />
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10">
            <div className="p-7">

              {/* Header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Monthly Due Details</h2>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {(() => {
                      const p0 = breakdownPayments[0];
                      if (!p0) return 'Resident';
                      if (p0.profiles) {
                        const pr = Array.isArray(p0.profiles) ? p0.profiles[0] : p0.profiles;
                        return pr?.full_name || 'Resident';
                      }
                      return residentsList.find(r => r.id === p0.user_id)?.full_name || 'Resident';
                    })()}
                  </p>
                </div>
                <button onClick={() => setIsUnpaidBreakdownOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"><X size={18} /></button>
              </div>

              {/* Summary banner — green when fully settled, red when balance is owed */}
              <div className={`border rounded-2xl p-4 mb-5 flex items-center justify-between ${
                breakdownUnpaidOnly.length ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
              }`}>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${breakdownUnpaidOnly.length ? 'text-red-400' : 'text-emerald-500'}`}>Total Unpaid Balance</p>
                  <p className={`text-2xl font-black ${breakdownUnpaidOnly.length ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₱{breakdownUnpaidOnly.reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${breakdownUnpaidOnly.length ? 'text-red-400' : 'text-emerald-500'}`}>Months Unpaid</p>
                  <p className={`text-2xl font-black ${breakdownUnpaidOnly.length ? 'text-red-600' : 'text-emerald-600'}`}>{breakdownMonthsUnpaid}</p>
                  {breakdownAdvanceMonths > 0 && (
                    <p className="inline-flex items-center gap-1 mt-1 text-xs font-black px-2 py-1 rounded-lg bg-purple-100 text-purple-700 border border-purple-200">
                      {breakdownAdvanceMonths} Months Advance
                    </p>
                  )}
                </div>
              </div>

              {/* Full billing history — unpaid/pending months plus past settled ones, scrolls past ~4 rows */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 mb-5">
                {breakdownFullHistory.map((p, i) => {
                  const st = (p.status || '').toLowerCase();
                  const badgeColor = st === 'paid'
                    ? 'bg-emerald-100 text-emerald-600'
                    : st === 'pending_verification'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-red-100 text-red-500';
                  const rowMonths = monthsCoveredBy(p.amount);
                  return (
                  <div key={p.id} className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full ${badgeColor} text-[10px] font-black flex items-center justify-center shrink-0`}>{i + 1}</span>
                      <div>
                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 flex-wrap">
                          {formatMonthCoverage(p.due_date, rowMonths)}
                          {st === 'pending_verification' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Pending Verification</span>
                          )}
                          {st === 'paid' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Paid</span>
                          )}
                        </span>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {st === 'paid'
                            ? `Paid ${p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}`
                            : <>Billed {p.statement_date ? new Date(p.statement_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                              {' · '}Due {p.due_date ? new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</>}
                        </p>
                        {rowMonths > 1 && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs font-black px-2 py-1 rounded-lg bg-purple-100 text-purple-700 border border-purple-300">
                            {rowMonths} Months Advance
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800">₱{Number(p.amount).toLocaleString()}</span>
                      <button
                        onClick={() => {
                          setSelectedPayment(p);
                          setEditFormData({ amount: p.amount || '', status: p.status || 'unpaid', due_date: p.due_date?.split('T')[0] || '', reference_no: p.reference_no || '', paid_at: p.paid_at?.split('T')[0] || '', payer_reference_no: p.payer_reference_no || '' });
                          setIsUnpaidBreakdownOpen(false);
                          setIsEditTransactionOpen(true);
                        }}
                        className="text-[#006837] bg-[#006837]/10 hover:bg-[#006837]/20 p-1.5 rounded-lg transition-all cursor-pointer" title="Edit this month only">
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPayment(p);
                          setIsUnpaidBreakdownOpen(false);
                          setIsConfirmVoidOpen(true);
                        }}
                        className="text-red-500 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-all cursor-pointer" title="Void this month only">
                        <Trash2 size={13} />
                      </button>
                      {st === 'pending' && (
                        <button
                          onClick={() => {
                            setHistoricalSettlementPayment(p);
                            setHistoricalNote('');
                            setIsUnpaidBreakdownOpen(false);
                          }}
                          className="text-amber-600 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-lg transition-all cursor-pointer"
                          title="Already paid in real life, before the app — request historical settlement">
                          <History size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Verification status banner */}
              {breakdownPendingPayment ? (
                <div className="mb-5 p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-blue-700">
                    The resident has submitted proof of payment for one of these months. Review it to approve or reject — a due can only become <span className="font-black">Paid</span> through that step.
                  </p>
                </div>
              ) : (
                <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-slate-500">
                    Waiting on the resident to pay and submit proof (GCash/bank transfer #). These months can't be marked as paid until then.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button onClick={() => setIsUnpaidBreakdownOpen(false)}
                  className="flex-1 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsUnpaidBreakdownOpen(false);
                    setProofReviewPayment(breakdownPendingPayment);
                  }}
                  disabled={!breakdownPendingPayment}
                  title={!breakdownPendingPayment ? 'No submitted payment to review yet' : undefined}
                  className="flex-1 px-5 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Eye size={16} />
                  {breakdownPendingPayment ? 'Review Payment Proof' : 'Awaiting Resident Payment'}
                </button>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Void confirm ── */}
      <ModalOverlay
        isOpen={isConfirmVoidOpen} onClose={() => setIsConfirmVoidOpen(false)}
        title="Request Void Approval"
        subtitle="This requires President approval before the transaction is removed."
        actionLabel="Submit Request"
        onAction={handleVoidTransaction}
      >
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3">
          <AlertCircle size={18} />
          <p className="text-sm font-semibold">
            The President will review and approve this deletion.
          </p>
        </div>
      </ModalOverlay>

      {/* ── Historical settlement request (pre-app due, paid in real life) ── */}
      <ModalOverlay
        isOpen={!!historicalSettlementPayment} onClose={() => setHistoricalSettlementPayment(null)}
        title="Request Historical Settlement"
        subtitle="This requires President approval before the month is marked Paid."
        actionLabel="Send for Approval"
        onAction={requestHistoricalSettlement}
      >
        <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl flex items-start gap-3">
          <History size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm font-semibold">
            Only use this for dues from before the app existed, paid in real life (cash/manual) with no in-app proof to submit.
            The Treasurer can't mark a due Paid directly — the President must confirm it first, the same way Void requests work.
          </p>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            How was this verified? <span className="text-red-500">*required</span>
          </label>
          <textarea
            value={historicalNote}
            onChange={e => setHistoricalNote(e.target.value)}
            rows={3}
            placeholder="e.g. OR#1042, paid cash to the previous Treasurer on Jan 5 2026, confirmed against the physical ledger"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20"
          />
        </div>
      </ModalOverlay>

      {/* ── Edit transaction ── */}
      <ModalOverlay isOpen={isEditTransactionOpen} onClose={() => setIsEditTransactionOpen(false)}
        title="Edit Transaction" subtitle="Update resident payment details"
        actionLabel="Update Transaction" onAction={submitEditTransaction}>
        <div className="grid gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Resident</label>
            <input readOnly value={(Array.isArray(selectedPayment?.profiles) ? selectedPayment?.profiles[0]?.full_name : selectedPayment?.profiles?.full_name) || 'Unknown'}
              className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl cursor-not-allowed text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
            <select name="status" value={editFormData.status} onChange={handleEditChange}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer">
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
              <option value="pending_verification">Pending Verification</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Due Date</label>
              <input type="date" name="due_date" value={editFormData.due_date} readOnly disabled
                title="Due date is set automatically and can't be edited here"
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-sm cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reference No.</label>
              <input type="text" name="reference_no" value={editFormData.reference_no} readOnly disabled placeholder="Ref Number"
                title="Reference number is set automatically and can't be edited here"
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-sm cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">View of Proof of Payment</label>
            {selectedPayment?.proof_url ? (
              <button type="button"
                onClick={() => { setProofReviewImage(selectedPayment.proof_url); setProofReviewZoomed(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                <Eye size={13} /> View Proof of Payment
              </button>
            ) : (
              <div className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-sm text-center cursor-not-allowed">
                No proof submitted
              </div>
            )}
          </div>
          {editFormData.status === 'paid' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Resident's Payment Ref # <span className="text-red-500">*required</span>
                </label>
                <input type="text" name="payer_reference_no" value={editFormData.payer_reference_no || ''} onChange={handleEditChange}
                  placeholder="GCash ref # or bank transfer #"
                  className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-800 placeholder-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/30 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Paid</label>
                <input type="date" name="paid_at" value={editFormData.paid_at || localToday()} readOnly disabled
                  title="Date paid is set automatically to today and can't be edited here"
                  className="w-full px-4 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl cursor-not-allowed" />
              </div>
            </>
          )}
        </div>
      </ModalOverlay>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CreditCard size={22} className="text-[#006837]" /> Monthly Dues Management
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage dues, issue bills, and track resident standing</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Due</span>
            <span className="text-sm font-black text-slate-800">₱{monthlyDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            <RequireRole userRole={currentUserRole} allowedRoles={['treasurer','president']}>
              <button onClick={() => { setEditDueValue(String(monthlyDue)); setIsEditDueOpen(true); }}
                title="Edit monthly due"
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#006837] cursor-pointer transition-all">
                <Edit2 size={13} />
              </button>
            </RequireRole>
          </div>
          <button onClick={() => setIsQrModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-[#006837] rounded-xl transition-all cursor-pointer">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="GCash QR" className="w-6 h-6 rounded object-cover border border-slate-200" />
            ) : (
              <QrCode size={16} className="text-slate-400" />
            )}
            <span className="text-xs font-bold text-slate-600">Upload QR Code</span>
          </button>
          <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
            <button onClick={() => setShowSendConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all cursor-pointer">
              <Mail size={13} /> Send SOA to All
            </button>
          </RequireRole>
          {/* View toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
            <button onClick={() => setActiveView('transactions')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${activeView === 'transactions' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutList size={13} /> Transactions
            </button>
            <button onClick={() => setActiveView('paid')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${activeView === 'paid' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <CheckCircle2 size={13} /> Paid
            </button>
            <button onClick={() => setActiveView('standing')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${activeView === 'standing' ? 'bg-white text-[#006837] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <TableProperties size={13} /> Standing Ledger
            </button>
          </div>
        </div>
      </div>

      {/* ── Edit Monthly Due modal (Treasurer/President only) ── */}
      <ModalOverlay
        title="Edit Monthly Due"
        subtitle="This changes the amount used for future dues generation — past invoices already issued are not affected."
        isOpen={isEditDueOpen}
        onClose={() => setIsEditDueOpen(false)}
        actionLabel={savingDue ? 'Saving…' : 'Save'}
        onAction={savingDue ? undefined : handleSaveMonthlyDue}>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1.5 block">New Monthly Due Amount (₱)</label>
          <input type="number" min="1" step="0.01" value={editDueValue} onChange={e => setEditDueValue(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837]"
            placeholder="150.00" />
          <p className="text-xs text-slate-400 mt-2">
            Current: ₱{monthlyDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. The breakdown (Security Guard,
            Electricity, Street Sweepers, Water) will be re-proportioned against the new amount for dues generated from now on.
          </p>
        </div>
      </ModalOverlay>

      {/* ── GCash QR Code modal — view for everyone, upload for Treasurer/President ── */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[10700] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsQrModalOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0">
                    <QrCode size={18} className="text-[#006837]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Upload QR Code</h2>
                    <p className="text-xs text-slate-400">Shown on every printed &amp; emailed Statement of Account</p>
                  </div>
                </div>
                <button onClick={() => setIsQrModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 cursor-pointer"><X size={16} /></button>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center justify-center mb-4 min-h-[180px]">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="GCash payment QR code" className="max-w-full max-h-52 rounded-xl object-contain" />
                ) : (
                  <div className="text-center text-slate-300">
                    <QrCode size={40} className="mx-auto mb-2" />
                    <p className="text-xs font-semibold">No QR code uploaded yet</p>
                  </div>
                )}
              </div>

              <RequireRole userRole={currentUserRole} allowedRoles={['treasurer','president']}>
                <label className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold cursor-pointer transition-all
                  ${uploadingQr ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#006837] hover:bg-[#004d29] text-white shadow-lg shadow-[#006837]/20'}`}>
                  <Upload size={15} />
                  {uploadingQr ? 'Uploading…' : qrCodeUrl ? 'Replace QR Code' : 'Upload QR Code'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingQr}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadQrCode(f); e.target.value = ''; }} />
                </label>
                <p className="text-[10px] text-slate-400 mt-2 text-center">PNG or JPG. Upload the screenshot of your QR code.</p>
              </RequireRole>
            </div>
          </div>
        </div>
      )}

      {/* ── Proof of payment review modal (Treasurer/President only) ── */}
      {proofReviewPayment && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setProofReviewPayment(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Review Proof of Payment</h2>
                  <p className="text-xs text-slate-400">
                    {residentsList.find(r => r.id === proofReviewPayment.user_id)?.full_name || 'Resident'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 mb-4">
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Due Period</span>
                  <span className="text-sm font-bold text-slate-800">
                    {proofReviewPayment.due_date ? new Date(proofReviewPayment.due_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Amount</span>
                  <span className="text-sm font-bold text-slate-800">
                    ₱{Number(proofReviewPayment.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Resident's Ref #</span>
                  <span className="text-sm font-bold text-slate-800">{proofReviewPayment.payer_reference_no || '—'}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-xs font-semibold text-slate-500">Submitted</span>
                  <span className="text-sm font-bold text-slate-800">
                    {proofReviewPayment.submitted_at ? new Date(proofReviewPayment.submitted_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                  </span>
                </div>
                {proofReviewPayment.proof_url && (
                  <div className="p-3">
                    <button onClick={() => { setProofReviewImage(proofReviewPayment.proof_url); setProofReviewZoomed(false); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all">
                      <Eye size={13} /> View Proof of Payment
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-700">
                  Make sure to check the proof of payment — click "View Proof of Payment" above to open the image before approving.
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setProofReviewPayment(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => handleVerifyPayment(proofReviewPayment, 'reject')}
                  disabled={verifyingPaymentId === proofReviewPayment.id}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <XCircle size={15} /> Reject
                </button>
                <button
                  onClick={() => setIsApproveConfirmOpen(true)}
                  disabled={verifyingPaymentId === proofReviewPayment.id}
                  className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <CheckCircle2 size={15} /> {verifyingPaymentId === proofReviewPayment.id ? 'Saving…' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── "Make sure it's finalized" confirmation, gated by a short countdown ── */}
      {isApproveConfirmOpen && proofReviewPayment && (
        <div className="fixed inset-0 z-[10550] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Confirm Approval</h3>
              <p className="text-sm text-slate-500 mb-6">
                Make sure it's finalized — once approved, this payment is marked <span className="font-bold text-slate-700">Paid</span> and can only be changed by editing or voiding the transaction afterward.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsApproveConfirmOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsApproveConfirmOpen(false);
                    handleVerifyPayment(proofReviewPayment, 'approve');
                  }}
                  disabled={approveCountdown > 0 || verifyingPaymentId === proofReviewPayment.id}
                  className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle2 size={15} /> {approveCountdown > 0 ? `Approve (${approveCountdown})` : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Proof of payment lightbox — stays in-app; image is click-to-zoom ──── */}
      {proofReviewImage && (
        <div className="fixed inset-0 z-[10600] flex items-center justify-center p-4"
          onClick={() => { setProofReviewImage(null); setProofReviewZoomed(false); }}>
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
          <div className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col transition-all duration-200
              ${proofReviewZoomed ? 'max-w-5xl max-h-[94vh]' : 'max-w-lg max-h-[85vh]'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-600" /> Proof of Payment
              </p>
              <div className="flex items-center gap-1.5">
                {!/\.pdf($|\?)/i.test(proofReviewImage) && (
                  <button onClick={() => setProofReviewZoomed(z => !z)}
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
                    title={proofReviewZoomed ? 'Zoom out' : 'Zoom in'}>
                    {proofReviewZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                  </button>
                )}
                <button onClick={() => { setProofReviewImage(null); setProofReviewZoomed(false); }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer transition-all">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-4 flex items-center justify-center bg-slate-50 flex-1">
              {/\.pdf($|\?)/i.test(proofReviewImage)
                ? <iframe src={proofReviewImage} title="Proof of payment (PDF)" className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white" />
                : <img src={proofReviewImage} alt="Proof of payment" onClick={() => setProofReviewZoomed(z => !z)}
                    className={`rounded-lg object-contain transition-all duration-200 cursor-zoom-in
                      ${proofReviewZoomed ? 'max-w-none max-h-none w-auto cursor-zoom-out' : 'max-w-full max-h-[65vh]'}`} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Send SOA confirmation modal ── */}
      {showSendConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Mail size={18} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Send SOA to All Residents?</h2>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-5">
              This will email a Statement of Account to every resident who currently has an outstanding balance.
              Residents who are fully settled will not receive an email. This action is logged in the audit trail.
            </p>

            <div className="mb-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">What should the email include?</p>
              <div className="flex gap-2">
                {[
                  { key: 'outstanding', label: 'Outstanding Charges Only' },
                  { key: 'history',     label: 'Past Payment History Only' },
                  { key: 'both',        label: 'Both' },
                ].map(opt => (
                  <button key={opt.key} type="button" onClick={() => setSendSOAViewMode(opt.key)}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer
                      ${sendSOAViewMode === opt.key
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {sendSOAResult && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-semibold ${
                sendSOAResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {sendSOAResult.type === 'success'
                  ? `✓ Sent ${sendSOAResult.sent} email(s)${sendSOAResult.failed ? `, ${sendSOAResult.failed} failed` : ''}.`
                  : `Failed: ${sendSOAResult.error}`}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowSendConfirm(false); setSendSOAResult(null); }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
                Cancel
              </button>
              <button onClick={handleSendAllSOA} disabled={sendingSOA}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {sendingSOA ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</> : <><Mail size={15} /> Send Now</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Per-resident SOA print — content choice modal ── */}
      {/* Portal to <body>, same reason as the Unpaid Breakdown modal above —
          guarantees this overlay is always truly viewport-relative. */}
      {soaPrintTarget && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setSoaPrintTarget(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0">
                <Printer size={18} className="text-[#006837]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Statement of Account</h2>
                <p className="text-xs text-slate-400">{soaPrintTarget.resident.full_name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">What should this statement show?</p>

            <div className="space-y-2 mb-6">
              {[
                { key: 'outstanding', label: 'Outstanding Charges Only', desc: 'Unpaid dues breakdown — newest due shown first.' },
                { key: 'history',     label: 'Past Payment History Only', desc: 'Settled dues, oldest to most recent.' },
                { key: 'both',        label: 'Both', desc: 'Outstanding charges and past payment history together.' },
              ].map(opt => (
                <button key={opt.key} type="button" onClick={() => setSoaPrintChoice(opt.key)}
                  className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer
                    ${soaPrintChoice === opt.key ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className={`text-sm font-bold ${soaPrintChoice === opt.key ? 'text-[#006837]' : 'text-slate-700'}`}>{opt.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSoaPrintTarget(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold cursor-pointer transition-all">
                Cancel
              </button>
              <button
                onClick={() => {
                  printSOA(soaPrintTarget.resident, soaPrintTarget.paidHistory, soaPrintChoice, monthlyDue, qrCodeUrl);
                  setSoaPrintTarget(null);
                }}
                className="flex-1 py-3 bg-[#006837] hover:bg-[#004d29] text-white rounded-2xl font-bold shadow-lg shadow-[#006837]/20 cursor-pointer transition-all flex items-center justify-center gap-2">
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── KPI cards ── */}
      <div className="flex flex-wrap gap-4">
        <StatCard title="Total Collected"  value={`₱${totalCollected.toLocaleString()}`} icon={DollarSign}  iconColor="text-[#006837]" bgColor="bg-[#006837]/10" />
        <StatCard title="Pending Payments" value={pendingCount}                           icon={CreditCard}  iconColor="text-blue-600"  bgColor="bg-blue-50"       />
        <StatCard title="Overdue"          value={overdueCount}                           icon={AlertCircle} iconColor="text-red-600"   bgColor="bg-red-50"        />
        <StatCard title="Paid This Month"  value={paidCount}                              icon={CheckCircle2}iconColor="text-emerald-600"bgColor="bg-emerald-50"    />
      </div>

      {/* ── Standing Ledger view ── */}
      {activeView === 'standing' && (
        <StandingLedger residentsList={residentsList} payments={payments} monthlyDue={monthlyDue} />
      )}

      {/* ── Paid view — one row per resident who has at least one paid due ── */}
      {activeView === 'paid' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px] flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Search resident…" value={paidSearchTerm}
                  onChange={e => setPaidSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
              </div>
              <ResidentFilterSelect
                value={paidResidentFilter}
                onChange={setPaidResidentFilter}
                options={residentsList.map(r => ({ value: r.id, label: r.full_name }))}
                className="w-40"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Name','Street','Total Paid','Months Paid','Last Payment','Standing'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPaid.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-300 text-sm">No paid records found</td></tr>
                ) : paginatedPaid.map(r => (
                  <tr key={r.user_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${r.stillUnpaid === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="text-sm font-bold text-slate-800">{r.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 max-w-[180px] truncate">{r.street}</td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-black text-emerald-600">
                        ₱{r.totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                      {r.paidMonths} month{r.paidMonths !== 1 ? 's' : ''}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {r.lastPaid ? new Date(r.lastPaid).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.stillUnpaid === 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Fully Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Has Unpaid
                          </span>
                        )}
                        {r.hasAdvancePayment && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Paid in Advance
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPaid.length > 0 && (
            <>
              <PaginationBar page={paidPage} totalPages={paidTotalPages} setPage={setPaidPage} total={filteredPaid.length} rowsPerPage={10} />
              <div className="px-5 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">{filteredPaid.length} resident{filteredPaid.length !== 1 ? 's' : ''} with paid records</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Transactions view ── */}
      {activeView === 'transactions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px] flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Search payments…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 focus:border-[#006837] transition-all" />
              </div>
              <ResidentFilterSelect
                value={residentFilter}
                onChange={setResidentFilter}
                options={residentsList.map(r => ({ value: r.id, label: r.full_name }))}
                className="w-40"
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#006837]/20 cursor-pointer">
                <option value="All">All Status</option>
                <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                  <option value="PendingVerification">Pending Verification</option>
                </RequireRole>
                <option value="Pending">On Pending</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Unpaid">Unpaid</option>
                <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                  <option value="Advance">Paid in Advance</option>
                </RequireRole>
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {advancePendingResidents.length > 0 && (
                <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                  <button
                    onClick={() => setProofReviewPayment(advancePendingResidents[0].pendingAdvanceVerification)}
                    className="relative flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold rounded-xl transition-all cursor-pointer">
                    <AlertCircle size={13} />
                    Advance Payment{advancePendingResidents.length !== 1 ? 's' : ''} to Verify
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-purple-600 text-white text-[10px] font-black rounded-full">
                      {advancePendingResidents.length}
                    </span>
                  </button>
                </RequireRole>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Name','Street','Unpaid Balance','Due Period','Status',''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {consolidatedPayments.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-300 text-sm">No residents found</td></tr>
                ) : paginatedPayments.map(r => {
                  const hasBalance = r.balance > 0;
                  return (
                    <tr key={r.user_id}
                      className={`hover:bg-slate-50/60 transition-colors ${hasBalance ? 'bg-red-50/30' : ''}`}>

                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${hasBalance ? 'bg-red-400' : 'bg-emerald-400'}`} />
                          <span className="text-sm font-bold text-slate-800">{r.full_name}</span>
                          {r.isDuplicate && <DuplicateBadge />}
                        </div>
                      </td>

                      {/* Street */}
                      <td className="px-5 py-4 text-sm text-slate-500 max-w-[180px] truncate">{r.street}</td>

                      {/* Unpaid Balance — ₱0.00 when settled */}
                      <td className="px-5 py-4">
                        {hasBalance ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-red-600">
                              ₱{r.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-red-400 font-semibold">
                              {r.months} month{r.months !== 1 ? 's' : ''} unpaid
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-emerald-600">₱0.00</span>
                            <span className="text-[10px] text-emerald-500 font-semibold">Settled</span>
                          </div>
                        )}
                      </td>

                      {/* Due Period */}
                      <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                        {hasBalance && r.oldest && r.newest
                          ? r.oldest === r.newest
                            ? new Date(r.oldest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                            : `${new Date(r.oldest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${new Date(r.newest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                          : '—'}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4">
                        {r.pendingVerification ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            Pending Verification
                          </span>
                        ) : hasBalance ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Unpaid Balance
                          </span>
                        ) : r.standing === 'Settled' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            No Record
                          </span>
                        )}
                      </td>

                      {/* Actions — Pay/Edit when balance exists, Statement always available */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const paidHistory = payments
                                .filter(p => p.user_id === r.user_id && (p.status || '').toLowerCase() === 'paid')
                                .sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0));
                              setSoaPrintChoice('outstanding');
                              setSoaPrintTarget({ resident: r, paidHistory });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[#006837] hover:text-[#006837] text-slate-500 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                            title="Print Statement of Account">
                            <Printer size={12} /> SOA
                          </button>
                          {r.pendingVerification && (
                            <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                              <button
                                onClick={() => setProofReviewPayment(r.pendingVerification)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap">
                                <Eye size={12} /> Review Proof
                              </button>
                            </RequireRole>
                          )}
                          <RequireRole userRole={currentUserRole} allowedRoles={['treasurer']}>
                            <button
                              onClick={async () => {
                                let anchorList = r.unpaidList.length ? r.unpaidList : r.allPayments;
                                // Brand-new account with zero payment rows at all ("No Record") —
                                // generate Jan→current-month dues on the fly so there's something
                                // to review, instead of the button doing nothing.
                                if (r.standing === 'No Record') {
                                  anchorList = await backfillPastDuesForResident(r.user_id);
                                  fetchPayments();
                                }
                                setBreakdownPayments(anchorList.map(p => ({
                                  ...p,
                                  profiles: payments.find(x => x.id === p.id)?.profiles
                                    ?? residentsList.find(res => res.id === r.user_id) ?? null,
                                })));
                                setIsUnpaidBreakdownOpen(true);
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                                hasBalance
                                  ? 'bg-[#006837] hover:bg-[#004d29] text-white'
                                  : 'bg-white border border-slate-200 hover:border-[#006837] hover:text-[#006837] text-slate-500'
                              }`}>
                              <Eye size={12} /> View Detail
                            </button>
                          </RequireRole>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {consolidatedPayments.length > 0 && (
            <>
              <PaginationBar page={transPage} totalPages={transTotalPages} setPage={setTransPage} total={consolidatedPayments.length} rowsPerPage={10} />
              <div className="px-5 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">{consolidatedPayments.length} resident{consolidatedPayments.length !== 1 ? 's' : ''}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Payment;