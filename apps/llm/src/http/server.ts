import Fastify, { type FastifyInstance } from 'fastify';
import type { LlmProvider } from '../providers/llm-provider.js';
import { registerRoutes, type GatewayOptions } from './routes.js';

export async function buildServer(provider?: LlmProvider, options?: GatewayOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' && !process.env.VITEST });
  await registerRoutes(app, provider, options);
  return app;
}
