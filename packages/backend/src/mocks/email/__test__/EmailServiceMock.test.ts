import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emailMock } from '../EmailServiceMock';
import { EmailTemplate } from '../../../feature/email';
import { updateEmailMockConfig, type EmailMockConfig } from '../../../config/mock.config';

describe('EmailServiceMock', () => {
  const defaultConfig: EmailMockConfig = {
    enabled: true,
    logEmails: false,
    simulateDelay: false,
    delayMs: 0,
    simulateFailures: false,
    failureRate: 0,
    failOnEmails: [],
    blockEmails: [],
  };

  // Test emails from mock.config.json
  const mockConfigEmails = {
    failEmails: ['fail@example.com', 'error@test.com', 'bounce@invalid.com'],
    blockEmails: ['blocked@example.com', 'spam@test.com'],
    normalEmail: 'test.user@example.com',
  };

  beforeEach(() => {
    updateEmailMockConfig(defaultConfig);
    emailMock.clearSentEmails();
    vi.clearAllTimers();
  });

  describe('sendEmail', () => {
    it('should send email successfully with valid parameters', async () => {
      const template = EmailTemplate.PASSWORD_RESET;
      const variables = { FIRST_NAME: 'John', RESET_URL: 'https://example.com/reset' };

      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test Subject', template, variables);

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);

      const sentEmail = sentEmails[0];
      expect(sentEmail.to).toBe(mockConfigEmails.normalEmail);
      expect(sentEmail.subject).toBe('Test Subject');
      expect(sentEmail.template).toBe(template);
      expect(sentEmail.variables).toEqual(variables);
      expect(sentEmail.status).toBe('sent');
      expect(sentEmail.html).toContain('John');
      expect(sentEmail.text).toBeTruthy();
    });

    it('should send email with metadata', async () => {
      const template = EmailTemplate.PASSWORD_RESET;
      const variables = { FIRST_NAME: 'John', RESET_URL: 'https://example.com/reset' };
      const metadata = {
        testId: 'test-001',
        testSuite: 'auth-tests',
        accountId: 'acc-123',
        emailFlow: 'password-reset',
        feature: 'authentication',
        action: 'reset-password',
        tags: ['integration', 'auth'],
      };

      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test Subject', template, variables, { metadata });

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].metadata).toEqual(metadata);
    });

    it('should send email with custom metadata fields', async () => {
      const template = EmailTemplate.LOGIN_NOTIFICATION;
      const variables = {
        FIRST_NAME: 'Jane',
        LOGIN_TIME: '2024-01-01 10:00:00',
        IP_ADDRESS: '192.168.1.1',
        DEVICE: 'Chrome',
      };
      const metadata = {
        testId: 'custom-test-001',
        feature: 'security',
        // Custom fields at the same level
        customField1: 'value1',
        customField2: 42,
        riskLevel: 'low',
        tags: ['security', 'custom'],
      };

      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Login Alert', template, variables, { metadata });

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails[0].metadata?.customField1).toBe('value1');
      expect(sentEmails[0].metadata?.customField2).toBe(42);
      expect(sentEmails[0].metadata?.riskLevel).toBe('low');
    });

    it('should throw error when service is disabled', async () => {
      updateEmailMockConfig({ enabled: false });
      emailMock.refreshConfig();

      await expect(
        emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test', EmailTemplate.PASSWORD_RESET, {}),
      ).rejects.toThrow('Email mock is not enabled');
    });

    it('should block emails from mock.config.json blocked list', async () => {
      updateEmailMockConfig({ blockEmails: mockConfigEmails.blockEmails });
      emailMock.refreshConfig();

      for (const blockedEmail of mockConfigEmails.blockEmails) {
        await expect(emailMock.sendEmail(blockedEmail, 'Test', EmailTemplate.PASSWORD_RESET, {})).rejects.toThrow(
          `Email address ${blockedEmail} is blocked`,
        );
      }

      expect(emailMock.getSentEmails()).toHaveLength(0);
    });

    it('should fail emails from mock.config.json fail list', async () => {
      updateEmailMockConfig({ failOnEmails: mockConfigEmails.failEmails });
      emailMock.refreshConfig();

      for (const failEmail of mockConfigEmails.failEmails) {
        await expect(emailMock.sendEmail(failEmail, 'Test', EmailTemplate.PASSWORD_RESET, {})).rejects.toThrow(
          `Simulated email failure for ${failEmail}`,
        );
      }

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(mockConfigEmails.failEmails.length);

      sentEmails.forEach((email, index) => {
        expect(email.to).toBe(mockConfigEmails.failEmails[index]);
        expect(email.status).toBe('failed');
        expect(email.error).toContain('Simulated email failure');
      });
    });

    it('should simulate random failures when enabled', async () => {
      updateEmailMockConfig({
        simulateFailures: true,
        failureRate: 1.0, // 100% failure rate
      });
      emailMock.refreshConfig();

      await expect(
        emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test', EmailTemplate.PASSWORD_RESET, {}),
      ).rejects.toThrow('Simulated email failure');

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].status).toBe('failed');
    });

    it('should simulate delay when enabled', async () => {
      vi.useFakeTimers();

      const delayMs = 150;
      updateEmailMockConfig({
        simulateDelay: true,
        delayMs,
      });
      emailMock.refreshConfig();

      const sendPromise = emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'Test',
        RESET_URL: 'url',
      });

      vi.advanceTimersByTime(delayMs);
      await sendPromise;

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].status).toBe('sent');

      vi.useRealTimers();
    });

    it('should replace template variables correctly', async () => {
      const variables = {
        FIRST_NAME: 'Test User',
        RESET_URL: 'https://example.com/reset/123',
      };

      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test Email', EmailTemplate.PASSWORD_RESET, variables);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain('Test User');
      expect(sentEmail.html).toContain('https://example.com/reset/123');
      expect(sentEmail.html).not.toContain('{{FIRST_NAME}}');
      expect(sentEmail.html).not.toContain('{{RESET_URL}}');
    });

    it('should generate unique message IDs', async () => {
      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test1', EmailTemplate.PASSWORD_RESET, {});
      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test2', EmailTemplate.PASSWORD_RESET, {});

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails[0].id).toBeTruthy();
      expect(sentEmails[1].id).toBeTruthy();
      expect(sentEmails[0].id).not.toBe(sentEmails[1].id);
      expect(sentEmails[0].id).toMatch(/^mock_\d+_[a-z0-9]+$/);
    });
  });

  describe('Email Retrieval', () => {
    beforeEach(async () => {
      await emailMock.sendEmail('user1@example.com', 'Welcome', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'User1',
        RESET_URL: 'url1',
      });
      await emailMock.sendEmail('user2@example.com', 'Reset', EmailTemplate.PASSWORD_CHANGED, {
        FIRST_NAME: 'User2',
        DATE: '2024-01-01',
        TIME: '12:00',
      });
      await emailMock.sendEmail('user1@example.com', 'Login', EmailTemplate.LOGIN_NOTIFICATION, {
        FIRST_NAME: 'User1',
        LOGIN_TIME: '2024-01-01',
        IP_ADDRESS: '1.1.1.1',
        DEVICE: 'Chrome',
      });
    });

    it('should retrieve emails by address', () => {
      const user1Emails = emailMock.getEmailsForAddress('user1@example.com');
      const user2Emails = emailMock.getEmailsForAddress('user2@example.com');

      expect(user1Emails).toHaveLength(2);
      expect(user2Emails).toHaveLength(1);
      expect(user1Emails.every((email) => email.to === 'user1@example.com')).toBe(true);
    });

    it('should retrieve emails by template', () => {
      const resetEmails = emailMock.getEmailsByTemplate(EmailTemplate.PASSWORD_RESET);
      const changedEmails = emailMock.getEmailsByTemplate(EmailTemplate.PASSWORD_CHANGED);

      expect(resetEmails).toHaveLength(1);
      expect(changedEmails).toHaveLength(1);
      expect(resetEmails[0].template).toBe(EmailTemplate.PASSWORD_RESET);
    });

    it('should get latest email for address', () => {
      const latestUser1Email = emailMock.getLatestEmailForAddress('user1@example.com');
      const latestNonExistentEmail = emailMock.getLatestEmailForAddress('nonexistent@example.com');

      expect(latestUser1Email).toBeTruthy();
      expect(latestUser1Email!.template).toBe(EmailTemplate.LOGIN_NOTIFICATION);
      expect(latestNonExistentEmail).toBeNull();
    });

    it('should generate statistics', () => {
      const stats = emailMock.getStats();

      expect(stats.totalSent).toBe(3);
      expect(stats.totalFailed).toBe(0);
      expect(stats.sentByTemplate[EmailTemplate.PASSWORD_RESET]).toBe(1);
      expect(stats.sentByTemplate[EmailTemplate.PASSWORD_CHANGED]).toBe(1);
      expect(stats.sentByTemplate[EmailTemplate.LOGIN_NOTIFICATION]).toBe(1);
    });

    it('should clear email history', () => {
      expect(emailMock.getSentEmails()).toHaveLength(3);

      emailMock.clearSentEmails();

      expect(emailMock.getSentEmails()).toHaveLength(0);
      expect(emailMock.getLatestEmailForAddress('user1@example.com')).toBeNull();
    });
  });

  describe('Metadata Filtering', () => {
    beforeEach(async () => {
      // Set up test emails with different metadata
      await emailMock.sendEmail(
        'user1@example.com',
        'Reset Password',
        EmailTemplate.PASSWORD_RESET,
        { FIRST_NAME: 'User1', RESET_URL: 'url' },
        {
          metadata: {
            testId: 'test-001',
            testSuite: 'auth-tests',
            feature: 'authentication',
            action: 'reset-password',
            accountId: 'acc-123',
            tags: ['integration', 'auth'],
          },
        },
      );

      await emailMock.sendEmail(
        'user2@example.com',
        'Login Alert',
        EmailTemplate.LOGIN_NOTIFICATION,
        { FIRST_NAME: 'User2', LOGIN_TIME: 'time', IP_ADDRESS: 'ip', DEVICE: 'device' },
        {
          metadata: {
            testId: 'test-002',
            testSuite: 'auth-tests',
            feature: 'authentication',
            action: 'login-alert',
            accountId: 'acc-456',
            tags: ['integration', 'security'],
          },
        },
      );

      await emailMock.sendEmail(
        'user3@example.com',
        '2FA Enabled',
        EmailTemplate.TWO_FACTOR_ENABLED,
        { FIRST_NAME: 'User3', DATE: 'date' },
        {
          metadata: {
            testId: 'test-003',
            testSuite: 'security-tests',
            feature: 'two-factor-auth',
            action: 'enable-2fa',
            accountId: 'acc-123',
            tags: ['e2e', 'security'],
          },
        },
      );
    });

    it('should find emails by test suite', () => {
      const authEmails = emailMock.getEmailsByMetadata({ testSuite: 'auth-tests' });
      const securityEmails = emailMock.getEmailsByMetadata({ testSuite: 'security-tests' });

      expect(authEmails).toHaveLength(2);
      expect(securityEmails).toHaveLength(1);
    });

    it('should find emails by feature and action', () => {
      const authEmails = emailMock.getEmailsByMetadata({ feature: 'authentication' });
      expect(authEmails).toHaveLength(2);

      const resetEmails = emailMock.getEmailsByMetadata({
        feature: 'authentication',
        action: 'reset-password',
      });
      expect(resetEmails).toHaveLength(1);
      expect(resetEmails[0].to).toBe('user1@example.com');
    });

    it('should find emails by account ID', () => {
      const acc123Emails = emailMock.getEmailsByMetadata({ accountId: 'acc-123' });
      const acc456Emails = emailMock.getEmailsByMetadata({ accountId: 'acc-456' });

      expect(acc123Emails).toHaveLength(2);
      expect(acc456Emails).toHaveLength(1);
      expect(acc456Emails[0].to).toBe('user2@example.com');
    });

    it('should find emails by tags', () => {
      const integrationEmails = emailMock.getEmailsByMetadata({ tags: ['integration'] });
      const securityEmails = emailMock.getEmailsByMetadata({ tags: ['security'] });
      const e2eEmails = emailMock.getEmailsByMetadata({ tags: ['e2e'] });

      expect(integrationEmails).toHaveLength(2);
      expect(securityEmails).toHaveLength(2);
      expect(e2eEmails).toHaveLength(1);
    });

    it('should find emails by multiple criteria', () => {
      const complexFilter = emailMock.getEmailsByMetadata({
        testSuite: 'auth-tests',
        feature: 'authentication',
        tags: ['integration'],
      });

      expect(complexFilter).toHaveLength(2);
    });

    it('should find emails by custom metadata fields', async () => {
      // First add an email with custom metadata
      await emailMock.sendEmail(
        'custom@example.com',
        'Custom Email',
        EmailTemplate.WELCOME,
        { FIRST_NAME: 'Custom' },
        {
          metadata: {
            testId: 'custom-001',
            customField: 'customValue',
            priority: 'high',
            department: 'engineering',
          },
        },
      );

      const customEmails = emailMock.getEmailsByMetadata({ customField: 'customValue' });
      const highPriorityEmails = emailMock.getEmailsByMetadata({ priority: 'high' });
      const deptEmails = emailMock.getEmailsByMetadata({ department: 'engineering' });

      expect(customEmails).toHaveLength(1);
      expect(highPriorityEmails).toHaveLength(1);
      expect(deptEmails).toHaveLength(1);
      expect(customEmails[0].to).toBe('custom@example.com');
    });

    it('should get latest email by metadata', () => {
      const latestAuthEmail = emailMock.getLatestEmailByMetadata({ feature: 'authentication' });
      expect(latestAuthEmail?.metadata?.testId).toBe('test-002'); // Most recent auth email

      const latest2FAEmail = emailMock.getLatestEmailByMetadata({ feature: 'two-factor-auth' });
      expect(latest2FAEmail?.metadata?.testId).toBe('test-003');
    });

    it('should get emails by test context', () => {
      const testEmails = emailMock.getEmailsByTestContext('test-001');
      expect(testEmails).toHaveLength(1);
      expect(testEmails[0].metadata?.testId).toBe('test-001');

      const suiteEmails = emailMock.getEmailsByTestContext(undefined, undefined, 'auth-tests');
      expect(suiteEmails).toHaveLength(2);
    });

    it('should get emails by flow', async () => {
      // Add emails with flow metadata
      await emailMock.sendEmail(
        'flow@example.com',
        'Flow Test',
        EmailTemplate.PASSWORD_RESET,
        { FIRST_NAME: 'Flow', RESET_URL: 'url' },
        {
          metadata: {
            emailFlow: 'password-reset',
            flowStep: 'initial',
          },
        },
      );

      const flowEmails = emailMock.getEmailsByFlow('password-reset');
      expect(flowEmails).toHaveLength(1);

      const stepEmails = emailMock.getEmailsByFlow('password-reset', 'initial');
      expect(stepEmails).toHaveLength(1);
    });
  });

  describe('Clearing Emails by Metadata', () => {
    beforeEach(async () => {
      // Set up test emails
      await emailMock.sendEmail(
        'user1@example.com',
        'Test 1',
        EmailTemplate.PASSWORD_RESET,
        {},
        {
          metadata: { testSuite: 'suite-a', feature: 'auth' },
        },
      );
      await emailMock.sendEmail(
        'user2@example.com',
        'Test 2',
        EmailTemplate.LOGIN_NOTIFICATION,
        {},
        {
          metadata: { testSuite: 'suite-a', feature: 'notifications' },
        },
      );
      await emailMock.sendEmail(
        'user3@example.com',
        'Test 3',
        EmailTemplate.TWO_FACTOR_ENABLED,
        {},
        {
          metadata: { testSuite: 'suite-b', feature: 'auth' },
        },
      );
    });

    it('should clear emails by test suite', () => {
      expect(emailMock.getSentEmails()).toHaveLength(3);

      const clearedCount = emailMock.clearEmailsByMetadata({ testSuite: 'suite-a' });
      expect(clearedCount).toBe(2);
      expect(emailMock.getSentEmails()).toHaveLength(1);

      const remaining = emailMock.getSentEmails()[0];
      expect(remaining.metadata?.testSuite).toBe('suite-b');
    });

    it('should clear emails by feature', () => {
      const clearedCount = emailMock.clearEmailsByMetadata({ feature: 'auth' });
      expect(clearedCount).toBe(2);
      expect(emailMock.getSentEmails()).toHaveLength(1);

      const remaining = emailMock.getSentEmails()[0];
      expect(remaining.metadata?.feature).toBe('notifications');
    });

    it('should clear all emails', () => {
      emailMock.clearSentEmails();
      expect(emailMock.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Configuration Updates', () => {
    it('should refresh configuration dynamically', () => {
      expect(emailMock.getConfig().simulateDelay).toBe(false);

      updateEmailMockConfig({ simulateDelay: true, delayMs: 300 });
      emailMock.refreshConfig();

      expect(emailMock.getConfig().simulateDelay).toBe(true);
      expect(emailMock.getConfig().delayMs).toBe(300);
    });

    it('should handle high failure rates', async () => {
      updateEmailMockConfig({
        simulateFailures: true,
        failureRate: 0.99, // 99% failure rate
      });
      emailMock.refreshConfig();

      const promises = Array.from({ length: 10 }, (_, i) =>
        emailMock
          .sendEmail(`test${i}@example.com`, 'Test', EmailTemplate.PASSWORD_RESET, {
            FIRST_NAME: 'Test',
            RESET_URL: 'url',
          })
          .then(() => 'success')
          .catch(() => 'failed'),
      );

      const results = await Promise.all(promises);
      const failureCount = results.filter((r) => r === 'failed').length;

      expect(failureCount).toBeGreaterThan(5);
    });
  });

  describe('Enhanced Statistics with Metadata', () => {
    beforeEach(async () => {
      // Create emails with metadata for stats testing
      await emailMock.sendEmail(
        'user1@example.com',
        'Test 1',
        EmailTemplate.PASSWORD_RESET,
        {},
        {
          metadata: {
            testSuite: 'suite-a',
            emailFlow: 'password-reset',
            feature: 'auth',
            action: 'reset-password',
            tags: ['integration', 'auth'],
          },
        },
      );
      await emailMock.sendEmail(
        'user2@example.com',
        'Test 2',
        EmailTemplate.LOGIN_NOTIFICATION,
        {},
        {
          metadata: {
            testSuite: 'suite-a',
            emailFlow: 'security',
            feature: 'notifications',
            action: 'login-alert',
            tags: ['security', 'alerts'],
          },
        },
      );
      await emailMock.sendEmail(
        'user3@example.com',
        'Test 3',
        EmailTemplate.TWO_FACTOR_ENABLED,
        {},
        {
          metadata: {
            testSuite: 'suite-b',
            emailFlow: 'security',
            feature: 'auth',
            action: 'enable-2fa',
            tags: ['security', 'auth'],
          },
        },
      );
    });

    it('should generate metadata statistics', () => {
      const stats = emailMock.getStats();

      expect(stats.byMetadata.byTestSuite['suite-a']).toBe(2);
      expect(stats.byMetadata.byTestSuite['suite-b']).toBe(1);

      expect(stats.byMetadata.byEmailFlow['password-reset']).toBe(1);
      expect(stats.byMetadata.byEmailFlow['security']).toBe(2);

      expect(stats.byMetadata.byFeature['auth']).toBe(2);
      expect(stats.byMetadata.byFeature['notifications']).toBe(1);

      expect(stats.byMetadata.byAction['reset-password']).toBe(1);
      expect(stats.byMetadata.byAction['login-alert']).toBe(1);
      expect(stats.byMetadata.byAction['enable-2fa']).toBe(1);

      expect(stats.byMetadata.byTags['integration']).toBe(1);
      expect(stats.byMetadata.byTags['security']).toBe(2);
      expect(stats.byMetadata.byTags['auth']).toBe(2);
      expect(stats.byMetadata.byTags['alerts']).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty variables gracefully', async () => {
      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test', EmailTemplate.PASSWORD_RESET, {});

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.variables).toEqual({});
      expect(sentEmail.html).toBeTruthy();
      expect(sentEmail.text).toBeTruthy();
    });

    it('should handle undefined variables in templates', async () => {
      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'Test',
        UNDEFINED_VAR: undefined as any,
      });

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).not.toContain('undefined');
    });

    it('should handle emails without metadata', async () => {
      await emailMock.sendEmail(mockConfigEmails.normalEmail, 'Test', EmailTemplate.PASSWORD_RESET, {});

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.metadata).toBeUndefined();

      // Should still be able to find by non-metadata filters
      const emailsByAddress = emailMock.getEmailsForAddress(mockConfigEmails.normalEmail);
      expect(emailsByAddress).toHaveLength(1);
    });

    it('should include error details for failed emails with metadata', async () => {
      const metadata = {
        testId: 'fail-test',
        testSuite: 'error-handling',
        feature: 'testing',
      };

      updateEmailMockConfig({ failOnEmails: ['fail@example.com'] });
      emailMock.refreshConfig();

      try {
        await emailMock.sendEmail('fail@example.com', 'Test', EmailTemplate.PASSWORD_RESET, {}, { metadata });
      } catch {
        // Expected to fail
      }

      const failedEmail = emailMock.getSentEmails()[0];
      expect(failedEmail.status).toBe('failed');
      expect(failedEmail.error).toBe('Simulated email failure for fail@example.com');
      expect(failedEmail.metadata).toEqual(metadata);
      expect(failedEmail.html).toBe('');
      expect(failedEmail.text).toBe('');
    });
  });
});
