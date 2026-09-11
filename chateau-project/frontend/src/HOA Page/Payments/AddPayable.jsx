import React, { useState } from 'react';
import { supabase } from '../supabaseAdmin';
import { logAudit } from '../auditLogger';
import { X } from 'lucide-react';

const AddPayable = ({ isOpen, onClose, onPayableAdded }) => {
  const [description, setDescription] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('payables')
        .insert([{
          description,
          payee,
          amount: parseFloat(amount),
          due_date: dueDate,
          status: 'pending', // Important: Auditor only sees 'pending' items
          created_by: user.id
        }]);

      if (error) throw error;

      await logAudit('ADD_PAYABLE', `Recorded payable: ${description} — ₱${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} owed to ${payee}, due ${dueDate}.`);

      // Reset form
      setDescription('');
      setPayee('');
      setAmount('');
      setDueDate('');
      
      onPayableAdded();
      onClose();
    } catch (err) {
      alert("Error adding payable: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Add New Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Description</label>
            <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-4 py-2 mt-1" placeholder="e.g., Streetlight Repair" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">Payee (Vendor)</label>
            <input type="text" required value={payee} onChange={(e) => setPayee(e.target.value)} className="w-full border rounded-lg px-4 py-2 mt-1" placeholder="e.g., Meralco" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">Amount</label>
            <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded-lg px-4 py-2 mt-1" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">Due Date</label>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border rounded-lg px-4 py-2 mt-1" />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-2 bg-[#006837] text-white rounded-lg font-bold hover:bg-[#004d29] mt-4"
          >
            {isSubmitting ? 'Saving...' : 'Add Expense'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddPayable;