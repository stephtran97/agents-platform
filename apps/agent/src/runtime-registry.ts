import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';
import { BasicRagRuntime, type AgentDependencies } from './runtimes/basic-rag-runtime.js';

export type AgentRuntime = { answer(request: AgentRequest): Promise<AgentResponse> };
export function createAgentRuntime(name: string, dependencies: AgentDependencies): AgentRuntime {
  if (name === 'basic-rag') return new BasicRagRuntime(dependencies);
  throw new Error('AGENT_RUNTIME_UNAVAILABLE');
}
