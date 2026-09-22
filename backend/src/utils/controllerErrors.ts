import { Response } from 'express';
import { DuplicateError } from './errors';

/**
 * Matches the response shape the frontend's duplicate-error handling depends on
 * (see frontend/src/features/inventory/api/purchases.api.ts) — do not change this
 * shape without updating that consumer too.
 */
export function sendDuplicateErrorResponse(res: Response, error: DuplicateError) {
  res.status(409).json({
    error: 'DUPLICATE_ERROR',
    message: error.message,
    details: {
      type: error.type,
      existingId: error.existingId,
    },
  });
}
