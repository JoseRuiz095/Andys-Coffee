export class AuthenticationError extends Error {
  constructor(message = 'Autenticación requerida.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class DuplicateError extends Error {
  public readonly type: string;
  public readonly existingId: string;

  constructor(type: string, message: string, existingId: string) {
    super(message);
    this.name = 'DuplicateError';
    this.type = type;
    this.existingId = existingId;
  }
}

/** A dependency (e.g. image storage) is not configured or not reachable: 503. */
export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/** The storage provider rejected an operation: 502. The cause is logged, not returned. */
export class StorageError extends Error {
  constructor(message = 'No se pudo guardar la imagen en el almacenamiento. Intenta de nuevo.') {
    super(message);
    this.name = 'StorageError';
  }
}
