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

    it('should include error details for failed emails', async () => {
      updateEmailMockConfig({ failOnEmails: ['fail@example.com'] });
      emailMock.refreshConfig();

      try {
        await emailMock.sendEmail('fail@example.com', 'Test', EmailTemplate.PASSWORD_RESET, {});
      } catch {
        // Expected to fail
      }

      const failedEmail = emailMock.getSentEmails()[0];
      expect(failedEmail.status).toBe('failed');
      expect(failedEmail.error).toBe('Simulated email failure for fail@example.com');
      expect(failedEmail.html).toBe('');
      expect(failedEmail.text).toBe('');
    });
  });
});
