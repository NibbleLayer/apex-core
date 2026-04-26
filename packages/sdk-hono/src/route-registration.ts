const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_MAX_ROUTE_CANDIDATES = 50;

export interface RouteRegistrationCandidate {
  method: string;
  path: string;
}

export interface RouteRegistrarConfig {
  apexUrl: string;
  apiKey: string;
  heartbeatIntervalMs: number;
  maxCandidates?: number;
}

export class RouteRegistrar {
  private readonly apexUrl: string;
  private readonly apiKey: string;
  private readonly heartbeatIntervalMs: number;
  private readonly maxCandidates: number;
  private readonly candidates = new Map<string, RouteRegistrationCandidate>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RouteRegistrarConfig) {
    this.apexUrl = config.apexUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs;
    this.maxCandidates = config.maxCandidates ?? DEFAULT_MAX_ROUTE_CANDIDATES;
  }

  observe(method: string, path: string): void {
    const candidate = normalizeCandidate(method, path);
    if (!candidate) return;

    const key = candidateKey(candidate);
    if (this.candidates.has(key) || this.candidates.size >= this.maxCandidates) return;

    this.candidates.set(key, candidate);
    this.submitInBackground();
  }

  start(): void {
    if (this.timer || this.heartbeatIntervalMs <= 0) return;

    this.timer = setInterval(() => {
      this.submitInBackground();
    }, this.heartbeatIntervalMs);

    if (typeof this.timer === 'object' && 'unref' in this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private submitInBackground(): void {
    void this.submit().catch(() => {
      // Registration is best-effort; payment middleware must never be blocked by discovery failures.
    });
  }

  private async submit(): Promise<void> {
    const routes = Array.from(this.candidates.values());
    if (routes.length === 0) return;

    await fetch(`${this.apexUrl}/sdk/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ routes }),
    });
  }
}

function normalizeCandidate(method: string, path: string): RouteRegistrationCandidate | null {
  const normalizedMethod = method.toUpperCase();
  if (!SUPPORTED_METHODS.has(normalizedMethod)) return null;
  if (!path.startsWith('/')) return null;

  return { method: normalizedMethod, path };
}

function candidateKey(candidate: RouteRegistrationCandidate): string {
  return `${candidate.method} ${candidate.path}`;
}
