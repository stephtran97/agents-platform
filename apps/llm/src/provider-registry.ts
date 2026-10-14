import type { LlmProvider } from './providers/llm-provider.js';
import { MockProvider } from './providers/mock-provider.js';
export type LlmConfig = { provider: string };
export function createLlmProvider(config: LlmConfig): LlmProvider { if (config.provider === 'mock') return new MockProvider(); throw new Error('MODEL_UNAVAILABLE'); }
