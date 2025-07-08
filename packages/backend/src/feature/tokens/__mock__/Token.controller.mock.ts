import { Request, Response, NextFunction } from 'express';
import { JsonSuccess } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import * as TokenMockService from './Token.service.mock';

/**
 * Get token mock status and information
 * GET /mock/token/status
 */
export const getTokenMockStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const status = TokenMockService.getTokenMockStatusData(req);
  next(new JsonSuccess(status));
});

/**
 * Create mock access token
 * POST /mock/token/access/create
 */
export const createMockAccessToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.createMockAccessToken(req, res, req.body);
  next(new JsonSuccess(result));
});

/**
 * Create mock refresh token
 * POST /mock/token/refresh/create
 */
export const createMockRefreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.createMockRefreshToken(req, res, req.body);
  next(new JsonSuccess(result));
});

/**
 * Validate any token
 * POST /mock/token/validate
 */
export const validateMockToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.validateMockTokenData(req.body.token);
  next(new JsonSuccess(result));
});

/**
 * Create token pair (access + refresh)
 * POST /mock/token/pair/create
 */
export const createMockTokenPair = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.createMockTokenPair(req, res, req.body);
  next(new JsonSuccess(result));
});

/**
 * Generate expired token for testing
 * POST /mock/token/expired/create
 */
export const createExpiredMockToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.createExpiredMockToken(req.body);
  next(new JsonSuccess(result));
});

/**
 * Generate malformed token for testing
 * POST /mock/token/malformed/create
 */
export const createMalformedMockToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.createMalformedMockToken(req.body);
  next(new JsonSuccess(result));
});

/**
 * Clear all token cookies for an account
 * DELETE /mock/token/clear/:accountId
 */
export const clearMockTokens = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.clearMockTokensForAccount(req, res, req.params.accountId);
  next(new JsonSuccess(result));
});

/**
 * Get detailed token information from cookies
 * GET /mock/token/info/:accountId
 */
export const getMockTokenInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.getMockTokenInfoForAccount(req, req.params.accountId);
  next(new JsonSuccess(result));
});

/**
 * Batch create tokens for multiple accounts
 * POST /mock/token/batch/create
 */
export const createBatchMockTokens = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = TokenMockService.createBatchMockTokens(req, res, req.body);
  next(new JsonSuccess(result));
});
