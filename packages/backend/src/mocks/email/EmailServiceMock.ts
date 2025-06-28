import { EmailTemplate } from '../../feature/email/Email.types';
import { logger } from '../../utils/logger';
import { getEmailMockConfig, type EmailMockConfig } from '../../config/mock.config';
import { loadTemplate } from '../../feature/email';

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
    return this.config.enabled;
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

  async sendEmail(
    to: string,
    subject: string,
    template: EmailTemplate,
    variables: Record<string, string>,
  ): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Email mock is not enabled');
    }

    // Refresh config in case it was updated
    this.refreshConfig();

    // Check if email should be blocked
    if (this.config.blockEmails.includes(to)) {
      throw new Error(`Email address ${to} is blocked`);
    }

    // Check if we should simulate failure
    if (this.shouldSimulateFailure(to)) {
      const error = `Simulated email failure for ${to}`;
      this.logFailedEmail(to, subject, template, variables, error);
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
    };

    this.sentEmails.push(message);

    if (this.config.logEmails) {
      logger.info(`Mock email sent: ${template} to ${to}`, {
        messageId: message.id,
        template,
        to,
        subject,
      });
    }
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
    };

    this.sentEmails.push(failedMessage);

    if (this.config.logEmails) {
      logger.error(`Mock email failed: ${template} to ${to}`, {
        messageId: failedMessage.id,
        error,
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
    try {
      const htmlTemplate = await loadTemplate(template);

      // Add common variables
      const allVariables = {
        APP_NAME: 'AccountSystem',
        YEAR: new Date().getFullYear().toString(),
        ...variables,
      };

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
  }

  // API methods for E2E testing
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

  clearSentEmails(): void {
    this.sentEmails = [];
    if (this.config.logEmails) {
      logger.info('Mock email history cleared');
    }
  }

  getStats(): {
    totalSent: number;
    totalFailed: number;
    sentByTemplate: Record<string, number>;
    failedByTemplate: Record<string, number>;
    recentEmails: MockEmailMessage[];
  } {
    const sentEmails = this.sentEmails.filter((email) => email.status === 'sent');
    const failedEmails = this.sentEmails.filter((email) => email.status === 'failed');

    const stats = {
      totalSent: sentEmails.length,
      totalFailed: failedEmails.length,
      sentByTemplate: {} as Record<string, number>,
      failedByTemplate: {} as Record<string, number>,
      recentEmails: this.sentEmails.slice(-10), // Last 10 emails
    };

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

    return stats;
  }
}

export const emailMock = EmailServiceMock.getInstance();
