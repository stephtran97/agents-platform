import type {
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ModelDescriptor
} from '@agents-platform/contracts';
import type { LlmProvider } from './llm-provider.js';

type HttpProviderOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
  timeoutMs?: number;
  provider: string;
  /** Ignore the model named in requests (callers may send a placeholder like `mock-chat`). */
  forceModel?: boolean;
  /** Ignore the embedding model named in requests (callers send an OpenAI model name). */
  forceEmbeddingModel?: boolean;
  /** Ask the upstream for vectors of this size (OpenAI text-embedding-3-* supports it). */
  embeddingDimensions?: number;
};

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(private readonly options: HttpProviderOptions) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: {
          ...(this.options.provider === 'azure-openai'
            ? { 'api-key': this.options.apiKey }
            : this.options.apiKey
              ? { authorization: `Bearer ${this.options.apiKey}` }
              : {}),
          'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('MODEL_UNAVAILABLE');
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw new Error('MODEL_TIMEOUT', { cause: error });
      throw error instanceof Error && error.message === 'MODEL_UNAVAILABLE'
        ? error
        : new Error('MODEL_UNAVAILABLE', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = this.options.forceModel
      ? this.options.model
      : request.model || this.options.model;
    const raw = await this.post<{
      model?: string;
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }>('/chat/completions', {
      model,
      messages: request.messages,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
      ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
    });
    const choice = raw.choices?.[0];
    if (!choice?.message) throw new Error('MODEL_UNAVAILABLE');
    const finish = choice.finish_reason;
    return {
      model: raw.model ?? model,
      message: { role: 'assistant', content: choice.message.content ?? '' },
      finishReason:
        finish === 'stop' || finish === 'length' || finish === 'tool_calls' ? finish : 'other',
      usage: {
        promptTokens: raw.usage?.prompt_tokens ?? 0,
        completionTokens: raw.usage?.completion_tokens ?? 0,
        totalTokens: raw.usage?.total_tokens ?? 0
      }
    };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = this.options.forceEmbeddingModel
      ? this.options.embeddingModel
      : request.model || this.options.embeddingModel;
    const raw = await this.post<{
      model?: string;
      data?: { embedding: number[] }[];
      usage?: { prompt_tokens?: number };
    }>('/embeddings', {
      model,
      input: request.input,
      ...(this.options.embeddingDimensions ? { dimensions: this.options.embeddingDimensions } : {})
    });
    if (!raw.data) throw new Error('MODEL_UNAVAILABLE');
    return {
      model: raw.model ?? model,
      embeddings: raw.data.map((item) => item.embedding),
      ...(raw.usage?.prompt_tokens !== undefined
        ? { usage: { promptTokens: raw.usage.prompt_tokens } }
        : {})
    };
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return [
      {
        id: this.options.model,
        provider: this.options.provider,
        capabilities: ['completion', 'streaming', 'tools']
      }
    ];
  }
}
