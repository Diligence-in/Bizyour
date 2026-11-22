import type { Mode } from '../components/shell/nav';

// Workspace | Business Mart. The side you are on is read from the URL
// (anything under /mart is Mart), so it can never disagree with the screen.
// We remember the last screen on each side so the switch returns you there.
export const modeOf = (path: string): Mode => (path === '/mart' || path.startsWith('/mart/') ? 'mart' : 'workspace');

const KEY = { workspace: 'bos_last_ws', mart: 'bos_last_mart' } as const;
const home = { workspace: '/', mart: '/mart' } as const;

export function rememberPath(path: string) {
  try { localStorage.setItem(KEY[modeOf(path)], path); } catch { /* storage may be off */ }
}
export function lastPath(m: Mode) {
  try { const p = localStorage.getItem(KEY[m]); if (p && modeOf(p) === m) return p; } catch { /* ignore */ }
  return home[m];
}

// After a fresh login or a new signup we show the side-by-side chooser once.
const PICK = 'bos_pick';
export const askToPick = () => { try { sessionStorage.setItem(PICK, '1'); } catch { /* ignore */ } };
export const shouldPick = () => { try { return sessionStorage.getItem(PICK) === '1'; } catch { return false; } };
export const picked = () => { try { sessionStorage.removeItem(PICK); } catch { /* ignore */ } };
