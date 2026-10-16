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
// in tab 2 would silently hijack tab 1's session too. sessionStorage is
// scoped to one tab, so each tab now keeps its own independent session.
// Trade-off: a session no longer survives closing and reopening the tab —
// acceptable here since this is an admin panel, not something residents
// expect to stay logged into indefinitely.
//
// auth.storageKey: also needs to be unique PER TAB, not just the storage
// backend. Supabase's auth client uses storageKey as the name of a
// BroadcastChannel it opens to sync sign-in/sign-out/token-refresh events
// across every tab on the same origin — this is separate from, and happens
// regardless of, whether the session itself is in localStorage or
// sessionStorage. With the default (same) storageKey in every tab, signing
// out in tab 1 broadcasts a SIGNED_OUT event that every other tab receives
// and reacts to — logging them out too, even when they're different
// accounts. Giving each tab a random id (cached in sessionStorage, so it's
// stable across refreshes but unique per tab) gives each tab its own
// BroadcastChannel name, so tabs stop hearing each other's auth events.
function getTabScopedStorageKey() {
  const TAB_ID_KEY = 'sb-tab-id';
  let tabId = window.sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    window.sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return `sb-chateau-auth-${tabId}`;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
    storageKey: getTabScopedStorageKey(),
    persistSession: true,
    autoRefreshToken: true,
  },
});