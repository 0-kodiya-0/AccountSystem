import { EmailTemplate } from '../../feature/email/Email.types';
import { logger } from '../../utils/logger';
import { getEmailMockConfig, type EmailMockConfig } from '../../config/mock.config';
import { loadTemplate, validateTemplateVariables } from '../../feature/email';
import { getAppName } from '../../config/env.config';
import { ValidationError } from '../../types/response.types';

export interface MockEmailMessage {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  template?: EmailTemplate;
  variables?: Record<string, string>;
  timestamp: Date;
  status: 'sent' | 'failed' | 'pending';
  error?: string;

  // Enhanced metadata for testing
  metadata?: {
    // Test identification
    testId?: string;
    testName?: string;
    testSuite?: string;

    // User/Account context
    accountId?: string;
    userId?: string;
    accountType?: string;

    // Request context
    requestId?: string;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;

    // Email flow context
    emailFlow?: string; // e.g., 'signup', 'password-reset', 'login-notification'
    flowStep?: string; // e.g., 'initial', 'reminder', 'final'
    triggerReason?: string; // e.g., 'user-action', 'scheduled', 'system-event'

    // Business context
    feature?: string; // e.g., 'authentication', 'notifications', 'billing'
    action?: string; // e.g., 'create-account', 'reset-password', 'enable-2fa'

    // Testing specific
    tags?: string[]; // e.g., ['integration', 'e2e', 'regression']
    testData?: Record<string, any>; // Custom test data

    // Any additional custom fields can be added directly at this level
    [key: string]: any;
  };
}

export interface SendEmailOptions {
  metadata?: MockEmailMessage['metadata'];
}

