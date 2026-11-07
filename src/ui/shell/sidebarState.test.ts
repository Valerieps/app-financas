import { describe, expect, it } from 'vitest';
import { clampSidebarWidth, DEFAULT_SIDEBAR, parseSidebarState, SIDEBAR_MAX, SIDEBAR_MIN } from './sidebarState';

describe('clampSidebarWidth', () => {
  it('keeps the width between the minimum and the maximum', () => {
    expect(clampSidebarWidth(10)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX);
    expect(clampSidebarWidth(300.4)).toBe(300);
    expect(clampSidebarWidth(Number.NaN)).toBe(DEFAULT_SIDEBAR.width);
  });
});

describe('parseSidebarState', () => {
  it('reads a saved state and clamps its width', () => {
    expect(parseSidebarState('{"width":320,"collapsed":true}')).toEqual({ width: 320, collapsed: true });
    expect(parseSidebarState('{"width":5000}')).toEqual({ width: SIDEBAR_MAX, collapsed: false });
  });

  it('falls back to the default on nothing or garbage', () => {
    expect(parseSidebarState(null)).toEqual(DEFAULT_SIDEBAR);
    expect(parseSidebarState('not json')).toEqual(DEFAULT_SIDEBAR);
    expect(parseSidebarState('null')).toEqual(DEFAULT_SIDEBAR);
  });
});
