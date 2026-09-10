// ─── Shared Payment helpers ──────────────────────────────────────────────────
// Split out of Payment.jsx so it and its extracted modals (SOAPrintModal,
// MonthlyDueDetailsModal, printSOA) always agree on how a month's due amount
// and coverage are computed — duplicating this logic per-file risks the
// numbers silently drifting apart between the table, the modals, and the
// printed statement.

export const MONTHLY_DUE_DEFAULT = 150; // fallback used only until /hoa_settings has loaded

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

// Builds the per-resident breakdown for one month's bill, given the current
// monthly due amount (configurable by Treasurer/President — see hoa_settings).
// Each resident's due is divided proportionally across the 4 categories,
// so the SOA can show exactly what portion of their due funds what.
export const buildLineItemBreakdown = (monthlyDueAmount = MONTHLY_DUE_DEFAULT) => {
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

// Returns today's date as YYYY-MM-DD in the device's local timezone.
// Using toISOString() would return UTC, which is 8 hours behind PHT and shows
// the wrong date late at night (e.g. 06/07 instead of 06/08 at 1 AM PHT).
export const localToday = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// A resident can submit one proof-of-payment that covers more than one
// month at once (e.g. ₱300 against a ₱150 due = paying 2 months ahead in a
// single submission) — the row's own "amount" is what carries that, since
// there's no separate row per advance month. Round to the nearest whole
// month so tiny rounding differences in the per-category breakdown don't
// misclassify a normal single-month due as a "2 months" one.
export const monthsCoveredBy = (amount, monthlyDue) =>
  Math.max(1, Math.round(Number(amount || 0) / (monthlyDue || 1)));

// A row's due_date is the LAST month it covers — an advance payment of N
// months rolls the (N-1) preceding months into this same row instead of
// getting rows of their own, so the label needs to span back from due_date.
export const formatMonthCoverage = (dueDate, months) => {
  if (!dueDate) return '—';
  const end = new Date(dueDate);
  if (months <= 1) return end.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString('en-US', sameYear ? { month: 'short' } : { month: 'short', year: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${startLabel} to ${endLabel}`;
};

// ─── Address label helper ──────────────────────────────────────────────────
// Block/Lot values in the DB sometimes already include the word "Blk"/"Lot"
// (e.g. "Blk 55") and sometimes don't (e.g. "55"). This strips any existing
// label before re-prefixing, so we never get "Blk Blk 55".
export const stripLabel = (val, label) => {
  if (!val) return '';
  const re = new RegExp(`^${label}\\.?\\s*`, 'i');
  return String(val).replace(re, '').trim();
};

export const buildFullAddress = (block, lot, street) => {
  const parts = [];
  const b = stripLabel(block, 'blk|block');
  const l = stripLabel(lot, 'lot');
  if (b) parts.push(`Blk ${b}`);
  if (l) parts.push(`Lot ${l}`);
  if (street) parts.push(street);
  return parts.join(', ') || 'N/A';
};

// ── Duplicate-name detection ──────────────────────────────────────────────
// No signup flow in this app checks for an existing profile before creating
// a new one (registration happens outside this codebase, via Supabase Auth),
// so the same person can end up with two separate `profiles` rows — each then
// billed its own monthly dues. Flags matching names so Treasurer/President
// catch it here rather than paying/tracking two accounts for one resident.
export const normalizeName = (name) => (name || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
export const buildNameCounts = (list) => list.reduce((acc, r) => {
  const key = normalizeName(r.full_name);
  if (key) acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
