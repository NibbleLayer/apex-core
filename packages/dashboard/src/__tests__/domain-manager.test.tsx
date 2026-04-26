import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { DomainManager } from '../components/DomainManager';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DomainManager', () => {
  it('displays DNS TXT instructions and verifies domains', async () => {
    vi.spyOn(api, 'listDomains').mockResolvedValue([
      {
        id: 'dom_123',
        organizationId: 'org_123',
        serviceId: 'svc_123',
        domain: 'weather.example.com',
        verificationToken: 'tok_123',
        verificationMethod: 'dns_txt',
        status: 'pending',
        dnsRecordName: '_apex.weather.example.com',
        dnsRecordValue: 'apex-verify=tok_123',
        verifiedAt: null,
        lastCheckedAt: null,
        failureReason: null,
        createdAt: '2026-04-25T00:00:00.000Z',
        updatedAt: '2026-04-25T00:00:00.000Z',
      },
    ]);
    const verify = vi.spyOn(api, 'verifyDomain').mockResolvedValue({} as any);

    render(() => <DomainManager serviceId="svc_123" />);

    expect(await screen.findByText('_apex.weather.example.com')).toBeTruthy();
    expect(screen.getByText('apex-verify=tok_123')).toBeTruthy();

    fireEvent.click(screen.getByText('Verify DNS'));

    await waitFor(() => expect(verify).toHaveBeenCalledWith('dom_123'));
  });
});
