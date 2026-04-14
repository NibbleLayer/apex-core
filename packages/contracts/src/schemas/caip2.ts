import { z } from 'zod';

export const caip2Network = z.string().regex(
  /^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/,
  'Must be a valid CAIP-2 identifier (e.g., eip155:84532)'
);
