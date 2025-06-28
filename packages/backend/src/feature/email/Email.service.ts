import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';
import { ServerError, ValidationError } from '../../types/response.types';
import {
  getTemplateFilePath,
  generatePlainText,
  replaceTemplateVariables,
  validateTemplateVariables,
} from './Email.utils';
import { EmailTemplate } from './Email.types';
import { getAppName, getNodeEnv, getSenderEmail, getSenderName } from '../../config/env.config';
import { getTransporter, resetTransporter } from './Email.transporter';
import { logger } from '../../utils/logger';
import { ValidationUtils } from '../../utils/validation';
import {
  isEmailMockEnabled,
  sendCustomEmailMock,
  sendLoginNotificationMock,
  sendPasswordChangedNotificationMock,
  sendPasswordResetEmailMock,
  sendSignupEmailVerificationMock,
  sendTwoFactorEnabledNotificationMock,
} from './__mocks__/Email.service.mock';

// Template cache to avoid reading files repeatedly
const templateCache = new Map<EmailTemplate, string>();

/**
 * Load and cache HTML email templates
 */
export async function loadTemplate(template: EmailTemplate): Promise<string> {
  if (templateCache.has(template)) {
    return templateCache.get(template)!;
  }

  try {
    const templateFileName = getTemplateFilePath(template);
    const templatePath = path.join(process.cwd(), 'src', 'feature', 'email', 'templates', templateFileName);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    templateCache.set(template, templateContent);
    return templateContent;
  } catch (error) {
    logger.error(`Failed to load email template: ${template}`, error);
    throw new ServerError(`Email template not found: ${template}`);
  }
}
/**
 * Generic email sender for custom templates with type safety
 * Now supports mocking when EMAIL_MOCK_ENABLED=true
 */
