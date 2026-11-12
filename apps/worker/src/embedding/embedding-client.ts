export interface EmbeddingClient {
  embed(inputs: readonly string[]): Promise<readonly number[][]>;
}

import { LlmClient } from '@agents-platform/clients';

export class LlmEmbeddingClient implements EmbeddingClient {
  constructor(
    private readonly client: LlmClient,
    private readonly model = 'text-embedding-3-small'
  ) {}
  async embed(inputs: readonly string[]): Promise<readonly number[][]> {
    const result = await this.client.embed({ model: this.model, input: [...inputs] });
    return result.embeddings;
  }
}
