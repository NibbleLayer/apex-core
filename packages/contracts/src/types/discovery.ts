export interface DiscoveryMetadata {
  id: string;
  routeId: string;
  discoverable: boolean;
  category: string | null;
  tags: string[] | null;
  description: string | null;
  mimeType: string | null;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  docsUrl: string | null;
  published: boolean;
  reviewStatus: 'draft' | 'in_review' | 'published' | 'rejected';
  indexingStatus: 'not_submitted' | 'queued' | 'indexed' | 'failed';
  indexingError: string | null;
  updatedAt: Date;
}
