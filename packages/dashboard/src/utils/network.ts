const NETWORK_LABELS: Record<string, string> = {
  'eip155:8453': 'Base',
  'eip155:84532': 'Base Sepolia',
  'eip155:1': 'Ethereum',
  'eip155:11155111': 'Sepolia',
};

export function networkLabel(caip2: string): string {
  return NETWORK_LABELS[caip2] || caip2;
}

export function networkColor(caip2: string): string {
  if (caip2.includes('84532')) return 'text-yellow-600'; // testnet
  if (caip2.includes('8453')) return 'text-blue-600'; // mainnet
  return 'text-gray-600';
}
