// The shell's keyboard: Ctrl+K (Cmd+K) opens search, Esc closes the topmost layer.
export type KeyAction = 'open-search' | 'close-search' | 'close-panel' | null;

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

export function keyAction(event: KeyInput, state: { searchOpen: boolean; panelOpen: boolean }): KeyAction {
  if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) return state.searchOpen ? null : 'open-search';
  if (event.key !== 'Escape') return null;
  if (state.searchOpen) return 'close-search';
  if (state.panelOpen) return 'close-panel';
  return null;
}
