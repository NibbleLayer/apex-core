export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Route {
  id: string;
  serviceId: string;
  method: HttpMethod;
  path: string;
  description: string | null;
  enabled: boolean;
}
