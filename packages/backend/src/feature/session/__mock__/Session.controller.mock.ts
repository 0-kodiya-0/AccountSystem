import { Request, Response, NextFunction } from 'express';
import { JsonSuccess } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import * as SessionMockService from './Session.service.mock';

/**
 * Get session mock status and information
 * GET /mock/session/status
 */
export const getSessionMockStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const status = SessionMockService.getSessionMockStatusData(req);
  next(new JsonSuccess(status));
});

/**
 * Create a mock session token
 * POST /mock/session/create
 */
export const createMockSessionToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = SessionMockService.createMockSession(req, res, req.body);
  next(new JsonSuccess(result));
});

/**
 * Update session token (add/remove accounts, change current account)
 * PUT /mock/session/update
 */
export const updateMockSessionToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = SessionMockService.updateMockSession(req, res, req.body);
  next(new JsonSuccess(result));
});

/**
 * Validate session token
 * POST /mock/session/validate
 */
export const validateMockSessionToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = SessionMockService.validateMockSessionToken(req.body.token);
  next(new JsonSuccess(result));
});

/**
 * Clear session (remove session cookie)
 * DELETE /mock/session/clear
 */
export const clearMockSession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = SessionMockService.clearMockSessionData(req, res);
  next(new JsonSuccess(result));
});

/**
 * Generate multiple mock sessions for testing
 * POST /mock/session/generate
 */
export const generateMockSessions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = SessionMockService.generateMockSessions(req.body);
  next(new JsonSuccess(result));
});

/**
 * Simulate session corruption/invalid states
 * POST /mock/session/corrupt
 */
export const corruptMockSession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = SessionMockService.corruptMockSessionData(req, res, req.body);
  next(new JsonSuccess(result));
});

/**
 * Get session statistics and information
 * GET /mock/session/info
 */
export const getSessionMockInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = SessionMockService.getSessionMockInfo(req);
  next(new JsonSuccess(result));
});
