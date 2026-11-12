import { describe, expect, it } from 'vitest';
import { createAgentRuntime } from './runtime-registry.js';
import { BasicRagRuntime } from './runtimes/basic-rag-runtime.js';

const deps = {
  vectorStore: { search: async () => [] },
  llm: {
    complete: async () => {
      throw new Error('unused');
    }
  }
};

describe('createAgentRuntime', () => {
  it('selects basic-rag by name, with no source edit needed to switch runtimes', () => {
    expect(createAgentRuntime('basic-rag', deps)).toBeInstanceOf(BasicRagRuntime);
  });

  it('fails fast for an unknown runtime name', () => {
    expect(() => createAgentRuntime('nope', deps)).toThrow('AGENT_RUNTIME_UNAVAILABLE');
  });
});
