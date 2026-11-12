import type { DocumentSummary } from '../api/client.js';

const statusLabel: Record<DocumentSummary['status'], string> = {
  pending: 'Queued',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed'
};

type Props = {
  documents: DocumentSummary[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

export function DocumentList({ documents, selectedId, onSelect }: Props) {
  if (documents.length === 0)
    return <p className="empty">No documents yet. Upload one to get started.</p>;
  return (
    <ul className="documents" aria-label="Documents">
      {documents.map((document) => (
        <li key={document.id} data-status={document.status}>
          {onSelect ? (
            <button
              type="button"
              className="link"
              aria-pressed={selectedId === document.id}
              onClick={() => onSelect(document.id)}
            >
              {document.filename}
            </button>
          ) : (
            <span>{document.filename}</span>
          )}{' '}
          <span className="status">{statusLabel[document.status]}</span>
        </li>
      ))}
    </ul>
  );
}
