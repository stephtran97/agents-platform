import type { FastifyInstance, FastifyReply } from 'fastify';
import { completionRequestSchema, embeddingRequestSchema } from '@agents-platform/contracts';
import { createLlmProvider } from '../provider-registry.js';
import type { LlmProvider } from '../providers/llm-provider.js';

export type GatewayOptions = { timeoutMs?: number };
type Parser<T> = {
  safeParse(
    value: unknown
  ): { success: true; data: T } | { success: false; error: { issues: unknown[] } };
};

function defaultProvider(): LlmProvider {
  return createLlmProvider({
    provider: process.env.LLM_PROVIDER ?? 'mock',
    apiKey: process.env.OPENAI_API_KEY ?? process.env.AZURE_OPENAI_API_KEY,
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1'
  });
}

async function withDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('MODEL_TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export async function registerRoutes(
  app: FastifyInstance,
  provider: LlmProvider = defaultProvider(),
  options: GatewayOptions = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS ?? 30_000);

  async function handle<I, O>(
    schema: Parser<I>,
    body: unknown,
    reply: FastifyReply,
    run: (input: I) => Promise<O>
  ) {
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return reply.code(400).send({ code: 'INVALID_REQUEST', issues: parsed.error.issues });
    try {
      return await withDeadline(run(parsed.data), timeoutMs);
    } catch (error) {
      if (error instanceof Error && error.message === 'MODEL_TIMEOUT')
        return reply.code(504).send({ code: 'MODEL_TIMEOUT' });
      return reply.code(503).send({ code: 'MODEL_UNAVAILABLE' });
    }
  }

  app.get('/health', async () => ({ ok: true }));
  app.post('/v1/completions', (request, reply) =>
    handle(completionRequestSchema, request.body, reply, (input) => provider.complete(input))
  );
  app.post('/v1/embeddings', (request, reply) =>
    handle(embeddingRequestSchema, request.body, reply, (input) => provider.embed(input))
  );
  app.get('/v1/models', async (_request, reply) => {
    try {
      return await withDeadline(provider.listModels(), timeoutMs);
    } catch {
      return reply.code(503).send({ code: 'MODEL_UNAVAILABLE' });
    }
  });
}
