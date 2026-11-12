import type { AgentResponse } from '@agents-platform/contracts';

export function CitationList({ citations }: { citations: AgentResponse['citations'] }) {
  if (citations.length === 0) return null;
  return (
    <>
      <h2>Sources</h2>
      <ul>
        {citations.map((citation) => (
          <li
            key={`${citation.documentId}:${citation.chunkId}`}
          >{`${citation.filename} · ${citation.chunkId}`}</li>
        ))}
      </ul>
    </>
  );
}
