import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
  sendSuccess,
  sendError,
  asyncHandler,
  asyncHandlerWithErr,
  oauthCallbackHandler,
  jwtErrorHandler,
  mongoErrorHandler,
  googleApiErrorHandler,
  apiRequestErrorHandler,
  successHandler,
  errorHandler,
  redirectHandler,
} from '../response';
import {
  ApiErrorCode,
  AuthError,
  ValidationError,
  NotFoundError,
  BadRequestError,
  ServerError,
  JsonSuccess,
  Redirect,
  CallbackCode,
} from '../../types/response.types';
import { OAuthProviders } from '../../feature/account';
import jwt from 'jsonwebtoken';
import { MongoError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';
import { GaxiosError } from 'gaxios';

// Mock Response object
const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

// Mock Request object
const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    params: {},
    query: {},
    get: vi.fn(),
    parentUrl: '',
    originalUrl: '',
    ...overrides,
  } as unknown as Request;
};

// Mock NextFunction
const createMockNext = (): NextFunction => vi.fn();

describe('Response Utils', () => {
  let mockRes: Response;
  let mockReq: Request;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRes = createMockResponse();
    mockReq = createMockRequest();
    mockNext = createMockNext();
    vi.clearAllMocks();
  });

  describe('Response Creation Functions', () => {
    it('should create success response with correct format', () => {
      const data = { id: '123', name: 'Test' };
      const result = createSuccessResponse(data);

      expect(result).toEqual({
        success: true,
        data: { id: '123', name: 'Test' },
      });
    });

    it('should create error response with correct format', () => {
      const result = createErrorResponse(ApiErrorCode.USER_NOT_FOUND, 'User not found');

      expect(result).toEqual({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    });
  });

  describe('Response Sending Functions', () => {
    it('should send success response with correct status and data', () => {
      const data = { message: 'Success' };
      sendSuccess(mockRes, 200, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Success' },
      });
    });

    it('should send error response with correct status and error', () => {
      sendError(mockRes, 404, ApiErrorCode.USER_NOT_FOUND, 'User not found');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    });
  });

  describe('Async Handler Functions', () => {
    it('should handle successful async function', async () => {
      const asyncFn = vi.fn().mockResolvedValue(undefined);
      const handler = asyncHandler(asyncFn);

      await handler(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass errors to next', async () => {
      const error = new Error('Test error');
      const asyncFn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(asyncFn);

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle sync function that throws', async () => {
      const error = new Error('Sync error');
      const syncFn = vi.fn().mockImplementation(() => {
        throw error;
      });
      const handler = asyncHandler(syncFn);

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle error handler with async function', async () => {
      const error = new Error('Original error');
      const asyncErrorFn = vi.fn().mockResolvedValue(undefined);
      const handler = asyncHandlerWithErr(asyncErrorFn);

      await handler(error, mockReq, mockRes, mockNext);

      expect(asyncErrorFn).toHaveBeenCalledWith(error, mockReq, mockRes, mockNext);
    });
  });

  describe('OAuth Callback Handler', () => {
    it('should handle successful OAuth callback', async () => {
      const successFn = vi.fn().mockResolvedValue(undefined);
      const handler = oauthCallbackHandler('/callback', CallbackCode.OAUTH_ERROR, successFn);

      await handler(mockReq, mockRes, mockNext);

      expect(successFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle OAuth callback error with provider', async () => {
      const error = new Error('OAuth failed');
      const failFn = vi.fn().mockRejectedValue(error);
      const req = createMockRequest({
        params: { provider: 'google' },
        query: { accountId: '123' },
      });
      const handler = oauthCallbackHandler('/callback', CallbackCode.OAUTH_ERROR, failFn);

      await handler(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            code: CallbackCode.OAUTH_ERROR,
            error: 'OAuth failed',
            provider: OAuthProviders.Google,
            accountId: '123',
          },
          redirectPath: '/callback',
        }),
      );
    });

    it('should handle OAuth callback error without provider', async () => {
      const error = new Error('OAuth failed');
      const failFn = vi.fn().mockRejectedValue(error);
      const handler = oauthCallbackHandler('/callback', CallbackCode.OAUTH_ERROR, failFn);

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            code: CallbackCode.OAUTH_ERROR,
            error: 'OAuth failed',
            provider: undefined,
          },
        }),
      );
    });
  });

  describe('JWT Error Handler', () => {
    it('should handle TokenExpiredError', () => {
      const error = new jwt.TokenExpiredError('Token expired', new Date());
      jwtErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'The provided token has expired',
        },
      });
    });

    it('should handle JsonWebTokenError', () => {
      const error = new jwt.JsonWebTokenError('Invalid token');
      jwtErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token',
        },
      });
    });

    it('should handle NotBeforeError', () => {
      const error = new jwt.NotBeforeError('Token not active', new Date());
      jwtErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'The token cannot be used yet (not before error)',
        },
      });
    });

    it('should pass non-JWT errors to next handler', () => {
      const error = new Error('Regular error');
      jwtErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Mongo Error Handler', () => {
    it('should handle duplicate key error (code 11000)', () => {
      const error = new MongoError('Duplicate key') as any;
      error.code = 11000;
      mongoErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RESOURCE_EXISTS',
          message: 'Resource already exists with the provided unique fields',
        },
      });
    });

    it('should handle Mongoose ValidationError', () => {
      const error = new MongooseError.ValidationError() as any;
      error.errors = {
        email: {
          message: 'Email is required',
          kind: 'required',
          path: 'email',
          value: undefined,
        },
      };
      mongoErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: {
            message: 'Schema validation failed',
            fields: {
              email: {
                message: 'Email is required',
                kind: 'required',
                path: 'email',
                value: undefined,
              },
            },
          },
        },
      });
    });

    it('should handle Mongoose CastError', () => {
      const error = new MongooseError.CastError('ObjectId', 'invalid-id', 'userId') as any;
      mongoErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: {
            message: 'Invalid userId: invalid-id',
            field: 'userId',
            value: 'invalid-id',
          },
        },
      });
    });

    it('should pass non-MongoDB errors to next handler', () => {
      const error = new Error('Regular error');
      mongoErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Google API Error Handler', () => {
    it('should handle GaxiosError with 401 status', () => {
      const error = new GaxiosError('Unauthorized', {}, {
        status: 401,
        data: { error: { message: 'Invalid credentials' } },
      } as any);
      googleApiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Invalid credentials',
        },
      });
    });

    it('should handle GaxiosError with 429 status', () => {
      const error = new GaxiosError('Rate limit exceeded', {}, {
        status: 429,
        data: { error: { message: 'Too many requests' } },
      } as any);
      googleApiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
        },
      });
    });

    it('should pass non-Gaxios errors to next handler', () => {
      const error = new Error('Regular error');
      googleApiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('API Request Error Handler', () => {
    it('should handle axios timeout error', () => {
      const error = {
        isAxiosError: true,
        code: 'ETIMEDOUT',
        message: 'Request timeout',
      };
      apiRequestErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TIMEOUT_ERROR',
          message: 'Request timeout',
        },
      });
    });

    it('should handle fetch error', () => {
      const error = {
        name: 'FetchError',
        message: 'Network error',
      };
      apiRequestErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: 'Network error',
        },
      });
    });

    it('should pass non-API errors to next handler', () => {
      const error = new Error('Regular error');
      apiRequestErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Success Handler', () => {
    it('should handle JsonSuccess response', () => {
      const jsonSuccess = new JsonSuccess({ message: 'Success' }, 201, 'Created');
      successHandler(jsonSuccess, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Success' },
      });
    });

    it('should handle direct object response', () => {
      const result = { id: '123', name: 'Test' };
      successHandler(result, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: '123', name: 'Test' },
      });
    });

    it('should handle primitive response', () => {
      const result = 'Simple string';
      successHandler(result, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: 'Simple string',
      });
    });

    it('should pass Redirect to next handler', () => {
      const redirect = new Redirect({ code: 'success' }, '/callback');
      successHandler(redirect, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(redirect);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should pass errors to next handler', () => {
      const error = new Error('Test error');
      successHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Error Handler', () => {
    it('should handle AuthError', () => {
      const error = new AuthError('Authentication failed', 401);
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      });
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Validation failed', 400);
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: { message: 'Validation failed', data: undefined },
        },
      });
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('Resource not found');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Resource not found',
        },
      });
    });

    it('should handle BadRequestError', () => {
      const error = new BadRequestError('Bad request');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_DATA',
          message: 'Bad request',
        },
      });
    });

    it('should handle ServerError', () => {
      const error = new ServerError('Internal server error');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error',
        },
      });
    });

    it('should handle generic Error', () => {
      const error = new Error('Generic error');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Generic error',
        },
      });
    });

    it('should pass Redirect to next handler', () => {
      const redirect = new Redirect({ code: 'error' }, '/error');
      errorHandler(redirect, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(redirect);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });
  });

  describe('Redirect Handler', () => {
    it('should handle Redirect response', () => {
      const redirect = new Redirect({ code: 'success' }, '/callback', 302);
      const req = createMockRequest({ get: vi.fn().mockReturnValue('') });
      redirectHandler(redirect, req, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith(302, '/callback?code=success');
    });

    it('should handle Redirect with originalUrl', () => {
      const redirect = new Redirect({ code: 'success' }, '/callback', 302, '/original');
      const req = createMockRequest({ get: vi.fn().mockReturnValue('') });
      redirectHandler(redirect, req, mockRes, mockNext);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('redirectUrl=' + encodeURIComponent('/original')),
      );
    });

    it('should pass non-Redirect to next handler', () => {
      const result = { message: 'Not a redirect' };
      redirectHandler(result, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(result);
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });
});
