import { describe, expect, it } from 'vitest';
import { keyAction } from './keys';

const key = (k: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}) => ({ key: k, ctrlKey: false, metaKey: false, ...mods });
const closed = { searchOpen: false, panelOpen: false };

describe('keyAction', () => {
  it('opens search with Ctrl+K or Cmd+K', () => {
    expect(keyAction(key('k', { ctrlKey: true }), closed)).toBe('open-search');
    expect(keyAction(key('K', { metaKey: true }), closed)).toBe('open-search');
    expect(keyAction(key('k'), closed)).toBeNull();
  });

  it('closes the topmost layer with Esc: search first, then the panel', () => {
    expect(keyAction(key('Escape'), { searchOpen: true, panelOpen: true })).toBe('close-search');
    expect(keyAction(key('Escape'), { searchOpen: false, panelOpen: true })).toBe('close-panel');
    expect(keyAction(key('Escape'), closed)).toBeNull();
  });
});
