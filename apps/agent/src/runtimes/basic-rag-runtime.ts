import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';
import { buildGroundedPrompt } from '../prompting/prompt-builder.js';
import type { RetrievedChunk, Retriever } from '../retrieval/retriever.js';
import type { AgentRuntime } from './agent-runtime.js';

export type { RetrievedChunk } from '../retrieval/retriever.js';
export type AgentDependencies = {
  vectorStore: Retriever;
  llm: {
    complete(input: { model: string; messages: AgentRequest['messages'] }): Promise<{
      message: { content: string };
      model: string;
      finishReason: 'stop';
      usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    }>;
  };
};

export class BasicRagRuntime implements AgentRuntime {
  constructor(private readonly deps: AgentDependencies) {}

  async answer(request: AgentRequest): Promise<AgentResponse> {
    const traceId = request.traceId ?? crypto.randomUUID();
    const chunks: RetrievedChunk[] = await this.deps.vectorStore.search({
      tenantId: request.tenantId,
      knowledgeBaseIds: request.knowledgeBaseIds,
      query: request.question,
      limit: 5,
    });
    if (chunks.length === 0) {
      return { answer: 'I could not find relevant information in the connected knowledge bases.', citations: [], toolCalls: [], traceId };
    }
    const prompt = buildGroundedPrompt({
      question: request.question,
      history: request.messages,
      sources: chunks.map((chunk) => ({
        chunkId: chunk.chunkId, documentId: chunk.documentId, filename: chunk.filename,
        content: chunk.content, startOffset: chunk.startOffset, endOffset: chunk.endOffset,
      })),
    });
    const result = await this.deps.llm.complete({ model: 'mock-chat', messages: prompt.messages });
    return {
      answer: result.message.content,
      citations: chunks.map((chunk) => ({ documentId: chunk.documentId, chunkId: chunk.chunkId, filename: chunk.filename, text: chunk.content, score: chunk.score })),
      toolCalls: [],
      usage: result.usage,
      traceId,
    };
  }
}
