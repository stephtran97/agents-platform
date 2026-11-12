import { BasicRagRuntime, type AgentDependencies } from './runtimes/basic-rag-runtime.js';
import type { AgentRuntime } from './runtimes/agent-runtime.js';

export type { AgentRuntime } from './runtimes/agent-runtime.js';

export function createAgentRuntime(name: string, dependencies: AgentDependencies): AgentRuntime {
  if (name === 'basic-rag') return new BasicRagRuntime(dependencies);
  throw new Error('AGENT_RUNTIME_UNAVAILABLE');
}
