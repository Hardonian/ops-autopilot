declare module '@autopilot/jobforge-client' {
  export interface ValidationError {
    path: string;
    message: string;
    code: string;
  }

  export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
  }

  export function validateRequest(request: unknown): ValidationResult;
  export function validateBatch(batch: unknown): ValidationResult;
}
