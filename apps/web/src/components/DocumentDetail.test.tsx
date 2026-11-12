import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentInspection } from '../api/client.js';
import { buildSegments } from './chunk-segments.js';
import { DocumentDetail } from './DocumentDetail.js';

const text = 'abcdefghijKLMNOPQRST';
const inspection: DocumentInspection = {
  document: {
    id: 'doc-1',
    tenantId: 't',
    knowledgeBaseId: 'kb',
    filename: 'notes.txt',
    contentType: 'text/plain',
    sizeBytes: text.length,
    status: 'ready',
    createdAt: new Date().toISOString()
  },
  extractedText: text,
  chunkOptions: { maxCharacters: 12, overlapCharacters: 4 },
  chunks: [
    { id: 'c0', ordinal: 0, text: text.slice(0, 12), startOffset: 0, endOffset: 12 },
    { id: 'c1', ordinal: 1, text: text.slice(8), startOffset: 8, endOffset: 20 }
  ]
};

describe('buildSegments', () => {
  it('splits at chunk boundaries and marks overlaps with both chunks', () => {
    expect(buildSegments(text, inspection.chunks)).toEqual([
      { text: 'abcdefgh', ordinals: [0] },
      { text: 'ijKL', ordinals: [0, 1] },
      { text: 'MNOPQRST', ordinals: [1] }
    ]);
  });

  it('leaves uncovered text unassigned and ignores chunks without offsets', () => {
    expect(
      buildSegments('abcdef', [
        { ordinal: 0, startOffset: 2, endOffset: 4 },
        { ordinal: 1, startOffset: null, endOffset: null }
      ])
    ).toEqual([
      { text: 'ab', ordinals: [] },
      { text: 'cd', ordinals: [0] },
      { text: 'ef', ordinals: [] }
    ]);
  });
});

describe('DocumentDetail', () => {
  it('shows the extracted text beside the stored chunks', async () => {
    render(
      <DocumentDetail
        documentId="doc-1"
        load={vi.fn().mockResolvedValue(inspection)}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(await screen.findByRole('heading', { name: 'notes.txt' })).toBeInTheDocument();
    expect(screen.getByLabelText('Extracted text')).toHaveTextContent(text);
    const chunks = within(screen.getByRole('list', { name: 'Chunks' })).getAllByRole('button');
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toHaveTextContent('#1');
    expect(chunks[1]).toHaveTextContent('8–20');
  });

  it('highlights the text covered by the selected chunk', async () => {
    render(
      <DocumentDetail
        documentId="doc-1"
        load={vi.fn().mockResolvedValue(inspection)}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const chunks = within(await screen.findByRole('list', { name: 'Chunks' })).getAllByRole(
      'button'
    );
    await userEvent.click(chunks[1]!);
    const active = [...document.querySelectorAll('.segment.active')].map((n) => n.textContent);
    expect(active).toEqual(['ijKL', 'MNOPQRST']);
  });

  it('requires confirmation before deleting', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <DocumentDetail
        documentId="doc-1"
        load={vi.fn().mockResolvedValue(inspection)}
        onDelete={onDelete}
        onClose={vi.fn()}
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onDelete).toHaveBeenCalledWith('doc-1');
  });

  it('can cancel a delete and reports a failed delete', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('x'));
    render(
      <DocumentDetail
        documentId="doc-1"
        load={vi.fn().mockResolvedValue(inspection)}
        onDelete={onDelete}
        onClose={vi.fn()}
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed');
  });

  it('shows the extraction error instead of text', async () => {
    render(
      <DocumentDetail
        documentId="doc-1"
        load={vi
          .fn()
          .mockResolvedValue({ ...inspection, extractedText: null, extractionError: 'bad pdf' })}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('bad pdf');
  });

  it('shows an error when the document cannot be loaded', async () => {
    render(
      <DocumentDetail
        documentId="doc-1"
        load={vi.fn().mockRejectedValue(new Error('x'))}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  });
});
