import React from 'react';
import { fmtCurrency, fmtDate, PaginationBar } from './auditorHelpers';

/**
 * ExpensesTab — itemized HOA expenses.
 *
 * Props:
 *  - pagination: the expensesPag object from usePagination
 *  - expensesTotal: total ₱ expenses (post date/search filter) — footer total
 */
const ExpensesTab = ({ pagination, expensesTotal }) => (
  <>
    <table className="w-full text-left">
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr>{['Date','Description','Category','Amount'].map(h => (
          <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
        ))}</tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {pagination.paginated.map(e => (
          <tr key={e.id} className="hover:bg-red-50/30 transition-colors">
            <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
            <td className="px-5 py-4 text-sm font-bold text-slate-800">{e.description}</td>
            <td className="px-5 py-4">
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{e.category}</span>
            </td>
            <td className="px-5 py-4 text-sm font-black text-red-600">{fmtCurrency(e.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-red-50 border-t-2 border-red-100">
        <tr>
          <td colSpan={3} className="px-5 py-3 text-xs font-black text-slate-600 text-right">Total Expenses:</td>
          <td className="px-5 py-3 text-sm font-black text-red-600">{fmtCurrency(expensesTotal)}</td>
        </tr>
      </tfoot>
    </table>
    <PaginationBar page={pagination.page} totalPages={pagination.totalPages} setPage={pagination.setPage} total={pagination.total} perPage={6} />
  </>
);

export default ExpensesTab;
