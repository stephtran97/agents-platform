export interface ExtractedDocument {
  text: string;
}

export interface DocumentExtractor {
  readonly supportedMimeTypes: readonly string[];
  extract(input: Buffer): Promise<ExtractedDocument>;
}
