// The capture seam. Both providers emit the same raw signals through RawHooks;
// scan.ts owns classification + scoring, so providers stay thin and swappable.

export interface RawRequest {
  url: string;
  resourceType: string;
}

export interface RawCookie {
  name: string;
  domain: string;
}

export interface RawHooks {
  onSiteResolved(finalUrl: string, title: string | null): void;
  onRequest(r: RawRequest): void;
  onFingerprint(api: string): void;
  onCookie(c: RawCookie): void;
  onStatus(level: "info" | "warn" | "error", message: string): void;
}

export interface CaptureOpts {
  deadlineMs: number;
  signal: AbortSignal;
}

export interface CaptureProvider {
  name: string;
  capture(url: string, hooks: RawHooks, opts: CaptureOpts): Promise<void>;
}
