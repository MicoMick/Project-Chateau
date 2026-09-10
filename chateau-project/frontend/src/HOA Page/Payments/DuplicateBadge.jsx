import React from 'react';
import { AlertCircle } from 'lucide-react';

// Shown next to a resident's name when another profile row shares the exact
// same normalized name (see buildNameCounts/normalizeName in paymentUtils) —
// likely a duplicate account for the same person.
const DuplicateBadge = () => (
  <span
    title="Another resident profile has this same name — likely a duplicate account for the same person."
    className="inline-flex items-center gap-1 shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
    <AlertCircle size={9} /> Possible Duplicate
  </span>
);

export default DuplicateBadge;
