// The sidebar's width and collapsed state, remembered on this device only (a layout preference,
// not financial data).
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 400;
export const SIDEBAR_DEFAULT = 240;
export const SIDEBAR_STEP = 16;

export type SidebarState = { width: number; collapsed: boolean };

export const DEFAULT_SIDEBAR: SidebarState = { width: SIDEBAR_DEFAULT, collapsed: false };

const KEY = 'sinal-verde:sidebar';

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT;
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)));
}

export function parseSidebarState(raw: string | null): SidebarState {
  if (!raw) return DEFAULT_SIDEBAR;
  try {
    const value = JSON.parse(raw) as Partial<SidebarState> | null;
    return {
      width: typeof value?.width === 'number' ? clampSidebarWidth(value.width) : SIDEBAR_DEFAULT,
      collapsed: value?.collapsed === true,
    };
  } catch {
    return DEFAULT_SIDEBAR;
  }
}

export function loadSidebarState(): SidebarState {
  try {
    return parseSidebarState(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_SIDEBAR;
  }
}

export function saveSidebarState(state: SidebarState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the preference lasts until the page closes.
  }
}
