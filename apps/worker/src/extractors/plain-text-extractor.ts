import { TextDecoder } from 'node:util';
import type { DocumentExtractor, ExtractedDocument } from './extractor.js';

export class PlainTextExtractor implements DocumentExtractor {
  readonly supportedMimeTypes = ['text/plain', 'text/markdown'] as const;

  async extract(input: Buffer): Promise<ExtractedDocument> {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(input).replace(/^\uFEFF/u, '')
    };
  }
}
