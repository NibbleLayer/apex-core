import { describe, expect, it } from 'vitest';

import {
  buildPresetPricePayload,
  formatPricingTokenLabel,
  normalizeUsdAmountInput,
  PRICING_TOKEN_PRESETS,
} from '../utils/pricing';

describe('pricing helpers', () => {
  it('normalizes USD amount inputs for API payloads', () => {
    expect(normalizeUsdAmountInput('0.01')).toBe('$0.01');
    expect(normalizeUsdAmountInput('$0.01')).toBe('$0.01');
    expect(normalizeUsdAmountInput('1')).toBe('$1');
    expect(normalizeUsdAmountInput('1.25')).toBe('$1.25');
    expect(normalizeUsdAmountInput(' 0.25 ')).toBe('$0.25');
  });

  it.each(['abc', '0', '-1'])('rejects invalid USD amount input: %s', (input) => {
    expect(normalizeUsdAmountInput(input)).toBe('');
  });

  it('builds preset price payloads without changing the API contract', () => {
    expect(buildPresetPricePayload({ amount: '0.01', presetId: 'test-usdc-base-sepolia' })).toEqual({
      scheme: 'exact',
      amount: '$0.01',
      token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      network: 'eip155:84532',
    });
  });

  it('formats known token and network pairs with friendly labels', () => {
    expect(formatPricingTokenLabel(PRICING_TOKEN_PRESETS[1].token, PRICING_TOKEN_PRESETS[1].network)).toBe('USDC on Base');
  });

  it('falls back to abbreviated token and network labels for unknown pairs', () => {
    expect(formatPricingTokenLabel('0x0000000000000000000000000000000000000001', 'eip155:1')).toBe('0x0000…0001 on Ethereum');
  });
});