class EmailServiceMock {
  private static instance: EmailServiceMock | null = null;
  private sentEmails: MockEmailMessage[] = [];
  private config: EmailMockConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): EmailServiceMock {
    if (!EmailServiceMock.instance) {
      EmailServiceMock.instance = new EmailServiceMock();
    }
    return EmailServiceMock.instance;
  }

  private loadConfig(): EmailMockConfig {
    return getEmailMockConfig();
  }

  isEnabled(): boolean {
    return this.config.enabled && process.env.NODE_ENV !== 'production';
  }

  refreshConfig(): void {
    this.config = this.loadConfig();
    if (this.config.logEmails) {
      logger.info('Email mock configuration refreshed', this.config);
    }
  }

  getConfig(): EmailMockConfig {
    return { ...this.config };
  }

  // Enhanced sendEmail method with metadata support
  async sendEmail(
    to: string,
    subject: string,
    template: EmailTemplate,
    variables: Record<string, string>,
    options?: SendEmailOptions,
  ): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Email mock is not enabled');
    }

    if (!to || !to.trim()) {
      throw new ValidationError('Recipient email is required');
    }
    if (!subject || !subject.trim()) {
      throw new ValidationError('Email subject is required');
    }

    // Check if email should be blocked
    if (this.config.blockEmails.includes(to)) {
      throw new Error(`Email address ${to} is blocked`);
    }

    // Check if we should simulate failure
    if (this.shouldSimulateFailure(to)) {
      const error = `Simulated email failure for ${to}`;
      this.logFailedEmail(to, subject, template, variables, error, options?.metadata);
      throw new Error(error);
    }

    // Simulate network delay
    if (this.config.simulateDelay) {
      await this.delay(this.config.delayMs);
    }

    // Generate email content using existing templates
    const { html, text } = await this.generateEmailContent(template, variables);

    const message: MockEmailMessage = {
      id: this.generateMessageId(),
      to,
      from: 'noreply@accountsystem.example.com',
      subject,
      html,
      text,
      template,
      variables,
      timestamp: new Date(),
      status: 'sent',
      metadata: options?.metadata,
    };

    this.sentEmails.push(message);

    if (this.config.logEmails) {
      logger.info(`Mock email sent: ${template} to ${to}`, {
        messageId: message.id,
        template,
        to,
        subject,
        metadata: message.metadata,
      });
    }
  }

  // Enhanced method for convenience - directly pass metadata
  async sendEmailWithMetadata(
    to: string,
    subject: string,
    template: EmailTemplate,
    variables: Record<string, string>,
    metadata: MockEmailMessage['metadata'],
  ): Promise<void> {
    return this.sendEmail(to, subject, template, variables, { metadata });
  }

  private shouldSimulateFailure(email: string): boolean {
    if (this.config.failOnEmails.includes(email)) {
      return true;
    }

    if (!this.config.simulateFailures) {
      return false;
    }

    return Math.random() < this.config.failureRate;
  }

  private logFailedEmail(
    to: string,
    subject: string,
    template: EmailTemplate,
    variables: Record<string, string>,
    error: string,
    metadata?: MockEmailMessage['metadata'],
  ): void {
    const failedMessage: MockEmailMessage = {
      id: this.generateMessageId(),
      to,
      from: 'noreply@accountsystem.example.com',
      subject,
      html: '',
      text: '',
      template,
      variables,
      timestamp: new Date(),
      status: 'failed',
      error,
      metadata,
    };

    this.sentEmails.push(failedMessage);

    if (this.config.logEmails) {
      logger.error(`Mock email failed: ${template} to ${to}`, {
        messageId: failedMessage.id,
        error,
        metadata,
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateMessageId(): string {
    return `mock_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private async generateEmailContent(
    template: EmailTemplate,
    variables: Record<string, string>,
  ): Promise<{ html: string; text: string }> {
    let htmlTemplate: string | null = '';
    try {
      htmlTemplate = await loadTemplate(template);
    } catch (error) {
      // Fallback to simple template if loading fails
      logger.warn(`Failed to load email template ${template}, using fallback`, error);

      const fallbackHtml = `
        <div>
          <h1>Mock Email - ${template}</h1>
          <p>This is a mock email for template: ${template}</p>
          <p>Variables: ${JSON.stringify(variables, null, 2)}</p>
        </div>
      `;

      let html = fallbackHtml;
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value || '');
      });

      const text = html
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return { html, text };
    }

    // Add common variables
    const allVariables = {
      APP_NAME: getAppName(),
      YEAR: new Date().getFullYear().toString(),
      ...variables,
    };

    validateTemplateVariables(template, allVariables);

    // Replace template variables with actual values
    let html = htmlTemplate;
    Object.entries(allVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value || '');
    });

    // Generate plain text version from HTML
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { html, text };
  }

  // Basic API methods for E2E testing
  getSentEmails(): MockEmailMessage[] {
    return [...this.sentEmails];
  }

  getEmailsForAddress(email: string): MockEmailMessage[] {
    return this.sentEmails.filter((msg) => msg.to === email);
  }

  getEmailsByTemplate(template: EmailTemplate): MockEmailMessage[] {
    return this.sentEmails.filter((msg) => msg.template === template);
  }

  getLatestEmailForAddress(email: string): MockEmailMessage | null {
    const emails = this.getEmailsForAddress(email);
    return emails.length > 0 ? emails[emails.length - 1] : null;
  }

  // Enhanced filtering methods using metadata
  getEmailsByMetadata(filter: {
    testId?: string;
    testName?: string;
    testSuite?: string;
    accountId?: string;
    userId?: string;
    emailFlow?: string;
    flowStep?: string;
    feature?: string;
    action?: string;
    tags?: string[];
    [key: string]: any; // Support for custom fields
  }): MockEmailMessage[] {
    return this.sentEmails.filter((email) => {
      if (!email.metadata) return false;

      // Check each filter criteria
      if (filter.testId && email.metadata.testId !== filter.testId) return false;
      if (filter.testName && email.metadata.testName !== filter.testName) return false;
      if (filter.testSuite && email.metadata.testSuite !== filter.testSuite) return false;
      if (filter.accountId && email.metadata.accountId !== filter.accountId) return false;
      if (filter.userId && email.metadata.userId !== filter.userId) return false;
      if (filter.emailFlow && email.metadata.emailFlow !== filter.emailFlow) return false;
      if (filter.flowStep && email.metadata.flowStep !== filter.flowStep) return false;
      if (filter.feature && email.metadata.feature !== filter.feature) return false;
      if (filter.action && email.metadata.action !== filter.action) return false;

      // Check tags (if any of the filter tags exist in email tags)
      if (filter.tags && filter.tags.length > 0) {
        if (!email.metadata.tags || !filter.tags.some((tag) => email.metadata.tags!.includes(tag))) {
          return false;
        }
      }

      // Check custom fields
      for (const [key, value] of Object.entries(filter)) {
        if (
          [
            'testId',
            'testName',
            'testSuite',
            'accountId',
            'userId',
            'emailFlow',
            'flowStep',
            'feature',
            'action',
            'tags',
          ].includes(key)
        ) {
          continue; // Skip already handled fields
        }
        if (email.metadata[key] !== value) return false;
      }

      return true;
    });
  }

  // Get emails by test context
  getEmailsByTestContext(testId?: string, testName?: string, testSuite?: string): MockEmailMessage[] {
    return this.getEmailsByMetadata({ testId, testName, testSuite });
  }

  // Get emails by user/account context
  getEmailsByUserContext(accountId?: string, userId?: string): MockEmailMessage[] {
    return this.getEmailsByMetadata({ accountId, userId });
  }

  // Get emails by flow context
  getEmailsByFlow(emailFlow: string, flowStep?: string): MockEmailMessage[] {
    return this.getEmailsByMetadata({ emailFlow, flowStep });
  }

  // Get emails by feature/action
  getEmailsByFeature(feature: string, action?: string): MockEmailMessage[] {
    return this.getEmailsByMetadata({ feature, action });
  }

  // Get emails by tags
  getEmailsByTags(tags: string[]): MockEmailMessage[] {
    return this.getEmailsByMetadata({ tags });
  }

  // Get latest email with metadata filter
  getLatestEmailByMetadata(filter: Parameters<EmailServiceMock['getEmailsByMetadata']>[0]): MockEmailMessage | null {
    const emails = this.getEmailsByMetadata(filter);
    return emails.length > 0 ? emails[emails.length - 1] : null;
  }

  // Clear all emails
  clearSentEmails(): void {
    this.sentEmails = [];
    if (this.config.logEmails) {
      logger.info('Mock email history cleared');
    }
  }

  // Clear emails by metadata filter
  clearEmailsByMetadata(filter: Parameters<EmailServiceMock['getEmailsByMetadata']>[0]): number {
    const emailsToRemove = this.getEmailsByMetadata(filter);
    const countToRemove = emailsToRemove.length;

    // Remove emails that match the filter
    this.sentEmails = this.sentEmails.filter((email) => !emailsToRemove.includes(email));

    if (this.config.logEmails && countToRemove > 0) {
      logger.info(`Cleared ${countToRemove} emails matching metadata filter`, filter);
    }

    return countToRemove;
  }

  getStats(): {
    totalSent: number;
    totalFailed: number;
    sentByTemplate: Record<string, number>;
    failedByTemplate: Record<string, number>;
    recentEmails: MockEmailMessage[];
    // Enhanced stats with metadata breakdowns
    byMetadata: {
      byTestSuite: Record<string, number>;
      byEmailFlow: Record<string, number>;
      byFeature: Record<string, number>;
      byAction: Record<string, number>;
      byTags: Record<string, number>;
    };
  } {
    const sentEmails = this.sentEmails.filter((email) => email.status === 'sent');
    const failedEmails = this.sentEmails.filter((email) => email.status === 'failed');

    const stats = {
      totalSent: sentEmails.length,
      totalFailed: failedEmails.length,
      sentByTemplate: {} as Record<string, number>,
      failedByTemplate: {} as Record<string, number>,
      recentEmails: this.sentEmails.slice(-10), // Last 10 emails
      byMetadata: {
        byTestSuite: {} as Record<string, number>,
        byEmailFlow: {} as Record<string, number>,
        byFeature: {} as Record<string, number>,
        byAction: {} as Record<string, number>,
        byTags: {} as Record<string, number>,
      },
    };

    // Existing template stats
    sentEmails.forEach((email) => {
      if (email.template) {
        stats.sentByTemplate[email.template] = (stats.sentByTemplate[email.template] || 0) + 1;
      }
    });

    failedEmails.forEach((email) => {
      if (email.template) {
        stats.failedByTemplate[email.template] = (stats.failedByTemplate[email.template] || 0) + 1;
      }
    });

    // Metadata stats
    this.sentEmails.forEach((email) => {
      if (email.metadata) {
        // Test suite stats
        if (email.metadata.testSuite) {
          stats.byMetadata.byTestSuite[email.metadata.testSuite] =
            (stats.byMetadata.byTestSuite[email.metadata.testSuite] || 0) + 1;
        }

        // Email flow stats
        if (email.metadata.emailFlow) {
          stats.byMetadata.byEmailFlow[email.metadata.emailFlow] =
            (stats.byMetadata.byEmailFlow[email.metadata.emailFlow] || 0) + 1;
        }

        // Feature stats
        if (email.metadata.feature) {
          stats.byMetadata.byFeature[email.metadata.feature] =
            (stats.byMetadata.byFeature[email.metadata.feature] || 0) + 1;
        }

        // Action stats
        if (email.metadata.action) {
          stats.byMetadata.byAction[email.metadata.action] =
            (stats.byMetadata.byAction[email.metadata.action] || 0) + 1;
        }

        // Tags stats
        if (email.metadata.tags) {
          email.metadata.tags.forEach((tag) => {
            stats.byMetadata.byTags[tag] = (stats.byMetadata.byTags[tag] || 0) + 1;
          });
        }
      }
    });

    return stats;
  }
}

export const emailMock = EmailServiceMock.getInstance();
