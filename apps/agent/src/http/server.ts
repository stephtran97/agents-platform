import Fastify, { type FastifyInstance } from 'fastify';
import type { AgentRuntime } from '../runtimes/agent-runtime.js';
import { registerAgentRoutes } from './routes.js';

export async function buildAgentServer(runtime: AgentRuntime): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' && !process.env.VITEST });
  await registerAgentRoutes(app, runtime);
  return app;
}
