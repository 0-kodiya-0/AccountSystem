import { Request, Response, NextFunction } from 'express';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import { EmailTemplate } from '../Email.types';
import * as EmailMockService from './Email.service.mock';

/**
 * Get email mock status and configuration
 * GET /mock/email/status
 */
export const getStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const status = EmailMockService.getStatus();
  next(new JsonSuccess(status));
});

/**
 * Get sent emails with enhanced filtering
 * GET /mock/email/sent
 */
export const getSentEmails = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    email,
    template,
    limit,
    // Metadata filters
    testId,
    testName,
    testSuite,
    accountId,
    userId,
    emailFlow,
    flowStep,
    feature,
    action,
    tags,
    ...customFilters
  } = req.query;

  const filters = {
    email: email as string,
    template: template as EmailTemplate,
    limit: limit ? parseInt(limit as string) : undefined,
    metadata: {
      testId: testId as string,
      testName: testName as string,
      testSuite: testSuite as string,
      accountId: accountId as string,
      userId: userId as string,
      emailFlow: emailFlow as string,
      flowStep: flowStep as string,
      feature: feature as string,
      action: action as string,
      tags: tags ? (tags as string).split(',').map((tag) => tag.trim()) : undefined,
      ...customFilters,
    },
  };

  const result = EmailMockService.getSentEmails(filters);
  next(new JsonSuccess(result));
});

/**
 * Get latest email for specific address
 * GET /mock/email/latest/:email
 */
export const getLatestEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.params;
  const { template, ...metadataQuery } = req.query;

  const filters = {
    template: template as EmailTemplate,
    metadata: metadataQuery,
  };

  const result = EmailMockService.getLatestEmail(email, filters);

  if (!result.found) {
    throw new BadRequestError(`No email found for ${email}`, 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  next(new JsonSuccess(result));
});

/**
 * Clear sent emails history
 * DELETE /mock/email/clear
 */
export const clearSentEmails = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { testId, testName, testSuite, accountId, userId, emailFlow, feature, action, ...customFilters } = req.query;

  const metadataFilter = {
    testId: testId as string,
    testName: testName as string,
    testSuite: testSuite as string,
    accountId: accountId as string,
    userId: userId as string,
    emailFlow: emailFlow as string,
    feature: feature as string,
    action: action as string,
    ...customFilters,
  };

  const result = EmailMockService.clearEmails(metadataFilter);
  next(new JsonSuccess(result));
});

/**
 * Clear all emails
 * DELETE /mock/email/clear-all
 */
export const clearAllEmails = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = EmailMockService.clearAllEmails();
  next(new JsonSuccess(result));
});

/**
 * Test email sending with metadata support
 * POST /mock/email/test-send
 */
export const testSendEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { to, template, variables, metadata } = req.body;

  if (!to || !template) {
    throw new BadRequestError('Missing required fields: to, template', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = await EmailMockService.testSendEmail({
    to,
    template: template as EmailTemplate,
    variables: variables || {},
    metadata: metadata || {
      testId: `test-${Date.now()}`,
      testName: 'Manual Test Send',
      feature: 'email-testing',
      action: 'test-send',
    },
  });

  next(new JsonSuccess(result));
});

/**
 * Get emails by template type
 * GET /mock/email/templates/:template
 */
export const getEmailsByTemplate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { template } = req.params;
  const { limit, ...metadataQuery } = req.query;

  const filters = {
    limit: limit ? parseInt(limit as string) : undefined,
    metadata: metadataQuery,
  };

  const result = EmailMockService.getEmailsByTemplate(template as EmailTemplate, filters);
  next(new JsonSuccess(result));
});

/**
 * Search emails by metadata criteria
 * POST /mock/email/search
 */
export const searchEmailsByMetadata = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { filter, limit } = req.body;

  if (!filter || typeof filter !== 'object') {
    throw new BadRequestError('Filter object is required', 400, ApiErrorCode.MISSING_DATA);
  }

  const result = EmailMockService.searchByMetadata(filter, limit);
  next(new JsonSuccess(result));
});

/**
 * Get emails by test context
 * GET /mock/email/test/:testId
 */
export const getEmailsByTestId = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;
  const { limit } = req.query;

  const result = EmailMockService.getEmailsByTestContext(testId, limit ? parseInt(limit as string) : undefined);
  next(new JsonSuccess(result));
});

/**
 * Get emails by flow
 * GET /mock/email/flow/:flowName
 */
export const getEmailsByFlow = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { flowName } = req.params;
  const { flowStep, limit } = req.query;

  const result = EmailMockService.getEmailsByFlow(
    flowName,
    flowStep as string,
    limit ? parseInt(limit as string) : undefined,
  );
  next(new JsonSuccess(result));
});

/**
 * Get available email templates
 * GET /mock/email/templates
 */
export const getAvailableTemplates = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = EmailMockService.getAvailableTemplates();
  next(new JsonSuccess(result));
});

/**
 * Get enhanced statistics with metadata breakdowns
 * GET /mock/email/stats
 */
export const getEnhancedStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const stats = EmailMockService.getEnhancedStats();
  next(new JsonSuccess(stats));
});

/**
 * Get metadata insights
 * GET /mock/email/metadata/insights
 */
export const getMetadataInsights = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const insights = EmailMockService.getMetadataInsights();
  next(new JsonSuccess(insights));
});
