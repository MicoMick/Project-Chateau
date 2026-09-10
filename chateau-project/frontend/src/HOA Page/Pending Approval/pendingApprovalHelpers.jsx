import React from 'react';
import { Trash2, FileEdit } from 'lucide-react';

// Shared between PendingApproval.jsx (table row badges) and
// RequestDetailModal.jsx (the "View Details" modal), so both always agree on
// how an action type / target table is labeled and colored.
export const actionIcon = (type = '') => {
  switch (type.toUpperCase()) {
    case 'DELETE': return <Trash2   size={14} className="text-red-500"    />;
    case 'UPDATE': return <FileEdit size={14} className="text-blue-500"   />;
    default:       return <FileEdit size={14} className="text-slate-400"  />;
  }
};

export const actionColor = (type = '') => {
  switch (type.toUpperCase()) {
    case 'DELETE': return 'bg-red-50 text-red-700 border-red-100';
    case 'UPDATE': return 'bg-blue-50 text-blue-700 border-blue-100';
    default:       return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export const tableColor = (table = '') => {
  switch (table.toLowerCase()) {
    case 'payments':  return 'bg-emerald-50 text-emerald-700';
    case 'profiles':  return 'bg-indigo-50 text-indigo-700';
    default:          return 'bg-slate-100 text-slate-600';
  }
};
