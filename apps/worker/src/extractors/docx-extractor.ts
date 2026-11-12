import type { DocumentExtractor, ExtractedDocument } from './extractor.js';

export class DocxExtractor implements DocumentExtractor {
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ] as const;

  async extract(input: Buffer): Promise<ExtractedDocument> {
    const { default: mammoth } = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: input });
    return { text: result.value };
  }
}
