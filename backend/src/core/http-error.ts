export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, field?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
    this.details = details;
  }
}
