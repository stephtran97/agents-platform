import { describe, expect, it } from 'vitest';
import { createLlmProvider } from './provider-registry.js';

describe('createLlmProvider', () => {
  it('creates the mock provider', () => {
    expect(createLlmProvider({ provider: 'mock' }).constructor.name).toBe('MockProvider');
  });
  it('rejects unknown providers', () => {
    expect(() => createLlmProvider({ provider: 'unknown' })).toThrow('MODEL_UNAVAILABLE');
  });
});
