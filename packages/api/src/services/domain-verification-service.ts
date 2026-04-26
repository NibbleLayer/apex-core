import crypto from 'node:crypto';

export type ResolveTxt = (name: string) => Promise<string[][]>;

export interface DnsProofRecord {
  name: string;
  value: string;
}

export interface DnsVerificationResult extends DnsProofRecord {
  success: boolean;
  reason?: string;
}

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) throw new Error('Domain is required');

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = new URL(value).hostname;
  } else {
    value = value.split('/')[0]?.split('?')[0]?.split('#')[0] ?? '';
  }

  value = value.replace(/\.$/, '');

  if (!value || value === 'localhost') throw new Error('Domain must be a public DNS name');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) || value.includes(':')) {
    throw new Error('Domain must not be an IP address');
  }
  if (value.length > 253) throw new Error('Domain is too long');

  const labels = value.split('.');
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL.test(label))) {
    throw new Error('Domain is invalid');
  }

  return value;
}

export function generateDomainVerificationToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function buildDnsProofRecord(domain: string, token: string): DnsProofRecord {
  return {
    name: `_apex.${normalizeDomain(domain)}`,
    value: `apex-verify=${token}`,
  };
}

export async function verifyDnsTxtProof({
  domain,
  token,
  resolveTxt,
}: {
  domain: string;
  token: string;
  resolveTxt: ResolveTxt;
}): Promise<DnsVerificationResult> {
  const record = buildDnsProofRecord(domain, token);

  try {
    const answers = await resolveTxt(record.name);
    const values = answers.map((chunks) => chunks.join(''));
    if (values.includes(record.value)) {
      return { success: true, ...record };
    }

    return { success: false, reason: 'Expected DNS TXT proof record was not found', ...record };
  } catch (error: any) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (['ENOTFOUND', 'ENODATA', 'ENODOMAIN', 'NOTFOUND', 'NXDOMAIN'].includes(code)) {
      return { success: false, reason: 'DNS TXT proof record was not found', ...record };
    }

    return {
      success: false,
      reason: error instanceof Error ? error.message : 'DNS TXT lookup failed',
      ...record,
    };
  }
}
