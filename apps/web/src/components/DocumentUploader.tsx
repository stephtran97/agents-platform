import { useState, type ChangeEvent } from 'react';

export const supportedExtensions = ['.txt', '.md', '.pdf', '.docx'] as const;
const maxBytes = 5 * 1024 * 1024;

type State =
  | { kind: 'idle' }
  | { kind: 'uploading'; name: string }
  | { kind: 'done'; name: string }
  | { kind: 'error'; message: string };

export function DocumentUploader({ onUpload }: { onUpload: (file: File) => Promise<unknown> }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!supportedExtensions.some((extension) => lower.endsWith(extension))) {
      setState({ kind: 'error', message: `Unsupported file type. Use ${supportedExtensions.join(', ')}.` });
    } else if (file.size > maxBytes) {
      setState({ kind: 'error', message: 'File is too large (5 MB maximum).' });
    } else {
      setState({ kind: 'uploading', name: file.name });
      try {
        await onUpload(file);
        setState({ kind: 'done', name: file.name });
      } catch {
        setState({ kind: 'error', message: 'Upload failed. Please try again.' });
      }
    }
    input.value = '';
  }

  return (
    <div className="uploader">
      <label htmlFor="document-file">Upload a document</label>
      <input
        id="document-file"
        type="file"
        accept={supportedExtensions.join(',')}
        disabled={state.kind === 'uploading'}
        onChange={handleChange}
      />
      {state.kind === 'uploading' && <p role="status">Uploading {state.name}…</p>}
      {state.kind === 'done' && <p role="status">{state.name} uploaded. Processing will start shortly.</p>}
      {state.kind === 'error' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
