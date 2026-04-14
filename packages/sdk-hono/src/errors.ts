export class ApexConnectionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ApexConnectionError';
  }
}

export interface ZodIssueLike {
  readonly message: string;
  readonly path: readonly (string | number)[];
  readonly code: string;
}

export class ApexManifestValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: readonly ZodIssueLike[],
  ) {
    super(message);
    this.name = 'ApexManifestValidationError';
  }
}
