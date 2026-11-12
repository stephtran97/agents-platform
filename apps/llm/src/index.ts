import { buildServer } from './http/server.js';

async function main() {
  const app = await buildServer();
  await app.listen({ port: Number(process.env.PORT ?? 4102), host: '0.0.0.0' });
}
void main();
