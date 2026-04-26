export type ServiceDomainStatus = 'pending' | 'verified' | 'failed';
export type ServiceDomainVerificationMethod = 'dns_txt';

export interface ServiceDomain {
  id: string;
  organizationId: string;
  serviceId: string;
  domain: string;
  verificationToken: string;
  verificationMethod: ServiceDomainVerificationMethod;
  status: ServiceDomainStatus;
  dnsRecordName: string;
  dnsRecordValue: string;
  verifiedAt?: string | null;
  lastCheckedAt?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateServiceDomainRequest {
  domain: string;
}

export interface ServiceDomainVerificationResult {
  success: boolean;
  reason?: string;
  dnsRecordName: string;
  dnsRecordValue: string;
}
