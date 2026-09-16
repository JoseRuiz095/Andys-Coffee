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
