function requireField(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function parseSchema(value: string, label: 'input schema' | 'output schema'): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value.trim() || '{}') as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid ${label} JSON`);
  }
}

export function slugifyServiceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function buildCreateEnvironmentPayload(input: {
  mode: 'test' | 'prod';
  network: string;
  facilitatorUrl?: string;
}) {
  return {
    mode: input.mode,
    network: input.network,
    ...(input.facilitatorUrl?.trim() ? { facilitatorUrl: input.facilitatorUrl.trim() } : {}),
  };
}

export function buildCreateWalletPayload(input: {
  environmentId: string;
  token: string;
  network: string;
}) {
  return {
    environmentId: requireField(input.environmentId, 'environmentId'),
    token: requireField(input.token, 'token'),
    network: requireField(input.network, 'network'),
  };
}

export function buildCreatePricePayload(input: {
  amount: string;
  token: string;
  network: string;
}) {
  return {
    scheme: 'exact' as const,
    amount: requireField(input.amount, 'amount'),
    token: requireField(input.token, 'token'),
    network: requireField(input.network, 'network'),
  };
}

export function buildDiscoveryPayload(input: {
  discoverable: boolean;
  category: string;
  tags: string;
  description: string;
  mimeType: string;
  docsUrl: string;
  inputSchema: string;
  outputSchema: string;
  published: boolean;
}) {
  return {
    discoverable: input.discoverable,
    category: input.category.trim() || undefined,
    tags: input.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    description: input.description.trim() || undefined,
    mimeType: input.mimeType.trim() || undefined,
    docsUrl: input.docsUrl.trim() || undefined,
    inputSchema: parseSchema(input.inputSchema, 'input schema'),
    outputSchema: parseSchema(input.outputSchema, 'output schema'),
    published: input.published,
  };
}
