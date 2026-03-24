import { describe, it, expect } from 'vitest';
import { createErrorMapper } from '../index.js';

describe('createErrorMapper', () => {
  it('maps known Python errors', () => {
    const mapper = createErrorMapper();
    const result = mapper.map('FileNotFoundError: /path/to/file');
    expect(result.message).toContain('file could not be found');
    expect(result.original).toContain('FileNotFoundError');
  });

  it('maps worker timeout errors', () => {
    const mapper = createErrorMapper();
    const result = mapper.map('Worker timed out after 300000ms');
    expect(result.message).toContain('took too long');
  });

  it('maps unknown errors to generic message', () => {
    const mapper = createErrorMapper();
    const result = mapper.map('SomeRandomError: blah');
    expect(result.message).toContain('unexpected error');
    expect(result.original).toBe('SomeRandomError: blah');
  });

  it('supports custom mappings', () => {
    const mapper = createErrorMapper([
      { pattern: 'CustomError', message: 'Custom happened', suggestion: 'Do X' },
    ]);
    const result = mapper.map('CustomError: details');
    expect(result.message).toBe('Custom happened');
    expect(result.suggestion).toBe('Do X');
  });
});
