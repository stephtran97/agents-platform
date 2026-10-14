import type { CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, ModelDescriptor } from '@agents-platform/contracts';

export interface LlmProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  listModels(): Promise<ModelDescriptor[]>;
}
