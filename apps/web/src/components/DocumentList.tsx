import type { DocumentSummary } from '../api/client.js';

const statusLabel: Record<DocumentSummary['status'], string> = {
  pending: 'Queued',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed'
};

export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0)
    return <p className="empty">No documents yet. Upload one to get started.</p>;
  return (
    <ul className="documents" aria-label="Documents">
      {documents.map((document) => (
        <li key={document.id} data-status={document.status}>
          <span>{document.filename}</span>{' '}
          <span className="status">{statusLabel[document.status]}</span>
        </li>
      ))}
    </ul>
  );
}
