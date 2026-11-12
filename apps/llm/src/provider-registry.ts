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
      timeoutMs: config.timeoutMs
    });
  }
  throw new Error('MODEL_UNAVAILABLE');
}
