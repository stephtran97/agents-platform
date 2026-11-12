import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readManifest(path: string) {
  return JSON.parse(readFileSync(`${root}/${path}`, 'utf8')) as {
    scripts?: Record<string, string>;
  };
}

describe('workspace manifests', () => {
  it('exposes the standard root scripts', () => {
    const scripts = readManifest('package.json').scripts;

    expect(scripts).toMatchObject({
      build: expect.any(String),
      test: expect.any(String),
      typecheck: expect.any(String)
    });
  });

  it('gives every app and package a typecheck script', () => {
    const directories = [
      'apps/api',
      'apps/agent',
      'apps/llm',
      'apps/worker',
      'apps/web',
      'packages/contracts',
      'packages/domain',
      'packages/clients',
      'packages/config',
      'packages/observability'
    ];

    for (const directory of directories) {
      expect(readManifest(`${directory}/package.json`).scripts?.typecheck).toEqual(
        expect.any(String)
      );
    }
  });
});
