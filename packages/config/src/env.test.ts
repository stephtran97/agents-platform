import { describe, expect, it } from 'vitest';
import { loadConfig } from './index.js';

const requiredEnv = {
  DATABASE_URL: 'postgres://agents:agents@localhost:5432/agents',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'agents-documents',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
};

describe('loadConfig', () => {
  it('uses local tenant, basic RAG, and mock defaults', () => {
    expect(loadConfig(requiredEnv)).toMatchObject({
      tenantId: 'local-tenant',
      agentRuntime: 'basic-rag',
      llmProvider: 'mock',
    });
  });

  it('validates service URLs', () => {
    expect(() => loadConfig({ ...requiredEnv, AGENT_URL: 'not a URL' })).toThrow();
  });

  it('rejects a missing secret when a real provider is selected', () => {
    expect(() => loadConfig({ ...requiredEnv, LLM_PROVIDER: 'openai' })).toThrow(/secret/i);
  });

  it('accepts a real provider with a secret', () => {
    expect(loadConfig({ ...requiredEnv, LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'key' }).llmProvider).toBe('openai');
  });

  it('requires database and object storage settings', () => {
    for (const key of Object.keys(requiredEnv)) {
      const env = { ...requiredEnv };
      delete (env as Record<string, string>)[key];
      expect(() => loadConfig(env)).toThrow();
    }
  });

  it('rejects whitespace-only provider secrets', () => {
    expect(() => loadConfig({ ...requiredEnv, LLM_PROVIDER: 'openai', OPENAI_API_KEY: '  ' })).toThrow(/secret/i);
  });
});
