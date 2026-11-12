import { describe, expect, it } from 'vitest';
import { PlainTextExtractor } from './plain-text-extractor.js';

describe('PlainTextExtractor', () => {
  it('handles plain text and markdown uploads', () => {
    expect(new PlainTextExtractor().supportedMimeTypes).toEqual(expect.arrayContaining(['text/plain', 'text/markdown']));
  });

  it('decodes UTF-8 and strips a byte order mark', async () => {
    const extracted = await new PlainTextExtractor().extract(Buffer.from('﻿# Titre\nCafé', 'utf8'));
    expect(extracted.text).toBe('# Titre\nCafé');
  });
});
