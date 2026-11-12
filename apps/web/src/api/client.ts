import type { AgentResponse, DocumentDto } from '@agents-platform/contracts';

const apiBase = '';
const headers = { 'content-type': 'application/json', 'x-tenant-id': 'local' };

export type DocumentSummary = Pick<DocumentDto, 'id' | 'filename' | 'status' | 'sizeBytes'>;

export async function listDocuments(): Promise<DocumentSummary[]> {
  const response = await fetch(`${apiBase}/v1/documents`, { headers });
  if (!response.ok) throw new Error('DOCUMENTS_UNAVAILABLE');
  return response.json();
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
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
      contentBase64,
    }),
  });
  if (!response.ok) throw new Error('UPLOAD_FAILED');
  return response.json();
}

export async function createConversation(): Promise<{ id: string }> {
  const response = await fetch(`${apiBase}/v1/conversations`, { method: 'POST', headers, body: '{}' });
  if (!response.ok) throw new Error('CONVERSATION_UNAVAILABLE');
  return response.json();
}

export async function sendMessage(conversationId: string, message: string): Promise<AgentResponse> {
  const response = await fetch(`${apiBase}/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, knowledgeBaseIds: ['default'] }),
  });
  if (!response.ok) throw new Error('AGENT_UNAVAILABLE');
  return response.json();
}
