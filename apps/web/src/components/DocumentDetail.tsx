import { useEffect, useRef, useState } from 'react';
import type { DocumentInspection } from '../api/client.js';
import { buildSegments } from './chunk-segments.js';

type Props = {
  documentId: string;
  load: (documentId: string) => Promise<DocumentInspection>;
  onDelete: (documentId: string) => Promise<void>;
  onClose: () => void;
};

export function DocumentDetail({ documentId, load, onDelete, onClose }: Props) {
  const [inspection, setInspection] = useState<DocumentInspection | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeOrdinal, setActiveOrdinal] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const textPane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setInspection(null);
    setFailed(false);
    setActiveOrdinal(null);
    setConfirming(false);
    setDeleteFailed(false);
    load(documentId)
      .then((result) => {
        if (!cancelled) setInspection(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, load]);

  function selectChunk(ordinal: number) {
    setActiveOrdinal(ordinal);
    textPane.current
      ?.querySelector(`[data-ordinals~="${ordinal}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await onDelete(documentId);
    } catch {
      setDeleteFailed(true);
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (failed)
    return (
      <section className="panel document-detail" aria-label="Document detail">
        <p role="alert" className="error">
          Could not load this document.
        </p>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </section>
    );
  if (!inspection)
    return (
      <section className="panel document-detail" aria-label="Document detail">
        <p>Loading document…</p>
      </section>
    );

  const { document, extractedText, chunks, chunkOptions } = inspection;
  const segments = extractedText === null ? [] : buildSegments(extractedText, chunks);

  return (
    <section className="panel document-detail" aria-label="Document detail">
      <div className="detail-header">
        <div>
          <h2>{document.filename}</h2>
          <p className="hint">
            {document.status} · {chunks.length} chunks · up to {chunkOptions.maxCharacters}{' '}
            characters each, {chunkOptions.overlapCharacters} overlap
          </p>
        </div>
        <div className="detail-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
          {confirming ? (
            <>
              <button type="button" className="danger" disabled={deleting} onClick={confirmDelete}>
                Confirm delete
              </button>
              <button
                type="button"
                className="secondary"
                disabled={deleting}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <p className="hint">
          This removes the file, its extracted text, and all chunks and embeddings. The agent will
          stop citing it.
        </p>
      )}
      {deleteFailed && (
        <p role="alert" className="error">
          Delete failed. Try again.
        </p>
      )}
      <div className="detail-panes">
        <div>
          <h3>Extracted text</h3>
          {extractedText === null ? (
            <p role="alert" className="error">
              Text extraction failed: {inspection.extractionError}
            </p>
          ) : (
            <div className="text-pane" ref={textPane} aria-label="Extracted text">
              {segments.map((segment, index) => {
                const first = segment.ordinals[0];
                const overlap = segment.ordinals.length > 1;
                const active = activeOrdinal !== null && segment.ordinals.includes(activeOrdinal);
                return (
                  <span
                    key={index}
                    data-ordinals={segment.ordinals.join(' ')}
                    className={[
                      'segment',
                      first === undefined ? '' : `tone-${first % 4}`,
                      overlap ? 'overlap' : '',
                      active ? 'active' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {segment.text}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <h3>Chunks the agent searches ({chunks.length})</h3>
          {chunks.length === 0 ? (
            <p className="empty">No chunks stored yet.</p>
          ) : (
            <ol className="chunk-list" aria-label="Chunks">
              {chunks.map((chunk) => (
                <li key={chunk.id}>
                  <button
                    type="button"
                    className={`chunk tone-${chunk.ordinal % 4}${
                      activeOrdinal === chunk.ordinal ? ' active' : ''
                    }`}
                    aria-pressed={activeOrdinal === chunk.ordinal}
                    onClick={() => selectChunk(chunk.ordinal)}
                  >
                    <strong>#{chunk.ordinal}</strong> · {chunk.text.length} chars
                    {chunk.startOffset === null
                      ? ' · position unknown'
                      : ` · ${chunk.startOffset}–${chunk.endOffset}`}
                    <span className="chunk-text">{chunk.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
