import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { emailMock } from '../../../../src/mocks/email/EmailServiceMock';
import { EmailTemplate } from '../../../../src/feature/email/Email.types';
import { getEmailMockConfig } from '../../../../src/config/mock.config';
import { loadTemplate } from '../../../../src/feature/email';

const mockConfig = {
  enabled: true,
  logEmails: true,
  simulateDelay: false,
  delayMs: 150,
  simulateFailures: false,
  failureRate: 0.1,
  failOnEmails: ['fail@example.com', 'error@test.com', 'bounce@invalid.com'],
  blockEmails: ['blocked@example.com', 'spam@test.com'],
};

// Mock the email templates
vi.mock('../../../../src/feature/email', () => ({
  loadTemplate: vi.fn(),
}));

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EmailServiceMock', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Clear email history
    emailMock.clearSentEmails();

    // Refresh config
    emailMock.refreshConfig();
  });

  describe('Configuration Management', () => {
    it('should be enabled when EMAIL_MOCK_ENABLED is true', () => {
      process.env.EMAIL_MOCK_ENABLED = 'true';
      expect(emailMock.isEnabled()).toBe(true);
    });

    it('should be disabled when EMAIL_MOCK_ENABLED is false', () => {
      process.env.EMAIL_MOCK_ENABLED = 'false';
      expect(emailMock.isEnabled()).toBe(false);
    });

    it('should be disabled when EMAIL_MOCK_ENABLED is not set', () => {
      delete process.env.EMAIL_MOCK_ENABLED;
      expect(emailMock.isEnabled()).toBe(false);
    });

    it('should refresh configuration', () => {
      const newConfig = { ...mockConfig, logEmails: false };
      vi.mocked(getEmailMockConfig).mockReturnValue(newConfig);

      emailMock.refreshConfig();

      expect(getEmailMockConfig).toHaveBeenCalled();
      expect(emailMock.getConfig()).toEqual(newConfig);
    });

    it('should return current configuration', () => {
      const config = emailMock.getConfig();
      expect(config).toEqual(mockConfig);
    });
  });

  describe('Email Sending', () => {
    it('should throw error when mock is disabled', async () => {
      process.env.EMAIL_MOCK_ENABLED = 'false';

      await expect(
        emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, { FIRST_NAME: 'John' }),
      ).rejects.toThrow('Email mock is not enabled');
    });

    it('should send email successfully', async () => {
      vi.mocked(loadTemplate).mockResolvedValue('<html><body>Hello {{FIRST_NAME}}</body></html>');

      await emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
      });

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);

      const email = sentEmails[0];
      expect(email.to).toBe('test@example.com');
      expect(email.subject).toBe('Test Subject');
      expect(email.template).toBe(EmailTemplate.PASSWORD_RESET);
      expect(email.status).toBe('sent');
      expect(email.html).toContain('Hello John');
    });

    it('should block emails in blockEmails list', async () => {
      await expect(
        emailMock.sendEmail('blocked@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
          FIRST_NAME: 'John',
        }),
      ).rejects.toThrow('Email address blocked@example.com is blocked');
    });

    it('should fail emails in failOnEmails list', async () => {
      await expect(
        emailMock.sendEmail('fail@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, { FIRST_NAME: 'John' }),
      ).rejects.toThrow('Simulated email failure for fail@example.com');

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].status).toBe('failed');
    });

    it('should simulate random failures when enabled', async () => {
      const configWithFailures = {
        ...mockConfig,
        simulateFailures: true,
        failureRate: 1.0, // 100% failure rate for testing
      };
      vi.mocked(getEmailMockConfig).mockReturnValue(configWithFailures);
      emailMock.refreshConfig();

      await expect(
        emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, { FIRST_NAME: 'John' }),
      ).rejects.toThrow('Simulated email failure');
    });

    it('should simulate delay when enabled', async () => {
      const configWithDelay = {
        ...mockConfig,
        simulateDelay: true,
        delayMs: 50,
      };
      vi.mocked(getEmailMockConfig).mockReturnValue(configWithDelay);
      emailMock.refreshConfig();

      vi.mocked(loadTemplate).mockResolvedValue('<html><body>Test</body></html>');

      const startTime = Date.now();
      await emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should use fallback template when loadTemplate fails', async () => {
      vi.mocked(loadTemplate).mockRejectedValue(new Error('Template not found'));

      await emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
      });

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].html).toContain('Mock Email - password-reset');
    });
  });

  describe('Email Retrieval and Filtering', () => {
    beforeEach(async () => {
      vi.mocked(loadTemplate).mockResolvedValue('<html><body>Test {{FIRST_NAME}}</body></html>');

      // Send multiple test emails
      await emailMock.sendEmail('user1@example.com', 'Subject 1', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'User1',
      });
      await emailMock.sendEmail('user2@example.com', 'Subject 2', EmailTemplate.LOGIN_NOTIFICATION, {
        FIRST_NAME: 'User2',
      });
      await emailMock.sendEmail('user1@example.com', 'Subject 3', EmailTemplate.PASSWORD_CHANGED, {
        FIRST_NAME: 'User1',
      });
    });

    it('should get all sent emails', () => {
      const emails = emailMock.getSentEmails();
      expect(emails).toHaveLength(3);
    });

    it('should filter emails by address', () => {
      const user1Emails = emailMock.getEmailsForAddress('user1@example.com');
      expect(user1Emails).toHaveLength(2);
      expect(user1Emails.every((email) => email.to === 'user1@example.com')).toBe(true);
    });

    it('should filter emails by template', () => {
      const resetEmails = emailMock.getEmailsByTemplate(EmailTemplate.PASSWORD_RESET);
      expect(resetEmails).toHaveLength(1);
      expect(resetEmails[0].template).toBe(EmailTemplate.PASSWORD_RESET);
    });

    it('should get latest email for address', () => {
      const latestEmail = emailMock.getLatestEmailForAddress('user1@example.com');
      expect(latestEmail).toBeTruthy();
      expect(latestEmail!.to).toBe('user1@example.com');
      expect(latestEmail!.subject).toBe('Subject 3');
    });

    it('should return null for non-existent address', () => {
      const latestEmail = emailMock.getLatestEmailForAddress('nonexistent@example.com');
      expect(latestEmail).toBeNull();
    });

    it('should clear sent emails', () => {
      emailMock.clearSentEmails();
      const emails = emailMock.getSentEmails();
      expect(emails).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      vi.mocked(loadTemplate).mockResolvedValue('<html><body>Test</body></html>');

      // Send successful emails
      await emailMock.sendEmail('success1@example.com', 'Subject 1', EmailTemplate.PASSWORD_RESET, {});
      await emailMock.sendEmail('success2@example.com', 'Subject 2', EmailTemplate.PASSWORD_RESET, {});
      await emailMock.sendEmail('success3@example.com', 'Subject 3', EmailTemplate.LOGIN_NOTIFICATION, {});

      // Send failed emails
      try {
        await emailMock.sendEmail('fail@example.com', 'Subject 4', EmailTemplate.PASSWORD_RESET, {});
      } catch {
        // Expected to fail
      }
    });

    it('should provide accurate statistics', () => {
      const stats = emailMock.getStats();

      expect(stats.totalSent).toBe(3);
      expect(stats.totalFailed).toBe(1);
      expect(stats.sentByTemplate[EmailTemplate.PASSWORD_RESET]).toBe(2);
      expect(stats.sentByTemplate[EmailTemplate.LOGIN_NOTIFICATION]).toBe(1);
      expect(stats.failedByTemplate[EmailTemplate.PASSWORD_RESET]).toBe(1);
      expect(stats.recentEmails).toHaveLength(4);
    });
  });

  describe('Template Variable Replacement', () => {
    it('should replace template variables correctly', async () => {
      vi.mocked(loadTemplate).mockResolvedValue(
        '<html><body>Hello {{FIRST_NAME}}, your app is {{APP_NAME}} ({{YEAR}})</body></html>',
      );

      await emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
        RESET_URL: 'http://example.com/reset',
      });

      const sentEmails = emailMock.getSentEmails();
      const email = sentEmails[0];

      expect(email.html).toContain('Hello John');
      expect(email.html).toContain('your app is AccountSystem');
      expect(email.html).toContain(`(${new Date().getFullYear()})`);
    });

    it('should handle missing variables gracefully', async () => {
      vi.mocked(loadTemplate).mockResolvedValue(
        '<html><body>Hello {{FIRST_NAME}}, missing: {{MISSING_VAR}}</body></html>',
      );

      await emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
      });

      const sentEmails = emailMock.getSentEmails();
      const email = sentEmails[0];

      expect(email.html).toContain('Hello John');
      expect(email.html).toContain('missing: '); // Empty replacement
    });

    it('should generate plain text from HTML', async () => {
      vi.mocked(loadTemplate).mockResolvedValue(
        '<html><head><style>body{color:red}</style></head><body><h1>Hello {{FIRST_NAME}}</h1><p>Welcome!</p></body></html>',
      );

      await emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
      });

      const sentEmails = emailMock.getSentEmails();
      const email = sentEmails[0];

      expect(email.text).toBe('Hello John Welcome!');
      expect(email.text).not.toContain('<');
      expect(email.text).not.toContain('style');
    });
  });

  describe('Error Handling', () => {
    it('should handle template loading errors gracefully', async () => {
      vi.mocked(loadTemplate).mockRejectedValue(new Error('Template not found'));

      await emailMock.sendEmail('test@example.com', 'Test Subject', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
      });

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].status).toBe('sent');
      expect(sentEmails[0].html).toContain('Mock Email - password-reset');
    });

    it('should record failed emails in history', async () => {
      try {
        await emailMock.sendEmail('fail@example.com', 'Test', EmailTemplate.PASSWORD_RESET, {});
      } catch {
        // Expected to fail
      }

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].status).toBe('failed');
      expect(sentEmails[0].error).toContain('Simulated email failure');
    });
  });
});
