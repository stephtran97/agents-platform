import type {
  CompletionRequest,
  EmbeddingRequest,
  CompletionResponse,
  EmbeddingResponse,
  ModelDescriptor
} from '@agents-platform/contracts';
import type { LlmProvider } from './llm-provider.js';

export class MockProvider implements LlmProvider {
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const content = request.messages.at(-1)?.content ?? '';
    return {
      model: request.model,
      message: { role: 'assistant', content: `Mock answer: ${content}` },
      finishReason: 'stop',
      usage: {
        promptTokens: content.length,
        completionTokens: content.length,
        totalTokens: content.length * 2
      }
    };
  }
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const values = Array.isArray(request.input) ? request.input : [request.input];
    return {
      model: request.model,
      embeddings: values.map((value) =>
        Array.from(
          { length: 768 },
          (_, index) => ((value.charCodeAt(index % Math.max(value.length, 1)) || 0) % 97) / 97
        )
      ),
      usage: { promptTokens: values.join('').length }
    };
  }
  async listModels(): Promise<ModelDescriptor[]> {
    return [
      { id: 'mock-chat', provider: 'mock', capabilities: ['completion', 'streaming', 'embedding'] }
    ];
  }
}
