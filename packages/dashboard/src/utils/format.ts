export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatAmount(amount: string): string {
  if (amount.startsWith('$')) return amount;
  return `${parseInt(amount) / 1e6} USDC`; // Assume 6 decimals
}

export function eventTypeColor(type: string): string {
  switch (type) {
    case 'payment.required': return 'text-yellow-600 bg-yellow-50';
    case 'payment.verified': return 'text-blue-600 bg-blue-50';
    case 'payment.settled': return 'text-green-600 bg-green-50';
    case 'payment.failed': return 'text-red-600 bg-red-50';
    case 'payment.replay': return 'text-gray-600 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

export function settlementStatusColor(status: string): string {
  switch (status) {
    case 'confirmed': return 'text-green-600 bg-green-50';
    case 'pending': return 'text-yellow-600 bg-yellow-50';
    case 'failed': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}
