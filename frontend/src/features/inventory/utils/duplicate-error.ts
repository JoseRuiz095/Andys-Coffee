import type { DuplicateErrorResponse } from '../api/purchases.api';

export function isDuplicateError(error: any): error is { response: { status: number; data: DuplicateErrorResponse } } {
  return (
    error?.response?.status === 409 &&
    error?.response?.data?.error === 'DUPLICATE_ERROR' &&
    error?.response?.data?.details?.type &&
    error?.response?.data?.details?.existingId
  );
}

export function getDuplicateErrorMessage(error: any): string | null {
  if (isDuplicateError(error)) {
    const { type, existingId } = error.response.data.details;
    return `Ya existe un ${type === 'SUPPLIER' ? 'proveedor' : 'ingrediente'} con este nombre (ID: ${existingId}). ¿Deseas usarlo en lugar de crear uno nuevo?`;
  }
  return null;
}

export function getExistingIdFromDuplicateError(error: any): string | null {
  if (isDuplicateError(error)) {
    return error.response.data.details.existingId;
  }
  return null;
}
