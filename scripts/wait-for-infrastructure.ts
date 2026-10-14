import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';

interface ComposeService {
  Health?: string;
  Service?: string;
}

const expected = new Set(['postgres', 'minio']);
const timeoutMs = 120_000;
const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    const output = execFileSync('docker', ['compose', 'ps', '--format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let services: ComposeService[];
    try {
      const parsed: unknown = JSON.parse(output);
      services = Array.isArray(parsed) ? parsed as ComposeService[] : [parsed as ComposeService];
    } catch {
      services = output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ComposeService);
    }
    const healthy = new Set(
      services
        .filter((service) => service.Health === 'healthy')
        .map((service) => service.Service),
    );

    if ([...expected].every((service) => healthy.has(service))) {
      console.log('Infrastructure healthy: postgres, minio');
      process.exit(0);
    }
  } catch {
    // Compose may not have started yet; keep polling until the bounded timeout.
  }

  await delay(2_000);
}

console.error('Timed out waiting for healthy postgres and minio services.');
process.exit(1);
