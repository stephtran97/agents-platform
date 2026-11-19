import type { LlmProvider } from './providers/llm-provider.js';
import { MockProvider } from './providers/mock-provider.js';
import { OpenAiCompatibleProvider } from './providers/http-provider.js';
export type LlmConfig = {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  timeoutMs?: number;
};
/** Must match EMBEDDING_DIMENSION in @agents-platform/domain (the pgvector column size). */
const EMBEDDING_DIMENSIONS = 768;

export function createLlmProvider(config: LlmConfig): LlmProvider {
  if (config.provider === 'mock') return new MockProvider();
  if (config.provider === 'openai' || config.provider === 'azure-openai') {
    if (!config.apiKey || !config.baseUrl) throw new Error('MODEL_CONFIGURATION_INVALID');
    return new OpenAiCompatibleProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model ?? 'gpt-4o-mini',
      embeddingModel: config.embeddingModel ?? 'text-embedding-3-small',
      timeoutMs: config.timeoutMs,
      embeddingDimensions: EMBEDDING_DIMENSIONS
    });
  }
  if (config.provider === 'ollama') {
    // Ollama serves an OpenAI-compatible API and needs no key. Chat and embeddings both
    // use the local server; callers send OpenAI model names, so the configured models win.
    // The default embedding model (nomic-embed-text) produces 768-dimensional vectors.
    return new OpenAiCompatibleProvider({
      provider: 'ollama',
      apiKey: '',
      baseUrl: config.baseUrl ?? 'http://localhost:11434/v1',
      model: config.model ?? 'qwen3:4b',
      embeddingModel: config.embeddingModel ?? 'nomic-embed-text',
      timeoutMs: config.timeoutMs,
      forceModel: true,
      forceEmbeddingModel: true
    });
  }
  throw new Error('MODEL_UNAVAILABLE');
}
