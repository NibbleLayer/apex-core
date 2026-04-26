import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api/client';
import { RouteTable } from '../components/RouteTable';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RouteTable', () => {
  it('shows draft SDK route badges and approves the candidate', async () => {
    const updateRoute = vi.spyOn(api, 'updateRoute').mockResolvedValue({} as any);
    const onRefresh = vi.fn();

    render(() => (
      <RouteTable
        serviceId="svc_123"
        onRefresh={onRefresh}
        routes={[
          {
            id: 'route_123',
            serviceId: 'svc_123',
            method: 'GET',
            path: '/auto-weather',
            description: null,
            enabled: false,
            source: 'sdk',
            publicationStatus: 'draft',
          },
        ]}
      />
    ));

    expect(screen.getByText('draft')).toBeTruthy();
    expect(screen.getByText('sdk')).toBeTruthy();

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(updateRoute).toHaveBeenCalledWith('route_123', {
        publicationStatus: 'published',
        enabled: true,
      });
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('shows stale state for SDK draft routes not seen recently', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T01:10:00.000Z'));

    render(() => (
      <RouteTable
        serviceId="svc_123"
        onRefresh={vi.fn()}
        routes={[
          {
            id: 'route_456',
            serviceId: 'svc_123',
            method: 'GET',
            path: '/auto-stale',
            description: null,
            enabled: false,
            source: 'sdk',
            publicationStatus: 'draft',
            lastSeenAt: '2026-04-25T01:00:00.000Z',
          },
        ]}
      />
    ));

    expect(screen.getByText('stale')).toBeTruthy();
    expect(screen.getByText(/Last seen/)).toBeTruthy();
  });
});
