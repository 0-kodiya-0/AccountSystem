import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailTemplate } from '../Email.types';
import { emailMock } from '../../../mocks/email/EmailServiceMock';
import { updateEmailMockConfig } from '../../../config/mock.config';
import * as EmailMockService from '../__mock__/Email.service.mock';

describe('Email Mock Service', () => {
  beforeEach(() => {
    // Ensure email mock is enabled and configured
    updateEmailMockConfig({
      enabled: true,
      logEmails: false,
      simulateDelay: false,
      delayMs: 0,
      simulateFailures: false,
      failureRate: 0,
      failOnEmails: [],
      blockEmails: [],
    });
    emailMock.refreshConfig();
    emailMock.clearSentEmails();
    vi.clearAllMocks();
  });

  describe('getSentEmails', () => {
    beforeEach(async () => {
      // Set up test emails with proper required variables
      await emailMock.sendEmail(
        'user1@example.com',
        'Test 1',
        EmailTemplate.PASSWORD_RESET,
        {
          FIRST_NAME: 'User1',
          RESET_URL: 'https://example.com/reset/token1',
        },
        {
          metadata: {
            testId: 'test-001',
            testSuite: 'auth-tests',
            feature: 'authentication',
          },
        },
      );

      await emailMock.sendEmail(
        'user2@example.com',
        'Test 2',
        EmailTemplate.LOGIN_NOTIFICATION,
        {
          FIRST_NAME: 'User2',
          LOGIN_TIME: '2024-01-01 10:00:00',
          IP_ADDRESS: '192.168.1.1',
          DEVICE: 'Chrome on Windows',
        },
        {
          metadata: {
            testId: 'test-002',
            testSuite: 'security-tests',
            feature: 'notifications',
          },
        },
      );
    });

    it('should return all emails when no filters applied', () => {
      const filters = {};
      const result = EmailMockService.getSentEmails(filters);

      expect(result.emails).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.total).toBe(2);
      expect(result.appliedFilters).toEqual(filters);
    });

    it('should filter emails by recipient address', () => {
      const filters = { email: 'user1@example.com' };
      const result = EmailMockService.getSentEmails(filters);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].to).toBe('user1@example.com');
      expect(result.count).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should filter emails by template', () => {
      const filters = { template: EmailTemplate.PASSWORD_RESET };
      const result = EmailMockService.getSentEmails(filters);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].template).toBe(EmailTemplate.PASSWORD_RESET);
      expect(result.count).toBe(1);
    });

    it('should filter emails by metadata', () => {
      const filters = {
        metadata: {
          testSuite: 'auth-tests',
          feature: 'authentication',
        },
      };
      const result = EmailMockService.getSentEmails(filters);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].metadata?.testSuite).toBe('auth-tests');
      expect(result.emails[0].metadata?.feature).toBe('authentication');
    });

    it('should apply limit to results', () => {
      const filters = { limit: 1 };
      const result = EmailMockService.getSentEmails(filters);

      expect(result.emails).toHaveLength(1);
      expect(result.count).toBe(1);
      expect(result.total).toBe(2); // Total in system
    });

    it('should combine multiple filters', () => {
      const filters = {
        template: EmailTemplate.PASSWORD_RESET,
        metadata: { testSuite: 'auth-tests' },
        limit: 5,
      };
      const result = EmailMockService.getSentEmails(filters);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].template).toBe(EmailTemplate.PASSWORD_RESET);
      expect(result.emails[0].metadata?.testSuite).toBe('auth-tests');
    });

    it('should ignore undefined metadata values', () => {
      const filters = {
        metadata: {
          testSuite: 'auth-tests',
          nonExistentField: undefined,
        },
      };
      const result = EmailMockService.getSentEmails(filters);

      expect(result.emails).toHaveLength(1);
      expect(result.appliedFilters.metadata).toEqual({ testSuite: 'auth-tests' });
    });
  });

  describe('getLatestEmail', () => {
    beforeEach(async () => {
      await emailMock.sendEmail(
        'user@example.com',
        'First Email',
        EmailTemplate.PASSWORD_RESET,
        {
          FIRST_NAME: 'User',
          RESET_URL: 'https://example.com/reset/token1',
        },
        {
          metadata: { testId: 'test-001' },
        },
      );
      await emailMock.sendEmail(
        'user@example.com',
        'Second Email',
        EmailTemplate.LOGIN_NOTIFICATION,
        {
          FIRST_NAME: 'User',
          LOGIN_TIME: '2024-01-01 10:00:00',
          IP_ADDRESS: '192.168.1.1',
          DEVICE: 'Chrome on Windows',
        },
        {
          metadata: { testId: 'test-002' },
        },
      );
      await emailMock.sendEmail('other@example.com', 'Other Email', EmailTemplate.PASSWORD_CHANGED, {
        FIRST_NAME: 'Other',
        DATE: '2024-01-01',
        TIME: '10:00:00',
      });
    });

    it('should return latest email for address without filters', () => {
      const result = EmailMockService.getLatestEmail('user@example.com', {});

      expect(result.found).toBe(true);
      expect(result.email?.subject).toBe('Second Email');
      expect(result.email?.template).toBe(EmailTemplate.LOGIN_NOTIFICATION);
    });

    it('should filter by template', () => {
      const filters = { template: EmailTemplate.PASSWORD_RESET };
      const result = EmailMockService.getLatestEmail('user@example.com', filters);

      expect(result.found).toBe(true);
      expect(result.email?.subject).toBe('First Email');
      expect(result.email?.template).toBe(EmailTemplate.PASSWORD_RESET);
    });

    it('should filter by metadata', () => {
      const filters = { metadata: { testId: 'test-001' } };
      const result = EmailMockService.getLatestEmail('user@example.com', filters);

      expect(result.found).toBe(true);
      expect(result.email?.metadata?.testId).toBe('test-001');
    });

    it('should return not found for non-existent email', () => {
      const result = EmailMockService.getLatestEmail('nonexistent@example.com', {});

      expect(result.found).toBe(false);
      expect(result.email).toBeNull();
    });

    it('should return not found when template filter does not match', () => {
      const filters = { template: EmailTemplate.TWO_FACTOR_ENABLED };
      const result = EmailMockService.getLatestEmail('user@example.com', filters);

      expect(result.found).toBe(false);
      expect(result.email).toBeNull();
    });
  });

  describe('clearEmails', () => {
    beforeEach(async () => {
      await emailMock.sendEmail(
        'user1@example.com',
        'Test 1',
        EmailTemplate.PASSWORD_RESET,
        {
          FIRST_NAME: 'User1',
          RESET_URL: 'https://example.com/reset/token1',
        },
        {
          metadata: { testSuite: 'suite-a', feature: 'auth' },
        },
      );
      await emailMock.sendEmail(
        'user2@example.com',
        'Test 2',
        EmailTemplate.LOGIN_NOTIFICATION,
        {
          FIRST_NAME: 'User2',
          LOGIN_TIME: '2024-01-01 10:00:00',
          IP_ADDRESS: '192.168.1.1',
          DEVICE: 'Chrome on Windows',
        },
        {
          metadata: { testSuite: 'suite-a', feature: 'notifications' },
        },
      );
      await emailMock.sendEmail(
        'user3@example.com',
        'Test 3',
        EmailTemplate.TWO_FACTOR_ENABLED,
        {
          FIRST_NAME: 'User3',
          DATE: '2024-01-01',
        },
        {
          metadata: { testSuite: 'suite-b', feature: 'auth' },
        },
      );
    });

    it('should clear emails by metadata filter', () => {
      const metadataFilter = { testSuite: 'suite-a' };
      const result = EmailMockService.clearEmails(metadataFilter);

      expect(result.clearedCount).toBe(2);
      expect(result.cleared).toBe(true);
      expect(result.message).toContain('Cleared 2 emails matching filter criteria');
      expect(result.filter).toEqual(metadataFilter);

      // Verify remaining emails
      const remaining = emailMock.getSentEmails();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].metadata?.testSuite).toBe('suite-b');
    });

    it('should clear emails by feature', () => {
      const metadataFilter = { feature: 'auth' };
      const result = EmailMockService.clearEmails(metadataFilter);

      expect(result.clearedCount).toBe(2);
      expect(result.cleared).toBe(true);

      const remaining = emailMock.getSentEmails();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].metadata?.feature).toBe('notifications');
    });

    it('should clear all emails when no filter provided', () => {
      const result = EmailMockService.clearEmails({});

      expect(result.clearedCount).toBe(3);
      expect(result.cleared).toBe(true);
      expect(result.message).toBe('All email history cleared successfully');
      expect(result.filter).toBe('all');

      expect(emailMock.getSentEmails()).toHaveLength(0);
    });

    it('should ignore undefined filter values', () => {
      const metadataFilter = {
        testSuite: 'suite-a',
        undefinedField: undefined,
      };
      const result = EmailMockService.clearEmails(metadataFilter);

      expect(result.clearedCount).toBe(2);
      expect(result.filter).toEqual({ testSuite: 'suite-a' });
    });
  });

  describe('clearAllEmails', () => {
    beforeEach(async () => {
      await emailMock.sendEmail('user1@example.com', 'Test 1', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'User1',
        RESET_URL: 'https://example.com/reset/token1',
      });
      await emailMock.sendEmail('user2@example.com', 'Test 2', EmailTemplate.LOGIN_NOTIFICATION, {
        FIRST_NAME: 'User2',
        LOGIN_TIME: '2024-01-01 10:00:00',
        IP_ADDRESS: '192.168.1.1',
        DEVICE: 'Chrome on Windows',
      });
      await emailMock.sendEmail('user3@example.com', 'Test 3', EmailTemplate.TWO_FACTOR_ENABLED, {
        FIRST_NAME: 'User3',
        DATE: '2024-01-01',
      });
    });

    it('should clear all emails and return count', () => {
      expect(emailMock.getSentEmails()).toHaveLength(3);

      const result = EmailMockService.clearAllEmails();

      expect(result.message).toBe('All email history cleared successfully');
      expect(result.cleared).toBe(true);
      expect(result.clearedCount).toBe(3);

      expect(emailMock.getSentEmails()).toHaveLength(0);
    });

    it('should work when no emails exist', () => {
      emailMock.clearSentEmails();

      const result = EmailMockService.clearAllEmails();

      expect(result.clearedCount).toBe(0);
      expect(result.cleared).toBe(true);
    });
  });

  describe('testSendEmail', () => {
    it('should send test email with default metadata when enabled', async () => {
      const params = {
        to: 'test@example.com',
        template: EmailTemplate.PASSWORD_RESET,
        variables: { FIRST_NAME: 'Test', RESET_URL: 'url' },
        metadata: { testName: 'Manual Test Send', feature: 'email-testing', action: 'test-send' },
      };

      const result = await EmailMockService.testSendEmail(params);

      expect(result.message).toBe('Test email sent successfully');
      expect(result.to).toBe(params.to);
      expect(result.template).toBe(params.template);

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].metadata?.testName).toBe('Manual Test Send');
      expect(sentEmails[0].metadata?.feature).toBe('email-testing');
      expect(sentEmails[0].metadata?.action).toBe('test-send');
    });

    it('should send test email with custom metadata', async () => {
      const customMetadata = {
        testId: 'custom-test-001',
        testSuite: 'manual-testing',
        feature: 'custom-feature',
      };

      const params = {
        to: 'test@example.com',
        template: EmailTemplate.LOGIN_NOTIFICATION,
        variables: {
          FIRST_NAME: 'Test',
          LOGIN_TIME: 'now',
          IP_ADDRESS: '127.0.0.1',
          DEVICE: 'Test Device',
        },
        metadata: customMetadata,
      };

      const result = await EmailMockService.testSendEmail(params);

      expect(result.metadata).toEqual(customMetadata);

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails[0].metadata?.testId).toBe('custom-test-001');
      expect(sentEmails[0].metadata?.testSuite).toBe('manual-testing');
      expect(sentEmails[0].metadata?.feature).toBe('custom-feature');
    });

    it('should throw error when email mock is disabled', async () => {
      updateEmailMockConfig({ enabled: false });
      emailMock.refreshConfig();

      const params = {
        to: 'test@example.com',
        template: EmailTemplate.PASSWORD_RESET,
        variables: {},
      };

      await expect(EmailMockService.testSendEmail(params)).rejects.toThrow('Email mock is not enabled');
    });
  });

  describe('getEmailsByTemplate', () => {
    beforeEach(async () => {
      await emailMock.sendEmail(
        'user1@example.com',
        'Reset 1',
        EmailTemplate.PASSWORD_RESET,
        {
          FIRST_NAME: 'User1',
          RESET_URL: 'https://example.com/reset/token1',
        },
        {
          metadata: { testId: 'test-001', accountId: 'acc-123' },
        },
      );
      await emailMock.sendEmail(
        'user2@example.com',
        'Reset 2',
        EmailTemplate.PASSWORD_RESET,
        {
          FIRST_NAME: 'User2',
          RESET_URL: 'https://example.com/reset/token2',
        },
        {
          metadata: { testId: 'test-002', accountId: 'acc-456' },
        },
      );
      await emailMock.sendEmail(
        'user3@example.com',
        'Login',
        EmailTemplate.LOGIN_NOTIFICATION,
        {
          FIRST_NAME: 'User3',
          LOGIN_TIME: '2024-01-01 10:00:00',
          IP_ADDRESS: '192.168.1.1',
          DEVICE: 'Chrome on Windows',
        },
        {
          metadata: { testId: 'test-001', accountId: 'acc-123' },
        },
      );
    });

    it('should return emails for specific template', () => {
      const result = EmailMockService.getEmailsByTemplate(EmailTemplate.PASSWORD_RESET, {});

      expect(result.template).toBe(EmailTemplate.PASSWORD_RESET);
      expect(result.emails).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.emails.every((email) => email.template === EmailTemplate.PASSWORD_RESET)).toBe(true);
    });

    it('should filter by metadata', () => {
      const filters = { metadata: { accountId: 'acc-123' } };
      const result = EmailMockService.getEmailsByTemplate(EmailTemplate.PASSWORD_RESET, filters);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].metadata?.accountId).toBe('acc-123');
      expect(result.appliedFilters).toEqual(filters);
    });

    it('should apply limit', () => {
      const filters = { limit: 1 };
      const result = EmailMockService.getEmailsByTemplate(EmailTemplate.PASSWORD_RESET, filters);

      expect(result.emails).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it('should return empty for non-existent template emails', () => {
      const result = EmailMockService.getEmailsByTemplate(EmailTemplate.TWO_FACTOR_ENABLED, {});

      expect(result.emails).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('searchByMetadata', () => {
    beforeEach(async () => {
      await emailMock.sendEmail(
        'user1@example.com',
        'Email 1',
        EmailTemplate.PASSWORD_RESET,
        {
          FIRST_NAME: 'User1',
          RESET_URL: 'https://example.com/reset/token1',
        },
        {
          metadata: { testId: 'test-001', feature: 'auth', tags: ['integration'] },
        },
      );
      await emailMock.sendEmail(
        'user2@example.com',
        'Email 2',
        EmailTemplate.LOGIN_NOTIFICATION,
        {
          FIRST_NAME: 'User2',
          LOGIN_TIME: '2024-01-01 10:00:00',
          IP_ADDRESS: '192.168.1.1',
          DEVICE: 'Chrome on Windows',
        },
        {
          metadata: { testId: 'test-002', feature: 'auth', tags: ['security'] },
        },
      );
      await emailMock.sendEmail(
        'user3@example.com',
        'Email 3',
        EmailTemplate.TWO_FACTOR_ENABLED,
        {
          FIRST_NAME: 'User3',
          DATE: '2024-01-01',
        },
        {
          metadata: { testId: 'test-003', feature: 'security', tags: ['integration'] },
        },
      );
    });

    it('should search by single metadata field', () => {
      const filter = { feature: 'auth' };
      const result = EmailMockService.searchByMetadata(filter);

      expect(result.emails).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.filter).toEqual(filter);
      expect(result.emails.every((email) => email.metadata?.feature === 'auth')).toBe(true);
    });

    it('should search by multiple metadata fields', () => {
      const filter = { feature: 'auth', testId: 'test-001' };
      const result = EmailMockService.searchByMetadata(filter);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].metadata?.testId).toBe('test-001');
      expect(result.emails[0].metadata?.feature).toBe('auth');
    });

    it('should search by tags', () => {
      const filter = { tags: ['integration'] };
      const result = EmailMockService.searchByMetadata(filter);

      expect(result.emails).toHaveLength(2);
      expect(result.emails.every((email) => email.metadata?.tags?.includes('integration'))).toBe(true);
    });

    it('should apply limit to search results', () => {
      const filter = { feature: 'auth' };
      const result = EmailMockService.searchByMetadata(filter, 1);

      expect(result.emails).toHaveLength(1);
      expect(result.count).toBe(1);
      expect(result.limit).toBe(1);
    });

    it('should return empty for non-matching criteria', () => {
      const filter = { feature: 'non-existent' };
      const result = EmailMockService.searchByMetadata(filter);

      expect(result.emails).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('getAvailableTemplates', () => {
    beforeEach(async () => {
      // Send some emails to generate stats
      await emailMock.sendEmail('user1@example.com', 'Reset', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'User1',
        RESET_URL: 'https://example.com/reset/token1',
      });
      await emailMock.sendEmail('user2@example.com', 'Reset', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'User2',
        RESET_URL: 'https://example.com/reset/token2',
      });
      await emailMock.sendEmail('user3@example.com', 'Login', EmailTemplate.LOGIN_NOTIFICATION, {
        FIRST_NAME: 'User3',
        LOGIN_TIME: '2024-01-01 10:00:00',
        IP_ADDRESS: '192.168.1.1',
        DEVICE: 'Chrome on Windows',
      });
    });

    it('should return all available templates with usage stats', () => {
      const result = EmailMockService.getAvailableTemplates();

      expect(result.templates).toBeInstanceOf(Array);
      expect(result.totalTemplates).toBeGreaterThan(0);

      // Check template structure
      const passwordResetTemplate = result.templates.find((t) => t.name === EmailTemplate.PASSWORD_RESET);
      expect(passwordResetTemplate).toBeDefined();
      expect(passwordResetTemplate?.displayName).toContain('Password Reset');
      expect(passwordResetTemplate?.sentCount).toBe(2);
      expect(passwordResetTemplate?.failedCount).toBe(0);

      const loginTemplate = result.templates.find((t) => t.name === EmailTemplate.LOGIN_NOTIFICATION);
      expect(loginTemplate?.sentCount).toBe(1);
    });
  });

  describe('getMetadataInsights', () => {
    beforeEach(async () => {
      await emailMock.sendEmail(
        'user1@example.com',
        'Email 1',
        EmailTemplate.PASSWORD_RESET,
        {
          FIRST_NAME: 'User1',
          RESET_URL: 'https://example.com/reset/token1',
        },
        {
          metadata: {
            testSuite: 'auth-tests',
            emailFlow: 'password-reset',
            feature: 'authentication',
            action: 'reset-password',
            tags: ['integration', 'auth'],
          },
        },
      );

      await emailMock.sendEmail(
        'user2@example.com',
        'Email 2',
        EmailTemplate.LOGIN_NOTIFICATION,
        {
          FIRST_NAME: 'User2',
          LOGIN_TIME: '2024-01-01 10:00:00',
          IP_ADDRESS: '192.168.1.1',
          DEVICE: 'Chrome on Windows',
        },
        {
          metadata: {
            testSuite: 'security-tests',
            emailFlow: 'security',
            feature: 'notifications',
            action: 'login-alert',
            tags: ['security', 'alerts'],
          },
        },
      );

      // Email without metadata
      await emailMock.sendEmail('user3@example.com', 'Email 3', EmailTemplate.TWO_FACTOR_ENABLED, {
        FIRST_NAME: 'User3',
        DATE: '2024-01-01',
      });
    });

    it('should return metadata usage insights', () => {
      const insights = EmailMockService.getMetadataInsights();

      expect(insights.totalEmails).toBe(3);
      expect(insights.emailsWithMetadata).toBe(2);
      expect(insights.metadataUsageRate).toBe('66.67%'); // 2/3 * 100

      expect(insights.uniqueValues.testSuites).toContain('auth-tests');
      expect(insights.uniqueValues.testSuites).toContain('security-tests');
      expect(insights.uniqueValues.emailFlows).toContain('password-reset');
      expect(insights.uniqueValues.emailFlows).toContain('security');
      expect(insights.uniqueValues.features).toContain('authentication');
      expect(insights.uniqueValues.features).toContain('notifications');
      expect(insights.uniqueValues.allTags).toContain('integration');
      expect(insights.uniqueValues.allTags).toContain('security');
    });

    it('should provide recent activity insights', () => {
      const insights = EmailMockService.getMetadataInsights();

      expect(insights.recentTestSuites).toBeInstanceOf(Array);
      expect(insights.recentFlows).toBeInstanceOf(Array);
      expect(insights.recentTestSuites.length).toBeLessThanOrEqual(5);
      expect(insights.recentFlows.length).toBeLessThanOrEqual(5);
    });
  });
});
