import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('UI class composition', () => {
  it('keeps caller spacing overrides and conditional classes', () => {
    expect(cn('p-5', false && 'hidden', 'p-6')).toBe('p-6');
    expect(cn('text-sm', { 'font-bold': true })).toContain('font-bold');
  });
});
