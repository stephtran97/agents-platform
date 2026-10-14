import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';
export type RetrievedChunk = { chunkId: string; documentId: string; content: string; filename: string; score: number; startOffset?: number; endOffset?: number };
export type AgentDependencies = { vectorStore: { search(input: { tenantId: string; knowledgeBaseIds: string[]; query: string; limit: number }): Promise<RetrievedChunk[]> }; llm: { complete(input: { model: string; messages: AgentRequest['messages'] }): Promise<{ message: { content: string }; model: string; finishReason: 'stop'; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> } };
export class BasicRagRuntime {
  constructor(private readonly deps: AgentDependencies) {}
  async answer(request: AgentRequest): Promise<AgentResponse> {
    const chunks = await this.deps.vectorStore.search({ tenantId: request.tenantId, knowledgeBaseIds: request.knowledgeBaseIds, query: request.question, limit: 5 });
    if (chunks.length === 0) {
      return { answer: 'I could not find relevant information in the connected knowledge bases.', citations: [], toolCalls: [], traceId: request.traceId ?? crypto.randomUUID() };
    }
    const context = chunks.map((chunk) => `[${chunk.chunkId}] ${chunk.content}`).join('\n');
    const result = await this.deps.llm.complete({ model: 'mock-chat', messages: [...request.messages, { role: 'user', content: `${request.question}\nContext:\n${context}` }] });
    return { answer: result.message.content, citations: chunks.map((chunk) => ({ documentId: chunk.documentId, chunkId: chunk.chunkId, filename: chunk.filename, text: chunk.content, score: chunk.score })), toolCalls: [], usage: result.usage, traceId: request.traceId ?? crypto.randomUUID() };
  }
}
