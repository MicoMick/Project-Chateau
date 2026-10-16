import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Privileged operations (creating admins, resetting resident passwords, etc.)
// run server-side in Supabase Edge Functions instead of here — the service
// role / secret key must never be shipped to the browser.
//
// auth.storage: sessionStorage instead of the default localStorage — this is
// what keeps separate logins in separate tabs actually separate. localStorage
// is shared by every tab on the same origin, so logging into a second account
// in tab 2 would silently hijack tab 1's session too (Supabase's auth client
// listens for storage changes across tabs by design, for the normal "one
// account, many tabs" case — but that's exactly wrong for "two different
// officers testing two different roles side by side"). sessionStorage is
// scoped to one tab, so each tab now keeps its own independent session.
// Trade-off: a session no longer survives closing and reopening the tab —
// acceptable here since this is an admin panel, not something residents
// expect to stay logged into indefinitely.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});