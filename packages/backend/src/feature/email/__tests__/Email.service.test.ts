import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import {
  sendCustomEmail,
  sendPasswordResetEmail,
  sendPasswordChangedNotification,
  sendLoginNotification,
  sendTwoFactorEnabledNotification,
  sendSignupEmailVerification,
} from '../Email.service';
import { EmailTemplate } from '../Email.types';
import { ValidationError, ServerError } from '../../../types/response.types';

// Mock dependencies but NOT the fs module - we want to read real files
vi.mock('../Email.transporter', () => ({
  getTransporter: vi.fn(),
  resetTransporter: vi.fn(),
}));

vi.mock('../../../config/env.config', () => ({
  getAppName: () => 'TestApp',
  getSenderEmail: () => 'noreply@testapp.com',
  getSenderName: () => 'TestApp Team',
  getNodeEnv: () => 'test',
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock the email mock configuration to disable mocking by default
vi.mock('../../../config/mock.config', () => ({
  getEmailMockConfig: vi.fn().mockReturnValue({
    enabled: false, // Disable by default so real service runs
    logEmails: false,
    simulateDelay: false,
    delayMs: 0,
    simulateFailures: false,
    failureRate: 0,
    failOnEmails: [],
    blockEmails: [],
  }),
  updateEmailMockConfig: vi.fn(),
}));

// Mock the EmailServiceMock instance
vi.mock('../../../mocks/email/EmailServiceMock', () => ({
  emailMock: {
    isEnabled: vi.fn().mockReturnValue(false), // Disable by default
    sendEmail: vi.fn(),
    refreshConfig: vi.fn(),
  },
}));

// Import mocked modules
import { getTransporter, resetTransporter } from '../Email.transporter';
import { ValidationUtils } from '../../../utils/validation';
import { getEmailMockConfig } from '../../../config/mock.config';
import { emailMock } from '../../../mocks/email/EmailServiceMock';

const mockGetTransporter = vi.mocked(getTransporter);
const mockResetTransporter = vi.mocked(resetTransporter);
const mockGetEmailMockConfig = vi.mocked(getEmailMockConfig);
const mockEmailMock = vi.mocked(emailMock);

describe('Email Service', () => {
  const mockTransporter = {
    sendMail: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock behavior - disable email mocking so real service runs
    mockEmailMock.isEnabled.mockReturnValue(false);
    mockGetEmailMockConfig.mockReturnValue({
      enabled: false,
      logEmails: false,
      simulateDelay: false,
      delayMs: 0,
      simulateFailures: false,
      failureRate: 0,
      failOnEmails: [],
      blockEmails: [],
    });

    // Set up transporter mocks
    mockGetTransporter.mockResolvedValue(mockTransporter as any);
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to verify template files exist
  const verifyTemplateExists = async (templateName: string) => {
    const templatePath = path.resolve(__dirname, '..', 'templates', `${templateName}.html`);
    try {
      await fs.access(templatePath);
      return true;
    } catch {
      return false;
    }
  };

  describe('Template Files Verification', () => {
    it('should have all required template files', async () => {
      const requiredTemplates = [
        'password-reset',
        'password-changed',
        'login-notification',
        'two-factor-enabled',
        'email-signup-verification',
      ];

      for (const template of requiredTemplates) {
        const exists = await verifyTemplateExists(template);
        expect(exists, `Template ${template}.html should exist`).toBe(true);
      }
    });
  });

  describe('sendCustomEmail', () => {
    const validParams = {
      to: 'test@example.com',
      subject: 'Test Subject',
      template: EmailTemplate.PASSWORD_RESET,
      variables: {
        FIRST_NAME: 'John',
        RESET_URL: 'https://example.com/reset?token=123',
      },
    };

    it('should send email with valid parameters', async () => {
      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      expect(mockGetTransporter).toHaveBeenCalledOnce();
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"TestApp Team" <noreply@testapp.com>',
          to: 'test@example.com',
          subject: 'Test Subject',
          html: expect.any(String),
          text: expect.any(String),
        }),
      );
    });

    it('should use mock service when mocking is enabled', async () => {
      // Enable mocking for this specific test
      mockEmailMock.isEnabled.mockReturnValue(true);
      mockGetEmailMockConfig.mockReturnValue({
        enabled: true,
        logEmails: true,
        simulateDelay: false,
        delayMs: 0,
        simulateFailures: false,
        failureRate: 0,
        failOnEmails: [],
        blockEmails: [],
      });
      mockEmailMock.sendEmail.mockResolvedValue();

      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      expect(mockEmailMock.sendEmail).toHaveBeenCalledWith(
        validParams.to,
        validParams.subject,
        validParams.template,
        validParams.variables,
      );
      expect(mockGetTransporter).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for empty recipient email', async () => {
      await expect(
        sendCustomEmail('', validParams.subject, validParams.template, validParams.variables),
      ).rejects.toThrow(ValidationError);

      await expect(
        sendCustomEmail('   ', validParams.subject, validParams.template, validParams.variables),
      ).rejects.toThrow('Recipient email is required');
    });

    it('should throw ValidationError for empty subject', async () => {
      await expect(sendCustomEmail(validParams.to, '', validParams.template, validParams.variables)).rejects.toThrow(
        ValidationError,
      );

      await expect(sendCustomEmail(validParams.to, '   ', validParams.template, validParams.variables)).rejects.toThrow(
        'Email subject is required',
      );
    });

    it('should add common variables automatically', async () => {
      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      // Verify that APP_NAME and YEAR are automatically added
      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain('TestApp'); // APP_NAME replaced
      expect(sendMailCall.html).toContain(new Date().getFullYear().toString()); // YEAR replaced
    });

    it('should replace template variables in HTML content', async () => {
      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain('John'); // FIRST_NAME replaced
      expect(sendMailCall.html).toContain('https://example.com/reset?token=123'); // RESET_URL replaced
    });

    it('should generate plain text from HTML', async () => {
      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.text).toContain('John');
      expect(sendMailCall.text).toContain('https://example.com/reset?token=123');
      // Plain text should strip HTML tags
      expect(sendMailCall.text).not.toContain('<h1>');
      expect(sendMailCall.text).not.toContain('</h1>');
    });

    it('should throw ServerError when template file is not found', async () => {
      // Use a non-existent template
      await expect(
        sendCustomEmail(
          validParams.to,
          validParams.subject,
          'non-existent-template' as EmailTemplate,
          validParams.variables,
        ),
      ).rejects.toThrow(ServerError);
    });

    it('should throw ServerError when email sending fails', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(
        sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables),
      ).rejects.toThrow(ServerError);

      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
    });

    it('should reset transporter on connection errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('connection timeout'));

      await expect(
        sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables),
      ).rejects.toThrow(ServerError);

      expect(mockResetTransporter).toHaveBeenCalledOnce();
    });

    it('should handle missing template variables gracefully', async () => {
      // This should throw ValidationError for missing required variables
      await expect(
        sendCustomEmail(
          validParams.to,
          validParams.subject,
          validParams.template,
          { FIRST_NAME: 'John' }, // Missing RESET_URL
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('sendPasswordResetEmail', () => {
    const validParams = {
      email: 'user@example.com',
      firstName: 'John',
      token: 'reset-token-123',
      callbackUrl: 'https://app.example.com/reset',
    };

    it('should send password reset email with valid parameters', async () => {
      await sendPasswordResetEmail(
        validParams.email,
        validParams.firstName,
        validParams.token,
        validParams.callbackUrl,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validParams.email,
          subject: expect.stringContaining('Reset your password for TestApp'),
        }),
      );
    });

    it('should construct reset URL with token parameter', async () => {
      await sendPasswordResetEmail(
        validParams.email,
        validParams.firstName,
        validParams.token,
        validParams.callbackUrl,
      );

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain(`${validParams.callbackUrl}?token=${encodeURIComponent(validParams.token)}`);
    });

    it('should throw ValidationError for missing required parameters', async () => {
      await expect(
        sendPasswordResetEmail('', validParams.firstName, validParams.token, validParams.callbackUrl),
      ).rejects.toThrow('Email, firstName, token, and callbackUrl are required');

      await expect(
        sendPasswordResetEmail(validParams.email, '', validParams.token, validParams.callbackUrl),
      ).rejects.toThrow('Email, firstName, token, and callbackUrl are required');

      await expect(
        sendPasswordResetEmail(validParams.email, validParams.firstName, '', validParams.callbackUrl),
      ).rejects.toThrow('Email, firstName, token, and callbackUrl are required');

      await expect(
        sendPasswordResetEmail(validParams.email, validParams.firstName, validParams.token, ''),
      ).rejects.toThrow('Email, firstName, token, and callbackUrl are required');
    });

    it('should validate callback URL format', async () => {
      vi.spyOn(ValidationUtils, 'validateUrl').mockImplementation((url) => {
        if (url === 'invalid-url') {
          throw new ValidationError('Invalid URL format');
        }
      });

      await expect(
        sendPasswordResetEmail(validParams.email, validParams.firstName, validParams.token, 'invalid-url'),
      ).rejects.toThrow('Invalid URL format');
    });

    it('should handle URL encoding in reset URL', async () => {
      const tokenWithSpecialChars = 'token+with/special=chars';

      await sendPasswordResetEmail(
        validParams.email,
        validParams.firstName,
        tokenWithSpecialChars,
        validParams.callbackUrl,
      );

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain(encodeURIComponent(tokenWithSpecialChars));
    });
  });

  describe('sendPasswordChangedNotification', () => {
    const validParams = {
      email: 'user@example.com',
      firstName: 'John',
    };

    it('should send password changed notification', async () => {
      await sendPasswordChangedNotification(validParams.email, validParams.firstName);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validParams.email,
          subject: expect.stringContaining('Your password was changed on TestApp'),
        }),
      );
    });

    it('should include current date and time in email', async () => {
      const beforeSend = new Date();

      await sendPasswordChangedNotification(validParams.email, validParams.firstName);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      const afterSend = new Date();

      // Check that date/time within reasonable range
      const dateInEmail = sendMailCall.html;
      expect(dateInEmail).toContain(beforeSend.toLocaleDateString());
    });

    it('should throw ValidationError for missing parameters', async () => {
      await expect(sendPasswordChangedNotification('', validParams.firstName)).rejects.toThrow(
        'Email and firstName are required',
      );

      await expect(sendPasswordChangedNotification(validParams.email, '')).rejects.toThrow(
        'Email and firstName are required',
      );
    });
  });

  describe('sendLoginNotification', () => {
    const validParams = {
      email: 'user@example.com',
      firstName: 'John',
      ipAddress: '192.168.1.1',
      device: 'Chrome on Windows 10',
    };

    it('should send login notification with all details', async () => {
      await sendLoginNotification(validParams.email, validParams.firstName, validParams.ipAddress, validParams.device);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validParams.email,
          subject: expect.stringContaining('New login detected on TestApp'),
        }),
      );
    });

    it('should include login details in email content', async () => {
      await sendLoginNotification(validParams.email, validParams.firstName, validParams.ipAddress, validParams.device);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain(validParams.ipAddress);
      expect(sendMailCall.html).toContain(validParams.device);
      expect(sendMailCall.html).toContain(validParams.firstName);
    });

    it('should throw ValidationError for missing parameters', async () => {
      await expect(
        sendLoginNotification('', validParams.firstName, validParams.ipAddress, validParams.device),
      ).rejects.toThrow('Email, firstName, ipAddress, and device are required');

      await expect(
        sendLoginNotification(validParams.email, '', validParams.ipAddress, validParams.device),
      ).rejects.toThrow('Email, firstName, ipAddress, and device are required');

      await expect(
        sendLoginNotification(validParams.email, validParams.firstName, '', validParams.device),
      ).rejects.toThrow('Email, firstName, ipAddress, and device are required');

      await expect(
        sendLoginNotification(validParams.email, validParams.firstName, validParams.ipAddress, ''),
      ).rejects.toThrow('Email, firstName, ipAddress, and device are required');
    });
  });

  describe('sendTwoFactorEnabledNotification', () => {
    const validParams = {
      email: 'user@example.com',
      firstName: 'John',
    };

    it('should send 2FA enabled notification', async () => {
      await sendTwoFactorEnabledNotification(validParams.email, validParams.firstName);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validParams.email,
          subject: expect.stringContaining('Two-factor authentication enabled on TestApp'),
        }),
      );
    });

    it('should include current date in email', async () => {
      await sendTwoFactorEnabledNotification(validParams.email, validParams.firstName);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      const currentDate = new Date().toLocaleDateString();
      expect(sendMailCall.html).toContain(currentDate);
    });

    it('should throw ValidationError for missing parameters', async () => {
      await expect(sendTwoFactorEnabledNotification('', validParams.firstName)).rejects.toThrow(
        'Email and firstName are required',
      );

      await expect(sendTwoFactorEnabledNotification(validParams.email, '')).rejects.toThrow(
        'Email and firstName are required',
      );
    });
  });

  describe('sendSignupEmailVerification', () => {
    const validParams = {
      email: 'user@example.com',
      token: 'verification-token-123',
      callbackUrl: 'https://app.example.com/verify',
    };

    it('should send signup email verification', async () => {
      await sendSignupEmailVerification(validParams.email, validParams.token, validParams.callbackUrl);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validParams.email,
          subject: expect.stringContaining('Verify your email to continue with TestApp'),
        }),
      );
    });

    it('should construct verification URL with token parameter', async () => {
      await sendSignupEmailVerification(validParams.email, validParams.token, validParams.callbackUrl);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain(`${validParams.callbackUrl}?token=${encodeURIComponent(validParams.token)}`);
    });

    it('should throw ValidationError for missing parameters', async () => {
      await expect(sendSignupEmailVerification('', validParams.token, validParams.callbackUrl)).rejects.toThrow(
        'Email, token, and callbackUrl are required',
      );

      await expect(sendSignupEmailVerification(validParams.email, '', validParams.callbackUrl)).rejects.toThrow(
        'Email, token, and callbackUrl are required',
      );

      await expect(sendSignupEmailVerification(validParams.email, validParams.token, '')).rejects.toThrow(
        'Email, token, and callbackUrl are required',
      );
    });

    it('should validate callback URL format', async () => {
      vi.spyOn(ValidationUtils, 'validateUrl').mockImplementation((url) => {
        if (url === 'invalid-url') {
          throw new ValidationError('Invalid URL format');
        }
      });

      await expect(sendSignupEmailVerification(validParams.email, validParams.token, 'invalid-url')).rejects.toThrow(
        'Invalid URL format',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle SMTP authentication errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(
        new Error('Invalid login: 535-5.7.8 Username and Password not accepted'),
      );

      await expect(sendPasswordResetEmail('test@example.com', 'John', 'token', 'https://example.com')).rejects.toThrow(
        ServerError,
      );
    });

    it('should handle network timeout errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('ETIMEDOUT: connection timeout'));

      await expect(sendPasswordResetEmail('test@example.com', 'John', 'token', 'https://example.com')).rejects.toThrow(
        ServerError,
      );

      expect(mockResetTransporter).toHaveBeenCalledOnce();
    });

    it('should handle transporter creation failures', async () => {
      mockGetTransporter.mockRejectedValue(new Error('Failed to create transporter'));

      await expect(sendPasswordResetEmail('test@example.com', 'John', 'token', 'https://example.com')).rejects.toThrow(
        Error,
      );
    });

    it('should handle template loading failures gracefully', async () => {
      // Use a non-existent template to trigger template loading failure
      await expect(
        sendCustomEmail('test@example.com', 'Test', 'non-existent-template' as EmailTemplate, {
          FIRST_NAME: 'John',
          RESET_URL: 'url',
        }),
      ).rejects.toThrow(ServerError);
    });

    it('should handle malformed template content', async () => {
      // The real templates should work fine, but missing variables should throw ValidationError
      await expect(
        sendCustomEmail('test@example.com', 'Test', EmailTemplate.PASSWORD_RESET, { VARIABLE: 'value' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle email addresses with special characters', async () => {
      const specialEmail = 'user+test@example-domain.co.uk';

      await sendPasswordResetEmail(specialEmail, 'John', 'token', 'https://example.com');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: specialEmail,
        }),
      );
    });

    it('should handle very long callback URLs', async () => {
      const longUrl =
        'https://very-long-domain-name.example.com/very/long/path/with/many/segments' + '?param=' + 'a'.repeat(500);

      await sendPasswordResetEmail('test@example.com', 'John', 'token', longUrl);

      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
    });

    it('should handle Unicode characters in names', async () => {
      const unicodeName = 'José María';

      await sendPasswordChangedNotification('test@example.com', unicodeName);

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain(unicodeName);
    });

    it('should handle empty template variables object', async () => {
      await expect(sendCustomEmail('test@example.com', 'Test', EmailTemplate.PASSWORD_RESET, {})).rejects.toThrow(
        ValidationError,
      ); // Should throw due to missing required variables
    });

    it('should handle tokens with special URL characters', async () => {
      const specialToken = 'token+with/special=chars&more';

      await sendPasswordResetEmail('test@example.com', 'John', specialToken, 'https://example.com');

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain(encodeURIComponent(specialToken));
    });
  });

  describe('Mock Service Integration Tests', () => {
    beforeEach(() => {
      // Enable mocking for these specific tests
      mockEmailMock.isEnabled.mockReturnValue(true);
      mockGetEmailMockConfig.mockReturnValue({
        enabled: true,
        logEmails: true,
        simulateDelay: false,
        delayMs: 0,
        simulateFailures: false,
        failureRate: 0,
        failOnEmails: [],
        blockEmails: [],
      });
    });

    it('should use mock service for all email functions when enabled', async () => {
      mockEmailMock.sendEmail.mockResolvedValue();

      // Test sendCustomEmail
      await sendCustomEmail('test@example.com', 'Test', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
        RESET_URL: 'https://example.com/reset',
      });

      expect(mockEmailMock.sendEmail).toHaveBeenCalledWith('test@example.com', 'Test', EmailTemplate.PASSWORD_RESET, {
        FIRST_NAME: 'John',
        RESET_URL: 'https://example.com/reset',
      });
      expect(mockGetTransporter).not.toHaveBeenCalled();
    });

    it('should handle mock service failures', async () => {
      mockEmailMock.sendEmail.mockRejectedValue(new Error('Mock service failure'));

      await expect(
        sendCustomEmail('test@example.com', 'Test', EmailTemplate.PASSWORD_RESET, {
          FIRST_NAME: 'John',
          RESET_URL: 'https://example.com/reset',
        }),
      ).rejects.toThrow('Mock service failure');

      expect(mockGetTransporter).not.toHaveBeenCalled();
    });
  });
});
