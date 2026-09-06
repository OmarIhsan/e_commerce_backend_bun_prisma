// Custom domain error hierarchy for clean HTTP error mapping

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Requested resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class InsufficientStockError extends AppError {
  constructor(
    public readonly productId: string,
    public readonly requested: number,
    public readonly available: number,
    message?: string
  ) {
    super(
      message ??
        `Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`,
      409,
      'INSUFFICIENT_STOCK'
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}
