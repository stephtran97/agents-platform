import Fastify from 'fastify';
import { registerRoutes } from './http/routes.js';
const app = Fastify({ logger: true });
async function main() {
  await registerRoutes(app);
  await app.listen({ port: Number(process.env.PORT ?? 4102), host: '0.0.0.0' });
}
void main();
