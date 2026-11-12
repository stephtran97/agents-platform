import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';

/** Replaceable agent method. New runtimes implement this and are registered in runtime-registry. */
export interface AgentRuntime {
  answer(request: AgentRequest): Promise<AgentResponse>;
}
