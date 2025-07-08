import express from 'express';
import * as EmailMockController from './Email.controller.mock';

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
 * @route GET /mock/email/metadata/insights
 * @desc Get metadata usage insights and analytics
 * @access Public (development/test only)
 */
emailMockRouter.get('/metadata/insights', EmailMockController.getMetadataInsights);

/**
 * Email Management & Retrieval
 */

/**
 * @route GET /mock/email/sent
 * @desc Get sent emails with enhanced filtering support
 * @access Public (development/test only)
 * @query email - Filter by recipient email
 * @query template - Filter by email template
 * @query limit - Limit number of results
 * @query testId - Filter by test ID
 * @query testName - Filter by test name
 * @query testSuite - Filter by test suite
 * @query accountId - Filter by account ID
 * @query userId - Filter by user ID
 * @query emailFlow - Filter by email flow
 * @query flowStep - Filter by flow step
 * @query feature - Filter by feature
 * @query action - Filter by action
 * @query tags - Filter by tags (comma-separated)
 * @query [custom] - Any custom metadata field
 */
emailMockRouter.get('/sent', EmailMockController.getSentEmails);

/**
 * @route GET /mock/email/latest/:email
 * @desc Get latest email for specific address with metadata filtering
 * @access Public (development/test only)
 * @param email - Recipient email address
 * @query template - Filter by specific template type
 * @query testId - Filter by test ID
 * @query testName - Filter by test name
 * @query testSuite - Filter by test suite
 * @query accountId - Filter by account ID
 * @query emailFlow - Filter by email flow
 * @query [custom] - Any custom metadata field
 */
emailMockRouter.get('/latest/:email', EmailMockController.getLatestEmail);

/**
 * @route POST /mock/email/search
 * @desc Search emails by complex metadata criteria
 * @access Public (development/test only)
 * @body { filter: MetadataFilter, limit?: number }
 */
emailMockRouter.post('/search', EmailMockController.searchEmailsByMetadata);

/**
 * @route DELETE /mock/email/clear
 * @desc Clear sent emails history with optional metadata filtering
 * @access Public (development/test only)
 * @query testId - Clear emails for specific test ID
 * @query testName - Clear emails for specific test name
 * @query testSuite - Clear emails for specific test suite
 * @query accountId - Clear emails for specific account ID
 * @query userId - Clear emails for specific user ID
 * @query emailFlow - Clear emails for specific email flow
 * @query feature - Clear emails for specific feature
 * @query action - Clear emails for specific action
 * @query [custom] - Any custom metadata field
 */
emailMockRouter.delete('/clear', EmailMockController.clearSentEmails);

/**
 * @route DELETE /mock/email/clear-all
 * @desc Clear all sent emails
 * @access Public (development/test only)
 */
emailMockRouter.delete('/clear/all', EmailMockController.clearAllEmails);

/**
 * Template Management
 */

/**
 * @route GET /mock/email/templates
 * @desc Get available email templates with usage statistics
 * @access Public (development/test only)
 */
emailMockRouter.get('/templates', EmailMockController.getAvailableTemplates);

/**
 * @route GET /mock/email/templates/:template
 * @desc Get emails by template type with metadata filtering
 * @access Public (development/test only)
 * @param template - Email template name
 * @query limit - Limit number of results
 * @query testId - Filter by test ID
 * @query accountId - Filter by account ID
 * @query emailFlow - Filter by email flow
 * @query [custom] - Any custom metadata field
 */
emailMockRouter.get('/templates/:template', EmailMockController.getEmailsByTemplate);

/**
 * Testing & Development
 */

/**
 * @route POST /mock/email/send
 * @desc Test email sending with metadata support
 * @access Public (development/test only)
 * @body {
 *   to: string,
 *   template: string,
 *   variables?: Record<string, string>,
 *   metadata?: {
 *     testId?: string,
 *     testName?: string,
 *     testSuite?: string,
 *     accountId?: string,
 *     userId?: string,
 *     emailFlow?: string,
 *     flowStep?: string,
 *     feature?: string,
 *     action?: string,
 *     tags?: string[],
 *     [key: string]: any // Custom metadata fields
 *   }
 * }
 */
emailMockRouter.post('/send', EmailMockController.testSendEmail);
