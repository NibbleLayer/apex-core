import { render, screen, fireEvent } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveApexApiBaseUrl, OnboardingWizard } from '../components/OnboardingWizard';
import { api } from '../api/client';
import type { Environment } from '../api/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingWizard helpers', () => {
  it('derives the dashboard API base URL deterministically', () => {
    expect(deriveApexApiBaseUrl('https://dashboard.example.com/app')).toBe('https://dashboard.example.com/api');
  });
});

describe('OnboardingWizard', () => {
  const testEnvironment: Environment = {
    id: 'env_123',
    serviceId: 'svc_123',
    mode: 'test',
    network: 'eip155:84532',
    facilitatorUrl: 'https://x402.org/facilitator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('shows setup paths and hides advanced raw fields by default', () => {
    render(() => <OnboardingWizard serviceId="svc_123" environments={[]} onRefresh={vi.fn()} />);

    expect(screen.getByText('Test setup')).toBeTruthy();
    expect(screen.getByText('Production setup')).toBeTruthy();
    expect(screen.queryByLabelText('Settlement token address')).toBeNull();

    fireEvent.click(screen.getByText('Show advanced fields'));

    expect(screen.getByLabelText('Settlement token address')).toBeTruthy();
  });

  it('shows an actionable wallet validation error', () => {
    render(() => (
      <OnboardingWizard
        serviceId="svc_123"
        environments={[testEnvironment]}
        onRefresh={vi.fn()}
      />
    ));

    fireEvent.click(screen.getByText('Create wallet destination'));

    expect(screen.getByText('Enter a wallet address starting with 0x before creating a wallet destination.')).toBeTruthy();
  });

  it('requires a settlement token address before creating a wallet destination', () => {
    const createWallet = vi.spyOn(api, 'createWallet');
    render(() => <OnboardingWizard serviceId="svc_123" environments={[testEnvironment]} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByText('Show advanced fields'));
    fireEvent.input(screen.getByLabelText('Settlement token address'), { target: { value: '   ' } });
    fireEvent.input(screen.getByPlaceholderText('0x...'), { target: { value: '0x1234567890abcdef' } });
    fireEvent.click(screen.getByText('Create wallet destination'));

    expect(screen.getByText('Select or enter a settlement token address before creating a wallet destination.')).toBeTruthy();
    expect(createWallet).not.toHaveBeenCalled();
  });

  it('disables SDK token creation and shows helper text until the environment exists', () => {
    render(() => <OnboardingWizard serviceId="svc_123" environments={[]} onRefresh={vi.fn()} />);

    expect(screen.getByText('Create the test environment before creating an SDK token.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Create SDK token' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays the APEX_TOKEN snippet after SDK token creation', async () => {
    const createSdkToken = vi.spyOn(api, 'createSdkToken').mockResolvedValue({
      id: 'sdk_123',
      token: 'apex_sdk_once',
      environment: 'test',
      scopes: ['manifest:read', 'events:write', 'routes:register'],
    });

    render(() => <OnboardingWizard serviceId="svc_123" environments={[testEnvironment]} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByText('Create SDK token'));

    expect(await screen.findByText(/APEX_TOKEN="apex_sdk_once"/)).toBeTruthy();
    expect(createSdkToken).toHaveBeenCalledWith('svc_123', expect.objectContaining({
      scopes: ['manifest:read', 'events:write', 'routes:register'],
    }));
  });
});
