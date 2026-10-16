import { supabase } from './supabaseAdmin';

const writeLog = async (activity, details, severity = 'info') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const role = (sessionStorage.getItem('userRole') || 'unknown').toUpperCase();
    await supabase.from('system_logs').insert({
      user_email: user?.email || 'unknown',
      activity,
      severity,
      details: `[${role}] ${details}`,
    });
  } catch (err) {
    console.warn('[auditLogger] Failed to write log:', err?.message);
  }
};

// Named export — used by most pages
export const logAudit = writeLog;

// Default export — used by ElectionPage (logger.info / logger.error)
const logger = {
  info:    (activity, meta = {}) => writeLog(activity, JSON.stringify(meta), 'info'),
  warn:    (activity, meta = {}) => writeLog(activity, JSON.stringify(meta), 'warning'),
  warning: (activity, meta = {}) => writeLog(activity, JSON.stringify(meta), 'warning'),
  error:   (activity, meta = {}) => writeLog(activity, JSON.stringify(meta), 'danger'),
  danger:  (activity, meta = {}) => writeLog(activity, JSON.stringify(meta), 'danger'),
};

export default logger;
