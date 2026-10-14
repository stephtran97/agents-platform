import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';
export class AgentClient {
  constructor(private readonly baseUrl: string) {}
  async answer(request: AgentRequest): Promise<AgentResponse> { const response = await fetch(`${this.baseUrl}/v1/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) }); if (!response.ok) throw new Error('AGENT_UNAVAILABLE'); return response.json() as Promise<AgentResponse>; }
}
