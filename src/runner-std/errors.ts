/**
 * Shared Error Envelope
 *
 * Standard error schema used across all runners:
 *   code, message, userMessage, retryable, cause, context
 *
 * Exit codes:
 *   0 - success
 *   2 - validation error
 *   3 - external dependency failure
 *   4 - unexpected bug
 */

export interface ErrorEnvelope {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  cause?: string;
  context?: Record<string, unknown>;
}

export const EXIT_SUCCESS = 0;
export const EXIT_VALIDATION = 2;
export const EXIT_DEPENDENCY = 3;
export const EXIT_BUG = 4;

export class RunnerError extends Error {
  readonly envelope: ErrorEnvelope;
  readonly exitCode: number;

  constructor(envelope: ErrorEnvelope, exitCode: number) {
    super(envelope.message);
    this.name = 'RunnerError';
    this.envelope = envelope;
    this.exitCode = exitCode;
  }
}

export function validationError(
  message: string,
  context?: Record<string, unknown>
): RunnerError {
  return new RunnerError(
    {
      code: 'VALIDATION_ERROR',
      message,
      userMessage: `Input validation failed: ${message}`,
      retryable: false,
      context,
    },
    EXIT_VALIDATION
  );
}

export function dependencyError(
  message: string,
  cause?: string,
  context?: Record<string, unknown>
): RunnerError {
  return new RunnerError(
    {
      code: 'DEPENDENCY_FAILURE',
      message,
      userMessage: 'An external dependency is unavailable. Retry may help.',
      retryable: true,
      cause,
      context,
    },
    EXIT_DEPENDENCY
  );
}

export function bugError(
  message: string,
  cause?: string,
  context?: Record<string, unknown>
): RunnerError {
  return new RunnerError(
    {
      code: 'UNEXPECTED_BUG',
      message,
      userMessage: 'An unexpected error occurred. Please report this.',
      retryable: false,
      cause,
      context,
    },
    EXIT_BUG
  );
}

export function toErrorEnvelope(error: unknown): ErrorEnvelope {
  if (error instanceof RunnerError) {
    return error.envelope;
  }

  if (error instanceof Error && error.name === 'ZodError') {
    const zodError = error as Error & { errors?: Array<{ path: string[]; message: string }> };
    return {
      code: 'VALIDATION_ERROR',
      message: zodError.message,
      userMessage: `Validation failed: ${(zodError.errors ?? []).map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      retryable: false,
      context: { errors: zodError.errors },
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNEXPECTED_BUG',
      message: error.message,
      userMessage: 'An unexpected error occurred.',
      retryable: false,
      cause: error.stack,
    };
  }

  return {
    code: 'UNEXPECTED_BUG',
    message: String(error),
    userMessage: 'An unexpected error occurred.',
    retryable: false,
  };
}

export function exitCodeForError(error: unknown): number {
  if (error instanceof RunnerError) {
    return error.exitCode;
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return EXIT_VALIDATION;
  }
  return EXIT_BUG;
}
