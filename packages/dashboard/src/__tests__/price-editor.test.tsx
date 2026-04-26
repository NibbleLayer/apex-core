import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api/client';
import { PriceEditor } from '../components/PriceEditor';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PriceEditor', () => {
  it('hides advanced raw fields by default and reveals them on request', async () => {
    vi.spyOn(api, 'listPricing').mockResolvedValue([]);

    render(() => <PriceEditor routeId="route_123" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Price Rule'));

    expect(screen.queryByLabelText('Raw token address')).toBeNull();
    expect(screen.queryByLabelText('Raw CAIP network')).toBeNull();

    fireEvent.click(screen.getByText('Show advanced fields'));

    expect(screen.getByLabelText('Raw token address')).toBeTruthy();
    expect(screen.getByLabelText('Raw CAIP network')).toBeTruthy();
  });

  it('shows an actionable validation error when amount is missing', () => {
    vi.spyOn(api, 'listPricing').mockResolvedValue([]);

    render(() => <PriceEditor routeId="route_123" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Price Rule'));
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Enter a positive USD price amount before saving.')).toBeTruthy();
  });

  it.each(['abc', '0', '-1'])('shows an actionable validation error for invalid amount %s', (input) => {
    vi.spyOn(api, 'listPricing').mockResolvedValue([]);
    const createPrice = vi.spyOn(api, 'createPrice');

    render(() => <PriceEditor routeId="route_123" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Price Rule'));
    fireEvent.input(screen.getByLabelText('Price (USD)'), { target: { value: input } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Enter a positive USD price amount before saving.')).toBeTruthy();
    expect(createPrice).not.toHaveBeenCalled();
  });

  it('creates a price with normalized USD amount and the selected preset', async () => {
    vi.spyOn(api, 'listPricing').mockResolvedValue([]);
    const createPrice = vi.spyOn(api, 'createPrice').mockResolvedValue({
      id: 'price_123',
      routeId: 'route_123',
      scheme: 'exact',
      amount: '$0.01',
      token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      network: 'eip155:84532',
      active: true,
    });

    render(() => <PriceEditor routeId="route_123" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Add Price Rule'));
    fireEvent.input(screen.getByLabelText('Price (USD)'), { target: { value: '0.01' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(createPrice).toHaveBeenCalledWith('route_123', {
        scheme: 'exact',
        amount: '$0.01',
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: 'eip155:84532',
      });
    });
  });
});
