export interface EmbeddingClient {
  embed(inputs: readonly string[]): Promise<readonly number[][]>;
}
