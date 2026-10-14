import { z } from 'zod';

const envSchema = z.object({
  TENANT_ID: z.string().trim().min(1).default('local-tenant'),
  AGENT_RUNTIME: z.string().trim().min(1).default('basic-rag'),
  LLM_PROVIDER: z.enum(['mock', 'openai', 'azure-openai']).default('mock'),
  AGENT_URL: z.string().url().default('http://localhost:3001'),
  LLM_URL: z.string().url().default('http://localhost:3002'),
  DATABASE_URL: z.url(),
  S3_ENDPOINT: z.url(),
  S3_BUCKET: z.string().trim().min(1),
  S3_ACCESS_KEY: z.string().trim().min(1),
  S3_SECRET_KEY: z.string().trim().min(1),
  OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
});

export interface AppConfig {
  tenantId: string;
  agentRuntime: string;
  llmProvider: 'mock' | 'openai' | 'azure-openai';
  agentUrl: URL;
  llmUrl: URL;
  databaseUrl: URL;
  s3Endpoint: URL;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  providerSecret?: string;
  azureOpenAiEndpoint?: URL;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.parse(env);
  const providerSecret = parsed.LLM_PROVIDER === 'openai'
    ? parsed.OPENAI_API_KEY
    : parsed.LLM_PROVIDER === 'azure-openai'
      ? parsed.AZURE_OPENAI_API_KEY
      : undefined;

  if (parsed.LLM_PROVIDER !== 'mock' && !providerSecret?.trim()) {
    throw new Error(`A non-empty secret is required for ${parsed.LLM_PROVIDER}`);
  }
  if (parsed.LLM_PROVIDER === 'azure-openai' && !parsed.AZURE_OPENAI_ENDPOINT) {
    throw new Error('AZURE_OPENAI_ENDPOINT is required for azure-openai');
  }

  return {
    tenantId: parsed.TENANT_ID,
    agentRuntime: parsed.AGENT_RUNTIME,
    llmProvider: parsed.LLM_PROVIDER,
    agentUrl: new URL(parsed.AGENT_URL),
    llmUrl: new URL(parsed.LLM_URL),
    databaseUrl: new URL(parsed.DATABASE_URL),
    s3Endpoint: new URL(parsed.S3_ENDPOINT),
    s3Bucket: parsed.S3_BUCKET,
    s3AccessKey: parsed.S3_ACCESS_KEY,
    s3SecretKey: parsed.S3_SECRET_KEY,
    ...(providerSecret ? { providerSecret } : {}),
    ...(parsed.AZURE_OPENAI_ENDPOINT ? { azureOpenAiEndpoint: new URL(parsed.AZURE_OPENAI_ENDPOINT) } : {}),
  };
}
