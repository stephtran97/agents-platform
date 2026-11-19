import type { AgentResponse, DocumentDto, DocumentInspectionDto } from '@agents-platform/contracts';

const apiBase = '';
const tenantHeaders = { 'x-tenant-id': 'local' };
const headers = { 'content-type': 'application/json', ...tenantHeaders };

export type DocumentSummary = Pick<DocumentDto, 'id' | 'filename' | 'status' | 'sizeBytes'>;

export async function listDocuments(): Promise<DocumentSummary[]> {
  const response = await fetch(`${apiBase}/v1/documents`, { headers });
  if (!response.ok) throw new Error('DOCUMENTS_UNAVAILABLE');
  return response.json();
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const contentBase64 = toBase64(await file.arrayBuffer());
  const response = await fetch(`${apiBase}/v1/documents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'text/plain',
      sizeBytes: file.size,
      contentBase64
    })
  });
  if (!response.ok) throw new Error('UPLOAD_FAILED');
  return response.json();
}

export async function createConversation(): Promise<{ id: string }> {
  const response = await fetch(`${apiBase}/v1/conversations`, {
    method: 'POST',
    headers,
    body: '{}'
  });
  if (!response.ok) throw new Error('CONVERSATION_UNAVAILABLE');
  return response.json();
}

export async function sendMessage(conversationId: string, message: string): Promise<AgentResponse> {
  const response = await fetch(`${apiBase}/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message })
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { stack?: unknown };
    const error = new Error('AGENT_UNAVAILABLE');
    if (typeof body.stack === 'string') error.stack = body.stack;
    throw error;
  }
  return response.json();
}

export type DocumentInspection = DocumentInspectionDto;

export async function getDocumentInspection(id: string): Promise<DocumentInspection> {
  const response = await fetch(`${apiBase}/v1/documents/${encodeURIComponent(id)}/chunks`, {
    headers
  });
  if (!response.ok) throw new Error('DOCUMENT_UNAVAILABLE');
  return response.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${apiBase}/v1/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    // No content-type: Fastify rejects a JSON content-type with an empty body (400).
    headers: tenantHeaders
  });
  // A 404 means it is already gone, which is the outcome the caller wants.
  if (!response.ok && response.status !== 404) throw new Error('DELETE_FAILED');
}
