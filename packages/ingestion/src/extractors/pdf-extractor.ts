import type { DocumentExtractor, ExtractedDocument } from './extractor.js';

export class PdfExtractor implements DocumentExtractor {
  readonly supportedMimeTypes = ['application/pdf'] as const;

  async extract(input: Buffer): Promise<ExtractedDocument> {
    const { default: parsePdf } = await import('pdf-parse');
    const result = await parsePdf(input);
    return { text: result.text };
  }
}
