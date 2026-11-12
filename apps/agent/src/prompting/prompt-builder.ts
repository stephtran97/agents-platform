import type { AgentRequest } from '@agents-platform/contracts';

export type PromptSource = { chunkId: string; documentId: string; filename: string; content: string; startOffset?: number; endOffset?: number };
export type PromptInput = { question: string; history: AgentRequest['messages']; sources: readonly PromptSource[] };
export type Prompt = { messages: AgentRequest['messages'] };

const groundedInstruction =
  'Answer the question using only the numbered sources provided. Cite sources by their chunk id in square brackets. ' +
  'If the sources do not contain the answer, say you could not find it instead of guessing.';
const noContextInstruction =
  'No relevant sources were found in the knowledge base. Say that you could not find relevant information; do not answer from memory.';

/** Builds a provider-independent grounded prompt. The final message always carries the question and labelled sources. */
export function buildGroundedPrompt(input: PromptInput): Prompt {
  const system = { role: 'system' as const, content: input.sources.length > 0 ? groundedInstruction : noContextInstruction };
  const context =
    input.sources.length > 0
      ? input.sources
          .map((source, index) => {
            const span = source.startOffset === undefined ? '' : ` offsets ${source.startOffset}-${source.endOffset ?? ''}`;
            return `[${source.chunkId}] (source ${index + 1}: ${source.filename}${span})\n${source.content}`;
          })
          .join('\n\n')
      : '(no sources)';
  return {
    messages: [
      system,
      ...input.history.filter((message) => message.role !== 'system'),
      { role: 'user', content: `${input.question}\nContext:\n${context}` },
    ],
  };
}
