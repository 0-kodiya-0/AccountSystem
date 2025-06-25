import { OAuthProviders } from '../feature/account/Account.types';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: T;
  };
}

export enum ApiErrorCode {
  // Existing error codes
  INVALID_STATE = 'INVALID_STATE',
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  MISSING_DATA = 'MISSING_DATA',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTH_FAILED = 'AUTH_FAILED',
  USER_EXISTS = 'USER_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  WORKSPACE_MEMBER_NOT_FOUND = 'WORKSPACE_MEMBER_NOT_FOUND',
  MISSING_EMAIL = 'MISSING_EMAIL',
  INVALID_DETAILS = 'INVALID_DETAILS',

  // New error codes for permissions and API access
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_SERVICE = 'INVALID_SERVICE',
  INVALID_SCOPE = 'INVALID_SCOPE',
  SERVER_ERROR = 'SERVER_ERROR',

  // API resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  RESOURCE_DELETED = 'RESOURCE_DELETED',

  // Rate limiting and quota errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Connection errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Token errors
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_REVOKED = 'TOKEN_REVOKED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',

  INTERNAL_ENDPOINT_NOT_FOUND = 'INTERNAL_ENDPOINT_NOT_FOUND',
}

// Base error class
export class BaseError<T> extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly data?: T,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, BaseError.prototype);
  }

  // Add this method
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.data && { data: this.data }),
    };
  }
}

export class AuthError<T> extends BaseError<T> {
  constructor(message: string, statusCode: number = 401, code: ApiErrorCode = ApiErrorCode.AUTH_FAILED, data?: T) {
    super(code, message, statusCode, data);
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class ValidationError<T> extends BaseError<T> {
  constructor(message: string, statusCode: number = 400, code: ApiErrorCode = ApiErrorCode.VALIDATION_ERROR, data?: T) {
    super(code, message, statusCode, data);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AccountValidationError<T> extends ValidationError<T> {
  constructor(message: string, statusCode: number = 400, code: ApiErrorCode = ApiErrorCode.VALIDATION_ERROR, data?: T) {
    super(message, statusCode, code, data);
    Object.setPrototypeOf(this, AccountValidationError.prototype);
  }
}

export class ChatValidationError<T> extends ValidationError<T> {
  constructor(message: string, statusCode: number = 400, code: ApiErrorCode = ApiErrorCode.VALIDATION_ERROR, data?: T) {
    super(message, statusCode, code, data);
    Object.setPrototypeOf(this, ChatValidationError.prototype);
  }
}

export class SessionValidationError<T> extends ValidationError<T> {
  constructor(message: string, statusCode: number = 400, code: ApiErrorCode = ApiErrorCode.VALIDATION_ERROR, data?: T) {
    super(message, statusCode, code, data);
    Object.setPrototypeOf(this, SessionValidationError.prototype);
  }
}

export class ProviderValidationError<T extends object> extends ValidationError<T & { provider: OAuthProviders }> {
  constructor(
    provider: OAuthProviders,
    message: string,
    statusCode: number = 400,
    code: ApiErrorCode = ApiErrorCode.VALIDATION_ERROR,
    data?: T,
  ) {
    super(message, statusCode, code, { ...(data || {}), provider } as T & {
      provider: OAuthProviders;
    });
    Object.setPrototypeOf(this, ProviderValidationError.prototype);
  }
}

export class NotFoundError<T> extends BaseError<T> {
  constructor(
    message: string,
    statusCode: number = 404,
    code: ApiErrorCode = ApiErrorCode.RESOURCE_NOT_FOUND,
    data?: T,
  ) {
    super(code, message, statusCode, data);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class BadRequestError<T> extends BaseError<T> {
  constructor(message: string, statusCode: number = 400, code: ApiErrorCode = ApiErrorCode.MISSING_DATA, data?: T) {
    super(code, message, statusCode, data);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class ServerError<T> extends BaseError<T> {
  constructor(message: string, statusCode: number = 500, code: ApiErrorCode = ApiErrorCode.SERVER_ERROR, data?: T) {
    super(code, message, statusCode, data);
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

export class Redirect<T> {
  constructor(
    public readonly data: T,
    public readonly redirectPath: string,
    public readonly statusCode: number = 302,
    public readonly originalUrl?: string,
  ) {
    Object.setPrototypeOf(this, Redirect.prototype);
  }
}

// Base success class with data type
export class BaseSuccess<T> {
  constructor(public readonly data: T, public readonly statusCode: number = 200, public readonly message: string) {
    Object.setPrototypeOf(this, BaseSuccess.prototype);
  }
}

// JSON success response
export class JsonSuccess<T> extends BaseSuccess<T> {
  constructor(data: T, statusCode: number = 200, message: string = '') {
    super(data, statusCode, message);
    Object.setPrototypeOf(this, JsonSuccess.prototype);
  }
}

export enum CallbackCode {
  // OAuth success codes
  OAUTH_SIGNIN_SUCCESS = 'oauth_signin_success',
  OAUTH_SIGNUP_SUCCESS = 'oauth_signup_success',
  OAUTH_PERMISSION_SUCCESS = 'oauth_permission_success',

  // NEW: 2FA required codes (only for signin)
  OAUTH_SIGNIN_REQUIRES_2FA = 'oauth_signin_requires_2fa',

  // Error codes
  OAUTH_ERROR = 'oauth_error',
  OAUTH_PERMISSION_ERROR = 'oauth_permission_error',
}

export interface CallbackData {
  code: CallbackCode;
  accountId?: string;
  accountIds?: string[];
  name?: string;
  provider?: OAuthProviders;
  tempToken?: string; // NEW: For 2FA flows
  service?: string;
  scopeLevel?: string;
  error?: string;
  message?: string;
  clearClientAccountState?: boolean;
  needsAdditionalScopes?: boolean;
  // Additional context data
  [key: string]: any;
}
