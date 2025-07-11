/**
 * Email template names enum
 * This enum defines all available email templates and their corresponding file names
 */
export enum EmailTemplate {
  EMAIL_VERIFICATION = 'email-verification',
  EMAIL_SIGNUP_VERIFICATION = 'email-signup-verification', // NEW
  PASSWORD_RESET = 'password-reset',
  PASSWORD_CHANGED = 'password-changed',
  LOGIN_NOTIFICATION = 'login-notification',
  TWO_FACTOR_ENABLED = 'two-factor-enabled',
  WELCOME = 'welcome',
  NEWSLETTER = 'newsletter',
  ACCOUNT_SUSPENDED = 'account-suspended',
  ACCOUNT_REACTIVATED = 'account-reactivated',
  PAYMENT_CONFIRMATION = 'payment-confirmation',
  SUBSCRIPTION_EXPIRED = 'subscription-expired',
  SECURITY_ALERT = 'security-alert',
}

/**
 * Email template metadata interface
 */
export interface EmailTemplateMetadata {
  name: string;
  description: string;
  requiredVariables: string[];
  optionalVariables?: string[];
}

/**
 * Template metadata mapping
 */
export const EMAIL_TEMPLATE_METADATA: Record<EmailTemplate, EmailTemplateMetadata> = {
  [EmailTemplate.EMAIL_VERIFICATION]: {
    name: 'Email Verification',
    description: 'Template for email address verification (legacy)',
    requiredVariables: ['FIRST_NAME', 'VERIFICATION_URL'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR'],
  },
  [EmailTemplate.EMAIL_SIGNUP_VERIFICATION]: {
    name: 'Email Signup Verification',
    description: 'Template for email verification during two-step signup',
    requiredVariables: ['EMAIL', 'VERIFICATION_URL'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR'],
  },
  [EmailTemplate.PASSWORD_RESET]: {
    name: 'Password Reset',
    description: 'Template for password reset requests',
    requiredVariables: ['FIRST_NAME', 'RESET_URL'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR'],
  },
  [EmailTemplate.PASSWORD_CHANGED]: {
    name: 'Password Changed',
    description: 'Template for password change notifications',
    requiredVariables: ['FIRST_NAME', 'DATE', 'TIME'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR'],
  },
  [EmailTemplate.LOGIN_NOTIFICATION]: {
    name: 'Login Notification',
    description: 'Template for login security notifications',
    requiredVariables: ['FIRST_NAME', 'LOGIN_TIME', 'IP_ADDRESS', 'DEVICE'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR'],
  },
  [EmailTemplate.TWO_FACTOR_ENABLED]: {
    name: 'Two-Factor Authentication Enabled',
    description: 'Template for 2FA activation notifications',
    requiredVariables: ['FIRST_NAME', 'DATE'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR'],
  },
  [EmailTemplate.WELCOME]: {
    name: 'Welcome Email',
    description: 'Template for welcoming new users',
    requiredVariables: ['FIRST_NAME'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR', 'SPECIAL_OFFER'],
  },
  [EmailTemplate.NEWSLETTER]: {
    name: 'Newsletter',
    description: 'Template for newsletter emails',
    requiredVariables: ['FIRST_NAME'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR', 'NEWSLETTER_CONTENT'],
  },
  [EmailTemplate.ACCOUNT_SUSPENDED]: {
    name: 'Account Suspended',
    description: 'Template for account suspension notifications',
    requiredVariables: ['FIRST_NAME', 'SUSPENSION_REASON'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR', 'CONTACT_EMAIL'],
  },
  [EmailTemplate.ACCOUNT_REACTIVATED]: {
    name: 'Account Reactivated',
    description: 'Template for account reactivation notifications',
    requiredVariables: ['FIRST_NAME'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR'],
  },
  [EmailTemplate.PAYMENT_CONFIRMATION]: {
    name: 'Payment Confirmation',
    description: 'Template for payment confirmations',
    requiredVariables: ['FIRST_NAME', 'AMOUNT', 'TRANSACTION_ID'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR', 'RECEIPT_URL'],
  },
  [EmailTemplate.SUBSCRIPTION_EXPIRED]: {
    name: 'Subscription Expired',
    description: 'Template for subscription expiration notifications',
    requiredVariables: ['FIRST_NAME', 'EXPIRY_DATE'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR', 'RENEWAL_URL'],
  },
  [EmailTemplate.SECURITY_ALERT]: {
    name: 'Security Alert',
    description: 'Template for security-related alerts',
    requiredVariables: ['FIRST_NAME', 'ALERT_MESSAGE'],
    optionalVariables: ['APP_NAME', 'API_BASE_PATH', 'YEAR', 'ACTION_REQUIRED'],
  },
};

export interface EmailServiceConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpAppPassword: string;
  senderEmail: string;
  senderName: string;
  appName: string;
  baseUrl: string;
}

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  criticalOperation?: boolean;
}
