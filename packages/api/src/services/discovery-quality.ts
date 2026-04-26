export type DiscoveryQualityCheck = {
  level: 'error' | 'warning';
  message: string;
};

export type DiscoveryQualityMetadata = {
  discoverable?: boolean | null;
  category?: string | null;
  tags?: string[] | null;
  description?: string | null;
  mimeType?: string | null;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  docsUrl?: string | null;
  reviewStatus?: 'draft' | 'in_review' | 'published' | 'rejected';
  indexingStatus?: 'not_submitted' | 'queued' | 'indexed' | 'failed';
  indexingError?: string | null;
  published?: boolean;
};

export type DiscoveryPreviewRoute = {
  method: string;
  path: string;
  description?: string | null;
};

function hasSchema(value: Record<string, unknown> | null | undefined): boolean {
  return !!value && Object.keys(value).length > 0;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateDiscoveryQuality(metadata: DiscoveryQualityMetadata): DiscoveryQualityCheck[] {
  const checks: DiscoveryQualityCheck[] = [];
  const description = metadata.description?.trim() ?? '';
  const category = metadata.category?.trim() ?? '';
  const mimeType = metadata.mimeType?.trim() ?? '';
  const docsUrl = metadata.docsUrl?.trim() ?? '';

  if (!description) checks.push({ level: 'error', message: 'Description is required before publishing.' });
  if (!category) checks.push({ level: 'error', message: 'Category is required before publishing.' });
  if (!mimeType) checks.push({ level: 'error', message: 'MIME type is required before publishing.' });
  if (!hasSchema(metadata.inputSchema)) checks.push({ level: 'error', message: 'Input schema is required before publishing.' });
  if (!hasSchema(metadata.outputSchema)) checks.push({ level: 'error', message: 'Output schema is required before publishing.' });
  if (docsUrl && !isValidUrl(docsUrl)) checks.push({ level: 'error', message: 'Docs URL must be a valid URL.' });
  if (!metadata.discoverable) checks.push({ level: 'error', message: 'Route must be discoverable before publishing.' });

  if (description && description.length < 30) {
    checks.push({ level: 'warning', message: 'Description is short; use at least 30 characters for better Bazaar listings.' });
  }
  if (!metadata.tags || metadata.tags.length === 0) checks.push({ level: 'warning', message: 'Add tags to improve Bazaar search visibility.' });
  if (!docsUrl) checks.push({ level: 'warning', message: 'Add a docs URL to help buyers evaluate the endpoint.' });

  return checks;
}

export function buildDiscoveryPreview({
  route,
  metadata,
}: {
  route: DiscoveryPreviewRoute;
  metadata: DiscoveryQualityMetadata;
}) {
  const title = metadata.category?.trim() || route.path;
  const summary = metadata.description?.trim() || route.description?.trim() || '';

  return {
    method: route.method,
    path: route.path,
    title,
    summary,
    category: metadata.category ?? null,
    tags: metadata.tags ?? [],
    mimeType: metadata.mimeType ?? null,
    docsUrl: metadata.docsUrl ?? null,
    schemas: {
      input: metadata.inputSchema ?? null,
      output: metadata.outputSchema ?? null,
    },
    status: {
      reviewStatus: metadata.reviewStatus ?? (metadata.published ? 'published' : 'draft'),
      indexingStatus: metadata.indexingStatus ?? 'not_submitted',
      indexingError: metadata.indexingError ?? null,
      published: metadata.published ?? metadata.reviewStatus === 'published',
      discoverable: metadata.discoverable ?? false,
    },
  };
}
