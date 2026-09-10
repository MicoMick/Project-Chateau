// Shared between Announcements.jsx (row category badge) and
// AnnouncementDetailModal.jsx (the "View Details" modal), so both agree on
// how a category is colored.
export const getCategoryColor = (cat) => {
  switch (cat?.toLowerCase()) {
    case 'general': case 'financial': return 'bg-[#006837]/10 text-[#006837]';
    case 'event':       return 'bg-blue-50 text-blue-700';
    case 'maintenance': return 'bg-amber-50 text-amber-700';
    case 'election':    return 'bg-red-50 text-red-600';
    case 'security':    return 'bg-slate-100 text-slate-600';
    default:            return 'bg-slate-100 text-slate-600';
  }
};
