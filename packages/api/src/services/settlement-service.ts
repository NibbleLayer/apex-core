export type SettlementStatus = 'pending' | 'confirmed' | 'failed';

const terminalStatuses = new Set<SettlementStatus>(['confirmed', 'failed']);

export class SettlementTransitionError extends Error {
  constructor(
    public readonly from: SettlementStatus,
    public readonly to: SettlementStatus,
  ) {
    super(`Invalid settlement status transition: ${from} -> ${to}`);
    this.name = 'SettlementTransitionError';
  }
}

export function assertSettlementTransition(from: SettlementStatus, to: SettlementStatus): { idempotent: boolean } {
  if (from === to) {
    return { idempotent: true };
  }

  if (terminalStatuses.has(from)) {
    throw new SettlementTransitionError(from, to);
  }

  if (from === 'pending' && (to === 'confirmed' || to === 'failed')) {
    return { idempotent: false };
  }

  throw new SettlementTransitionError(from, to);
}
