import { Request, Response, NextFunction } from 'express';
import { emailMock } from '../../../mocks/email/EmailServiceMock';
import { updateEmailMockConfig, getEmailMockConfig, validateEmailMockConfig } from '../../../config/mock.config';
import { JsonSuccess, BadRequestError, ApiErrorCode } from '../../../types/response.types';
import { asyncHandler } from '../../../utils/response';
import { EmailTemplate } from '../Email.types';

/**
 * Get email mock status and configuration
 * GET /email-mock/status
 */
export const getStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const config = getEmailMockConfig();

  next(
    new JsonSuccess({
      enabled: emailMock.isEnabled(),
      config,
      stats: emailMock.getStats(),
    }),
  );
});

/**
 * Update email mock configuration
 * POST /email-mock/config
 */
export const updateConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const updates = req.body;

  // Validate the updates
  const validFields = [
    'logEmails',
    'simulateDelay',
    'delayMs',
    'simulateFailures',
    'failureRate',
    'failOnEmails',
    'blockEmails',
  ];

  const invalidFields = Object.keys(updates).filter((key) => !validFields.includes(key));
  if (invalidFields.length > 0) {
    throw new BadRequestError(
      `Invalid configuration fields: ${invalidFields.join(', ')}`,
      400,
      ApiErrorCode.INVALID_PARAMETERS,
    );
  }

  // Update the configuration
  updateEmailMockConfig(updates);

  // Refresh the email mock config
  emailMock.refreshConfig();

  next(
    new JsonSuccess({
      message: 'Email mock configuration updated successfully',
      config: getEmailMockConfig(),
    }),
  );
});

/**
 * Get sent emails (for E2E testing)
 * GET /email-mock/sent
 */
export const getSentEmails = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, template, limit } = req.query;

  let emails = emailMock.getSentEmails();

  if (email && typeof email === 'string') {
    emails = emails.filter((msg) => msg.to === email);
  }

  if (template && typeof template === 'string') {
    emails = emails.filter((msg) => msg.template === template);
  }

  if (limit && typeof limit === 'string') {
    const limitNum = parseInt(limit);
    if (!isNaN(limitNum)) {
      emails = emails.slice(-limitNum);
    }
  }

  next(
    new JsonSuccess({
      emails,
      count: emails.length,
      total: emailMock.getSentEmails().length,
    }),
  );
});

/**
 * Get latest email for specific address (useful for E2E tests)
 * GET /email-mock/latest/:email
 */
export const getLatestEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.params;
  const { template } = req.query;

  let latestEmail = emailMock.getLatestEmailForAddress(email);

  if (template && latestEmail && latestEmail.template !== template) {
    const templateEmails = emailMock.getEmailsByTemplate(template as EmailTemplate).filter((msg) => msg.to === email);
    latestEmail = templateEmails.length > 0 ? templateEmails[templateEmails.length - 1] : null;
  }

  if (!latestEmail) {
    throw new BadRequestError(`No email found for ${email}`, 404, ApiErrorCode.RESOURCE_NOT_FOUND);
  }

  next(
    new JsonSuccess({
      email: latestEmail,
      found: true,
    }),
  );
});

/**
 * Clear sent emails history
 * DELETE /email-mock/clear
 */
export const clearSentEmails = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  emailMock.clearSentEmails();

  next(
    new JsonSuccess({
      message: 'Email history cleared successfully',
      cleared: true,
    }),
  );
});

/**
 * Test email sending (for E2E testing)
 * POST /email-mock/test-send
 */
export const testSendEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { to, template, variables } = req.body;

  if (!to || !template) {
    throw new BadRequestError('Missing required fields: to, template', 400, ApiErrorCode.MISSING_DATA);
  }

  if (!emailMock.isEnabled()) {
    throw new BadRequestError('Email mock is not enabled', 400, ApiErrorCode.INVALID_REQUEST);
  }

  // Send test email through the mock system
  await emailMock.sendEmail(to, `Test Email - ${template}`, template as EmailTemplate, variables || {});

  next(
    new JsonSuccess({
      message: 'Test email sent successfully',
      to,
      template,
    }),
  );
});

/**
 * Get emails by template type
 * GET /email-mock/templates/:template
 */
export const getEmailsByTemplate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { template } = req.params;
  const { limit } = req.query;

  let emails = emailMock.getEmailsByTemplate(template as EmailTemplate);

  if (limit && typeof limit === 'string') {
    const limitNum = parseInt(limit);
    if (!isNaN(limitNum)) {
      emails = emails.slice(-limitNum);
    }
  }

  next(
    new JsonSuccess({
      template,
      emails,
      count: emails.length,
    }),
  );
});

/**
 * Validate email mock configuration
 * POST /email-mock/validate-config
 */
export const validateConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const config = req.body;

  try {
    // Validate the provided config
    const validatedConfig = validateEmailMockConfig(config);

    next(
      new JsonSuccess({
        valid: true,
        message: 'Configuration is valid',
        validatedConfig,
      }),
    );
  } catch (error) {
    throw new BadRequestError(
      `Invalid configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      400,
      ApiErrorCode.VALIDATION_ERROR,
    );
  }
});

/**
 * Get available email templates
 * GET /email-mock/templates
 */
export const getAvailableTemplates = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Get all available email templates
  const templates = Object.values(EmailTemplate);

  // Get usage statistics for each template
  const stats = emailMock.getStats();

  const templateInfo = templates.map((template) => ({
    name: template,
    displayName: template.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    sentCount: stats.sentByTemplate[template] || 0,
    failedCount: stats.failedByTemplate[template] || 0,
  }));

  next(
    new JsonSuccess({
      templates: templateInfo,
      totalTemplates: templates.length,
    }),
  );
});
