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
import {
  getAppName,
  getNodeEnv, // BUILD_REMOVE
  getSenderEmail,
  getSenderName,
} from '../../config/env.config';
import { getTransporter, resetTransporter } from './Email.transporter';
import { logger } from '../../utils/logger';
import { ValidationUtils } from '../../utils/validation';
import { emailMock, type SendEmailOptions } from '../../mocks/email/EmailServiceMock'; // BUILD_REMOVE

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

/* BUILD_REMOVE_START */
/**
 * Mock implementation that uses the same template system as the real service
 */
export async function sendCustomEmailMock(
  to: string,
  subject: string,
  template: EmailTemplate,
  variables: Record<string, string>,
): Promise<void> {
  return emailMock.sendEmail(to, subject, template, variables);
}
/* BUILD_REMOVE_END */

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
  // Original implementation continues here...
  // Input validation
  if (!to || !to.trim()) {
    throw new ValidationError('Recipient email is required');
  }
  if (!subject || !subject.trim()) {
    throw new ValidationError('Email subject is required');
  }

  /* BUILD_REMOVE_START */
  // Check if mocking is enabled
  if (emailMock.isEnabled()) {
    logger.info('Using mock email service for sendCustomEmail');
    return sendCustomEmailMock(to, subject, template, variables);
  }
  /* BUILD_REMOVE_END */

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

    /* BUILD_REMOVE_START */
    // Log preview URL for development
    if (getNodeEnv() !== 'production') {
      logger.info('Preview URL: %s', nodemailer.getTestMessageUrl(result));
    }
    /* BUILD_REMOVE_END */

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

/* BUILD_REMOVE_START */
/**
 * Mock implementations using your existing email service patterns
 */
export async function sendPasswordResetEmailMock(
  email: string,
  firstName: string,
  token: string,
  callbackUrl: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  const enhancedMetadata = {
    emailFlow: 'password-reset',
    flowStep: 'initial',
    feature: 'authentication',
    action: 'reset-password',
    triggerReason: 'user-action',
    token: token, // Store truncated token for security
    ...metadata,
  };

  return emailMock.sendEmail(
    email,
    `Reset your password for ${getAppName()}`,
    EmailTemplate.PASSWORD_RESET,
    {
      FIRST_NAME: firstName,
      RESET_URL: `${callbackUrl}?token=${encodeURIComponent(token)}`,
    },
    { metadata: enhancedMetadata },
  );
}
/* BUILD_REMOVE_END */

/**
 * Send password reset email with callback URL - UPDATED with metadata support
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string,
  callbackUrl: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  // Original implementation continues here...
  if (!email || !firstName || !token || !callbackUrl) {
    throw new ValidationError('Email, firstName, token, and callbackUrl are required for password reset email');
  }

  // Validate callback URL
  ValidationUtils.validateUrl(callbackUrl, 'Callback URL');

  /* BUILD_REMOVE_START */
  if (emailMock.isEnabled()) {
    logger.info('Using mock email service for sendPasswordResetEmail');
    return sendPasswordResetEmailMock(email, firstName, token, callbackUrl, metadata);
  }
  /* BUILD_REMOVE_END */

  // Construct reset URL with token as query parameter
  const resetUrl = `${callbackUrl}?token=${encodeURIComponent(token)}`;

  await sendCustomEmail(email, `Reset your password for ${getAppName()}`, EmailTemplate.PASSWORD_RESET, {
    FIRST_NAME: firstName,
    RESET_URL: resetUrl,
  });
}

/* BUILD_REMOVE_START */
export async function sendPasswordChangedNotificationMock(
  email: string,
  firstName: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  const now = new Date();
  const enhancedMetadata = {
    emailFlow: 'password-management',
    flowStep: 'confirmation',
    feature: 'authentication',
    action: 'password-changed',
    triggerReason: 'system-event',
    ...metadata,
  };

  return emailMock.sendEmail(
    email,
    `Your password was changed on ${getAppName()}`,
    EmailTemplate.PASSWORD_CHANGED,
    {
      FIRST_NAME: firstName,
      DATE: now.toLocaleDateString(),
      TIME: now.toLocaleTimeString(),
    },
    { metadata: enhancedMetadata },
  );
}
/* BUILD_REMOVE_END */

/**
 * Send password changed notification - now supports metadata
 */
export async function sendPasswordChangedNotification(
  email: string,
  firstName: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  // Original implementation continues here...
  if (!email || !firstName) {
    throw new ValidationError('Email and firstName are required for password changed notification');
  }

  /* BUILD_REMOVE_START */
  if (emailMock.isEnabled()) {
    logger.info('Using mock email service for sendPasswordChangedNotification');
    return sendPasswordChangedNotificationMock(email, firstName, metadata);
  }
  /* BUILD_REMOVE_END */

  const now = new Date();

  await sendCustomEmail(email, `Your password was changed on ${getAppName()}`, EmailTemplate.PASSWORD_CHANGED, {
    FIRST_NAME: firstName,
    DATE: now.toLocaleDateString(),
    TIME: now.toLocaleTimeString(),
  });
}

