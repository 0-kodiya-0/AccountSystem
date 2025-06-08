import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';
import { ServerError, ValidationError } from '../../types/response.types';
import { getTemplateMetadata, getTemplateFilePath } from './Email.utils';
import { EmailTemplate } from './Email.types';
import { getAppName, getBaseUrl, getNodeEnv, getProxyUrl, getSenderEmail, getSenderName } from '../../config/env.config';
import { getTransporter, resetTransporter } from './Email.transporter';
import { logger } from '../../utils/logger';

// Template cache to avoid reading files repeatedly
const templateCache = new Map<EmailTemplate, string>();

/**
 * Load and cache HTML email templates
 */
async function loadTemplate(template: EmailTemplate): Promise<string> {
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
 * Validate template variables
 */
function validateTemplateVariables(template: EmailTemplate, variables: Record<string, string>): void {
    const metadata = getTemplateMetadata(template);
    const missingVariables = metadata.requiredVariables.filter(varName => !variables[varName]);

    if (missingVariables.length > 0) {
        throw new ValidationError(
            `Missing required variables for template ${template}: ${missingVariables.join(', ')}`
        );
    }
}

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template;

    // Replace all {{VARIABLE}} patterns with actual values
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value || '');
    });

    return result;
}

/**
 * Generate plain text version from HTML
 */
function generatePlainText(html: string, variables: Record<string, string>): string {
    // Simple HTML to text conversion
    let text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Replace template variables in plain text
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        text = text.replace(regex, value || '');
    });

    return text;
}

/**
 * Generic email sender for custom templates with type safety
 * Now throws errors instead of swallowing them
 */
export async function sendCustomEmail(
    to: string,
    subject: string,
    template: EmailTemplate,
    variables: Record<string, string>
): Promise<void> {
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
        ...variables
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
        text
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
        if (error instanceof Error && (
            error.message.includes('connection') ||
            error.message.includes('timeout') ||
            error.message.includes('ECONNRESET')
        )) {
            logger.info('Resetting transporter due to connection error');
            resetTransporter();
        }

        // Re-throw the error instead of swallowing it
        throw new ServerError(`Failed to send email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Send email verification - now throws on failure
 */
export async function sendVerificationEmail(email: string, firstName: string, token: string): Promise<void> {
    if (!email || !firstName || !token) {
        throw new ValidationError('Email, firstName, and token are required for verification email');
    }

    const verificationUrl = `${getProxyUrl()}${getBaseUrl()}/auth/verify-email?token=${token}`;

    await sendCustomEmail(
        email,
        `Verify your email address for ${getAppName()}`,
        EmailTemplate.EMAIL_VERIFICATION,
        {
            FIRST_NAME: firstName,
            VERIFICATION_URL: verificationUrl
        }
    );
}

/**
 * Send password reset email - now throws on failure
 */
export async function sendPasswordResetEmail(email: string, firstName: string, token: string): Promise<void> {
    if (!email || !firstName || !token) {
        throw new ValidationError('Email, firstName, and token are required for password reset email');
    }

    const resetUrl = `${getProxyUrl()}${getBaseUrl()}/reset-password?token=${token}`;

    await sendCustomEmail(
        email,
        `Reset your password for ${getAppName()}`,
        EmailTemplate.PASSWORD_RESET,
        {
            FIRST_NAME: firstName,
            RESET_URL: resetUrl
        }
    );
}

/**
 * Send password changed notification - now throws on failure
 */
export async function sendPasswordChangedNotification(email: string, firstName: string): Promise<void> {
    if (!email || !firstName) {
        throw new ValidationError('Email and firstName are required for password changed notification');
    }

    const now = new Date();

    await sendCustomEmail(
        email,
        `Your password was changed on ${getAppName()}`,
        EmailTemplate.PASSWORD_CHANGED,
        {
            FIRST_NAME: firstName,
            DATE: now.toLocaleDateString(),
            TIME: now.toLocaleTimeString()
        }
    );
}

/**
 * Send login notification - now throws on failure
 */
export async function sendLoginNotification(email: string, firstName: string, ipAddress: string, device: string): Promise<void> {
    if (!email || !firstName || !ipAddress || !device) {
        throw new ValidationError('Email, firstName, ipAddress, and device are required for login notification');
    }

    const now = new Date();

    await sendCustomEmail(
        email,
        `New login detected on ${getAppName()}`,
        EmailTemplate.LOGIN_NOTIFICATION,
        {
            FIRST_NAME: firstName,
            LOGIN_TIME: now.toLocaleString(),
            IP_ADDRESS: ipAddress,
            DEVICE: device
        }
    );
}

/**
 * Send two-factor authentication enabled notification - now throws on failure
 */
export async function sendTwoFactorEnabledNotification(email: string, firstName: string): Promise<void> {
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
            DATE: now.toLocaleDateString()
        }
    );
}