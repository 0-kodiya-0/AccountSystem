import { ApiErrorCode, ServerError, ValidationError } from '../../types/response.types';
import { logger } from '../../utils/logger';
import { EmailTemplate, EmailTemplateMetadata, EMAIL_TEMPLATE_METADATA, RetryOptions } from './Email.types';

/**
 * Validate template variables
 */
export function validateTemplateVariables(template: EmailTemplate, variables: Record<string, string>): void {
  const metadata = getTemplateMetadata(template);
  const missingVariables = metadata.requiredVariables.filter((varName) => !variables[varName]);

  if (missingVariables.length > 0) {
    throw new ValidationError(`Missing required variables for template ${template}: ${missingVariables.join(', ')}`);
  }
}

/**
 * Replace template variables with actual values
 */
export function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
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
export function generatePlainText(html: string, variables: Record<string, string>): string {
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
 * Get template metadata by template enum
 * Now throws an error for invalid templates instead of returning undefined
 */
export function getTemplateMetadata(template: EmailTemplate): EmailTemplateMetadata {
  const metadata = EMAIL_TEMPLATE_METADATA[template];

  if (!metadata) {
    throw new ServerError(`Template metadata not found for template: ${template}`, 500, ApiErrorCode.SERVER_ERROR);
  }

  return metadata;
}
/**
 * Get all available template names
 */
export function getAllTemplateNames(): EmailTemplate[] {
  return Object.values(EmailTemplate);
}

/**
 * Validate if a string is a valid template name
 */
export function isValidTemplate(templateName: string): templateName is EmailTemplate {
  return Object.values(EmailTemplate).includes(templateName as EmailTemplate);
}

/**
 * Get template file path
 */
export function getTemplateFilePath(template: EmailTemplate): string {
  return `${template}.html`;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  criticalOperation: false,
};

/**
 * Retry email sending with exponential backoff
 * @param emailFunction The email function to retry
 * @param options Retry configuration
 * @returns Promise that resolves when email is sent or rejects after all attempts fail
 */
export async function retryEmailSending<T extends any[]>(
  emailFunction: (...args: T) => Promise<void>,
  args: T,
  options: RetryOptions = {},
): Promise<void> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      await emailFunction(...args);

      if (attempt > 1) {
        logger.info(`Email sent successfully on attempt ${attempt}`);
      }

      return; // Success!
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown email error');

      logger.warn(`Email attempt ${attempt}/${config.maxAttempts} failed:`, lastError.message);

      // If this was the last attempt, don't delay
      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = config.delayMs * Math.pow(config.backoffMultiplier, attempt - 1);
      logger.info(`Retrying email in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All attempts failed
  const errorMessage = `Failed to send email after ${config.maxAttempts} attempts. Last error: ${lastError?.message}`;
  logger.error(errorMessage);

  if (config.criticalOperation) {
    throw new ServerError(errorMessage);
  } else {
    // For non-critical operations, just log and continue
    logger.warn('Non-critical email failed, continuing operation');
  }
}

/**
 * Send critical email with retry logic
 * Critical emails will throw errors if they fail after all retries
 */
export async function sendCriticalEmail<T extends any[]>(
  emailFunction: (...args: T) => Promise<void>,
  args: T,
  options: Omit<RetryOptions, 'criticalOperation'> = {},
): Promise<void> {
  return retryEmailSending(emailFunction, args, {
    ...options,
    criticalOperation: true,
  });
}

/**
 * Send non-critical email with retry logic
 * Non-critical emails will log errors but not throw
 */
export async function sendNonCriticalEmail<T extends any[]>(
  emailFunction: (...args: T) => Promise<void>,
  args: T,
  options: Omit<RetryOptions, 'criticalOperation'> = {},
): Promise<void> {
  return retryEmailSending(emailFunction, args, {
    ...options,
    criticalOperation: false,
  });
}
