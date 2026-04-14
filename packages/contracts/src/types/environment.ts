export type EnvironmentMode = 'test' | 'prod';

export interface Environment {
  id: string;
  serviceId: string;
  mode: EnvironmentMode;
  network: string;
  facilitatorUrl: string;
  createdAt: Date;
  updatedAt: Date;
}
