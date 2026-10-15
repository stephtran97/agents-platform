import type { CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, ModelDescriptor } from '@agents-platform/contracts';
import type { LlmProvider } from './llm-provider.js';

type HttpProviderOptions = { baseUrl: string; apiKey: string; model: string; embeddingModel: string; timeoutMs?: number; provider: string };

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(private readonly options: HttpProviderOptions) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('MODEL_UNAVAILABLE');
      return await response.json() as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('MODEL_TIMEOUT');
      throw error instanceof Error && error.message === 'MODEL_UNAVAILABLE' ? error : new Error('MODEL_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  complete(request: CompletionRequest): Promise<CompletionResponse> {
    return this.post('/chat/completions', { ...request, model: request.model || this.options.model });
  }

  embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.post('/embeddings', { ...request, model: request.model || this.options.embeddingModel });
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return [{ id: this.options.model, provider: this.options.provider, capabilities: ['completion', 'streaming', 'tools'] }];
  }
}
