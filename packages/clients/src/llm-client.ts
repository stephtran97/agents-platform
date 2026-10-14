import type { CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, ModelDescriptor } from '@agents-platform/contracts';
export class LlmClient {
  constructor(private readonly baseUrl: string) {}
  private async post<T>(path: string, body: unknown): Promise<T> { const response = await fetch(`${this.baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (!response.ok) throw new Error('MODEL_UNAVAILABLE'); return response.json() as Promise<T>; }
  complete(request: CompletionRequest): Promise<CompletionResponse> { return this.post('/v1/completions', request); }
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse> { return this.post('/v1/embeddings', request); }
  async listModels(): Promise<ModelDescriptor[]> { const response = await fetch(`${this.baseUrl}/v1/models`); if (!response.ok) throw new Error('MODEL_UNAVAILABLE'); return response.json() as Promise<ModelDescriptor[]>; }
}