export async function sendCustomEmail(
  to: string,
  subject: string,
  template: EmailTemplate,
  variables: Record<string, string>,
): Promise<void> {
  // Check if mocking is enabled
  if (isEmailMockEnabled()) {
    logger.info('Using mock email service for sendCustomEmail');
    return sendCustomEmailMock(to, subject, template, variables);
  }

  // Original implementation continues here...
  // Input validation
  if (!to || !to.trim()) {
    throw new ValidationError('Recipient email is required');
  }
  if (!subject || !subject.trim()) {
    throw new ValidationError('Email subject is required');
  }

  const transporter = await getTransporter();

  // Add common variables
  const allVariables = {
    APP_NAME: getAppName(),
    YEAR: new Date().getFullYear().toString(),
    ...variables,
  };

  // Validate variables
  validateTemplateVariables(template, allVariables);

  // Load and process template
  const htmlTemplate = await loadTemplate(template);
  const html = replaceTemplateVariables(htmlTemplate, allVariables);
  const text = generatePlainText(htmlTemplate, allVariables);

  // Email options
  const mailOptions = {
    from: `"${getSenderName()}" <${getSenderEmail()}>`,
    to,
    subject,
    html,
    text,
  };

  // Send email with proper error handling
  try {
    const result = await transporter.sendMail(mailOptions);

    // Log preview URL for development
    if (getNodeEnv() !== 'production') {
      logger.info('Preview URL: %s', nodemailer.getTestMessageUrl(result));
    }

    logger.info(`Email sent successfully to ${to}: ${subject}`);
  } catch (error) {
    logger.error('Failed to send email:', error);

    // If it's a connection error, reset the transporter for next attempt
    if (
      error instanceof Error &&
      (error.message.includes('connection') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET'))
    ) {
      logger.info('Resetting transporter due to connection error');
      resetTransporter();
    }

    // Re-throw the error instead of swallowing it
    throw new ServerError(`Failed to send email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Send password reset email with callback URL - UPDATED with mocking support
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string,
  callbackUrl: string,
): Promise<void> {
  if (isEmailMockEnabled()) {
    logger.info('Using mock email service for sendPasswordResetEmail');
    return sendPasswordResetEmailMock(email, firstName, token, callbackUrl);
  }

  // Original implementation continues here...
  if (!email || !firstName || !token || !callbackUrl) {
    throw new ValidationError('Email, firstName, token, and callbackUrl are required for password reset email');
  }

  // Validate callback URL
  ValidationUtils.validateUrl(callbackUrl, 'Callback URL');

  // Construct reset URL with token as query parameter
  const resetUrl = `${callbackUrl}?token=${encodeURIComponent(token)}`;

  await sendCustomEmail(email, `Reset your password for ${getAppName()}`, EmailTemplate.PASSWORD_RESET, {
    FIRST_NAME: firstName,
    RESET_URL: resetUrl,
  });
}

/**
 * Send password changed notification - now supports mocking
 */
export async function sendPasswordChangedNotification(email: string, firstName: string): Promise<void> {
  if (isEmailMockEnabled()) {
    logger.info('Using mock email service for sendPasswordChangedNotification');
    return sendPasswordChangedNotificationMock(email, firstName);
  }

  // Original implementation continues here...
  if (!email || !firstName) {
    throw new ValidationError('Email and firstName are required for password changed notification');
  }

  const now = new Date();

  await sendCustomEmail(email, `Your password was changed on ${getAppName()}`, EmailTemplate.PASSWORD_CHANGED, {
    FIRST_NAME: firstName,
    DATE: now.toLocaleDateString(),
    TIME: now.toLocaleTimeString(),
  });
}

/**
 * Send login notification - now supports mocking
 */
export async function sendLoginNotification(
  email: string,
  firstName: string,
  ipAddress: string,
  device: string,
): Promise<void> {
  if (isEmailMockEnabled()) {
    logger.info('Using mock email service for sendLoginNotification');
    return sendLoginNotificationMock(email, firstName, ipAddress, device);
  }

  // Original implementation continues here...
  if (!email || !firstName || !ipAddress || !device) {
    throw new ValidationError('Email, firstName, ipAddress, and device are required for login notification');
  }

  const now = new Date();

  await sendCustomEmail(email, `New login detected on ${getAppName()}`, EmailTemplate.LOGIN_NOTIFICATION, {
    FIRST_NAME: firstName,
    LOGIN_TIME: now.toLocaleString(),
    IP_ADDRESS: ipAddress,
    DEVICE: device,
  });
}

/**
 * Send two-factor authentication enabled notification - now supports mocking
 */
export async function sendTwoFactorEnabledNotification(email: string, firstName: string): Promise<void> {
  if (isEmailMockEnabled()) {
    logger.info('Using mock email service for sendTwoFactorEnabledNotification');
    return sendTwoFactorEnabledNotificationMock(email, firstName);
  }

  // Original implementation continues here...
  if (!email || !firstName) {
    throw new ValidationError('Email and firstName are required for 2FA enabled notification');
  }

  const now = new Date();

  await sendCustomEmail(
    email,
    `Two-factor authentication enabled on ${getAppName()}`,
    EmailTemplate.TWO_FACTOR_ENABLED,
    {
      FIRST_NAME: firstName,
      DATE: now.toLocaleDateString(),
    },
  );
}

/**
 * Send email verification for two-step signup with callback URL - UPDATED with mocking support
 */
export async function sendSignupEmailVerification(email: string, token: string, callbackUrl: string): Promise<void> {
  if (isEmailMockEnabled()) {
    logger.info('Using mock email service for sendSignupEmailVerification');
    return sendSignupEmailVerificationMock(email, token, callbackUrl);
  }

  // Original implementation continues here...
  if (!email || !token || !callbackUrl) {
    throw new ValidationError('Email, token, and callbackUrl are required for signup email verification');
  }

  // Validate callback URL
  ValidationUtils.validateUrl(callbackUrl, 'Callback URL');

  // Construct verification URL with token as query parameter
  const verificationUrl = `${callbackUrl}?token=${encodeURIComponent(token)}`;

  await sendCustomEmail(
    email,
    `Verify your email to continue with ${getAppName()}`,
    EmailTemplate.EMAIL_SIGNUP_VERIFICATION,
    {
      EMAIL: email,
      VERIFICATION_URL: verificationUrl,
    },
  );
}
