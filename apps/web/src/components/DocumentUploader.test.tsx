import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentUploader } from './DocumentUploader.js';

const file = (name: string, type = 'text/plain') => new File(['hello'], name, { type });

describe('DocumentUploader', () => {
  it('accepts a supported file and reports success', async () => {
    const onUpload = vi.fn().mockResolvedValue({});
    render(<DocumentUploader onUpload={onUpload} />);
    await userEvent.upload(screen.getByLabelText('Upload a document'), file('notes.txt'));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/notes\.txt uploaded/)).toBeInTheDocument();
  });

  it('shows a failure state when the upload is rejected', async () => {
    render(<DocumentUploader onUpload={vi.fn().mockRejectedValue(new Error('x'))} />);
    await userEvent.upload(screen.getByLabelText('Upload a document'), file('notes.txt'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
  });

  it('rejects unsupported file types without uploading', async () => {
    const onUpload = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(<DocumentUploader onUpload={onUpload} />);
    await user.upload(screen.getByLabelText('Upload a document'), file('image.png', 'image/png'));
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Unsupported file type');
  });
});
