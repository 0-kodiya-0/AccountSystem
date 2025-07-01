import express from 'express';
import * as EmailMockController from './Email.mock.controller';

export const emailMockRouter = express.Router();

/**
 * Service Information & Health
 */

/**
 * @route GET /mock/email/status
 * @desc Get email mock status and configuration
 * @access Public (development/test only)
 */
emailMockRouter.get('/status', EmailMockController.getStatus);

/**
 * Configuration Management
 */

/**
 * @route POST /mock/email/config
 * @desc Update email mock configuration
 * @access Public (development/test only)
 * @body { logEmails?: boolean, simulateDelay?: boolean, delayMs?: number, simulateFailures?: boolean, failureRate?: number, failOnEmails?: string[], blockEmails?: string[] }
 */
emailMockRouter.post('/config', EmailMockController.updateConfig);

/**
 * @route POST /mock/email/validate-config
 * @desc Validate email mock configuration
 * @access Public (development/test only)
 * @body MockConfiguration object to validate
 */
emailMockRouter.post('/validate-config', EmailMockController.validateConfig);

/**
 * Email Management & Retrieval
 */

/**
 * @route GET /mock/email/sent
 * @desc Get sent emails (for E2E testing)
 * @access Public (development/test only)
 * @query email - Filter by recipient email
 * @query template - Filter by email template
 * @query limit - Limit number of results
 */
emailMockRouter.get('/sent', EmailMockController.getSentEmails);

/**
 * @route GET /mock/email/latest/:email
 * @desc Get latest email for specific address (useful for E2E tests)
 * @access Public (development/test only)
 * @param email - Recipient email address
 * @query template - Filter by specific template type
 */
emailMockRouter.get('/latest/:email', EmailMockController.getLatestEmail);

/**
 * @route DELETE /mock/email/clear
 * @desc Clear sent emails history
 * @access Public (development/test only)
 */
emailMockRouter.delete('/clear', EmailMockController.clearSentEmails);

/**
 * @route GET /mock/email/templates
 * @desc Get available email templates with usage statistics
 * @access Public (development/test only)
 */
emailMockRouter.get('/templates', EmailMockController.getAvailableTemplates);

/**
 * @route GET /mock/email/templates/:template
 * @desc Get emails by template type
 * @access Public (development/test only)
 * @param template - Email template name
 * @query limit - Limit number of results
 */
emailMockRouter.get('/templates/:template', EmailMockController.getEmailsByTemplate);

/**
 * Testing & Development
 */

/**
 * @route POST /mock/email/test-send
 * @desc Test email sending (for E2E testing)
 * @access Public (development/test only)
 * @body { to: string, template: string, variables?: Record<string, string> }
 */
emailMockRouter.post('/test-send', EmailMockController.testSendEmail);
