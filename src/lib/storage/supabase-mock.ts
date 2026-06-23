/** Supabase mock — persists to localStorage in the browser */

export interface ForgeSession {
  id: string;
  goal: string;
  createdAt: string;
  outputs?: Record<string, unknown>;
}

const STORAGE_KEY = "aetherforge_sessions";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getSessions(): ForgeSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ForgeSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: ForgeSession): void {
  if (!isBrowser()) return;
  const sessions = getSessions();
  sessions.unshift(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
}

export function clearSessions(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}