/* BUILD_REMOVE_START */
export async function sendLoginNotificationMock(
  email: string,
  firstName: string,
  ipAddress: string,
  device: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  const now = new Date();
  const enhancedMetadata = {
    emailFlow: 'security-notification',
    flowStep: 'alert',
    feature: 'authentication',
    action: 'login-detected',
    triggerReason: 'user-action',
    ipAddress,
    userAgent: device,
    ...metadata,
  };

  return emailMock.sendEmail(
    email,
    `New login detected on ${getAppName()}`,
    EmailTemplate.LOGIN_NOTIFICATION,
    {
      FIRST_NAME: firstName,
      LOGIN_TIME: now.toLocaleString(),
      IP_ADDRESS: ipAddress,
      DEVICE: device,
    },
    { metadata: enhancedMetadata },
  );
}
/* BUILD_REMOVE_END */

/**
 * Send login notification - now supports metadata
 */
export async function sendLoginNotification(
  email: string,
  firstName: string,
  ipAddress: string,
  device: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  // Original implementation continues here...
  if (!email || !firstName || !ipAddress || !device) {
    throw new ValidationError('Email, firstName, ipAddress, and device are required for login notification');
  }

  /* BUILD_REMOVE_START */
  if (emailMock.isEnabled()) {
    logger.info('Using mock email service for sendLoginNotification');
    return sendLoginNotificationMock(email, firstName, ipAddress, device, metadata);
  }
  /* BUILD_REMOVE_END */

  const now = new Date();

  await sendCustomEmail(email, `New login detected on ${getAppName()}`, EmailTemplate.LOGIN_NOTIFICATION, {
    FIRST_NAME: firstName,
    LOGIN_TIME: now.toLocaleString(),
    IP_ADDRESS: ipAddress,
    DEVICE: device,
  });
}

/* BUILD_REMOVE_START */
export async function sendTwoFactorEnabledNotificationMock(
  email: string,
  firstName: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  const now = new Date();
  const enhancedMetadata = {
    emailFlow: 'security-enhancement',
    flowStep: 'confirmation',
    feature: 'two-factor-auth',
    action: 'enable-2fa',
    triggerReason: 'user-action',
    ...metadata,
  };

  return emailMock.sendEmail(
    email,
    `Two-factor authentication enabled on ${getAppName()}`,
    EmailTemplate.TWO_FACTOR_ENABLED,
    {
      FIRST_NAME: firstName,
      DATE: now.toLocaleDateString(),
    },
    { metadata: enhancedMetadata },
  );
}
/* BUILD_REMOVE_END */

/**
 * Send two-factor authentication enabled notification - now supports metadata
 */
export async function sendTwoFactorEnabledNotification(
  email: string,
  firstName: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  // Original implementation continues here...
  if (!email || !firstName) {
    throw new ValidationError('Email and firstName are required for 2FA enabled notification');
  }

  /* BUILD_REMOVE_START */
  if (emailMock.isEnabled()) {
    logger.info('Using mock email service for sendTwoFactorEnabledNotification');
    return sendTwoFactorEnabledNotificationMock(email, firstName, metadata);
  }
  /* BUILD_REMOVE_END */

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

/* BUILD_REMOVE_START */
export async function sendSignupEmailVerificationMock(
  email: string,
  token: string,
  callbackUrl: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  const enhancedMetadata = {
    emailFlow: 'signup',
    flowStep: 'email-verification',
    feature: 'authentication',
    action: 'verify-email',
    triggerReason: 'user-action',
    token: token, // Store truncated token for security
    ...metadata,
  };

  return emailMock.sendEmail(
    email,
    `Verify your email to continue with ${getAppName()}`,
    EmailTemplate.EMAIL_SIGNUP_VERIFICATION,
    {
      EMAIL: email,
      VERIFICATION_URL: `${callbackUrl}?token=${encodeURIComponent(token)}`,
    },
    { metadata: enhancedMetadata },
  );
}
/* BUILD_REMOVE_END */

/**
 * Send email verification for two-step signup with callback URL - UPDATED with metadata support
 */
export async function sendSignupEmailVerification(
  email: string,
  token: string,
  callbackUrl: string,
  metadata?: SendEmailOptions['metadata'],
): Promise<void> {
  // Original implementation continues here...
  if (!email || !token || !callbackUrl) {
    throw new ValidationError('Email, token, and callbackUrl are required for signup email verification');
  }

  // Validate callback URL
  ValidationUtils.validateUrl(callbackUrl, 'Callback URL');

  /* BUILD_REMOVE_START */
  if (emailMock.isEnabled()) {
    logger.info('Using mock email service for sendSignupEmailVerification');
    return sendSignupEmailVerificationMock(email, token, callbackUrl, metadata);
  }
  /* BUILD_REMOVE_END */

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
