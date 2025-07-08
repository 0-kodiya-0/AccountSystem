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
import { ValidationError } from '../../../types/response.types';
import { emailMock } from '../../../mocks/email/EmailServiceMock';

vi.mock('../../../config/env.config', () => ({
  getAppName: () => 'TestApp',
  getSenderEmail: () => 'noreply@testapp.com',
  getSenderName: () => 'TestApp Team',
  getNodeEnv: () => 'test',
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailMock.clearSentEmails();
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

    it('should send email with valid parameters through mock service', async () => {
      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(validParams.to);
      expect(sentEmails[0].subject).toBe(validParams.subject);
      expect(sentEmails[0].template).toBe(validParams.template);
      expect(sentEmails[0].variables).toEqual(validParams.variables);
      expect(sentEmails[0].status).toBe('sent');
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

    it('should include template variables in sent email', async () => {
      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain('John'); // FIRST_NAME replaced
      expect(sentEmail.html).toContain('https://example.com/reset?token=123'); // RESET_URL replaced
      expect(sentEmail.html).toContain('TestApp'); // APP_NAME added automatically
      expect(sentEmail.html).toContain(new Date().getFullYear().toString()); // YEAR added automatically
    });

    it('should generate plain text from HTML', async () => {
      await sendCustomEmail(validParams.to, validParams.subject, validParams.template, validParams.variables);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.text).toContain('John');
      expect(sentEmail.text).toContain('https://example.com/reset?token=123');
      // Plain text should not contain HTML tags
      expect(sentEmail.text).not.toContain('<h1>');
      expect(sentEmail.text).not.toContain('</h1>');
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

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(validParams.email);
      expect(sentEmails[0].subject).toContain('Reset your password for TestApp');
      expect(sentEmails[0].template).toBe(EmailTemplate.PASSWORD_RESET);
    });

    it('should include metadata for password reset flow', async () => {
      await sendPasswordResetEmail(
        validParams.email,
        validParams.firstName,
        validParams.token,
        validParams.callbackUrl,
      );

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.metadata?.emailFlow).toBe('password-reset');
      expect(sentEmail.metadata?.flowStep).toBe('initial');
      expect(sentEmail.metadata?.feature).toBe('authentication');
      expect(sentEmail.metadata?.action).toBe('reset-password');
      expect(sentEmail.metadata?.triggerReason).toBe('user-action');
      expect(sentEmail.metadata?.token).toBe('reset-token-123'); // Truncated token
    });

    it('should construct reset URL with token parameter', async () => {
      await sendPasswordResetEmail(
        validParams.email,
        validParams.firstName,
        validParams.token,
        validParams.callbackUrl,
      );

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain(`${validParams.callbackUrl}?token=${encodeURIComponent(validParams.token)}`);
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
      await expect(
        sendPasswordResetEmail(validParams.email, validParams.firstName, validParams.token, 'invalid-url'),
      ).rejects.toThrow('Invalid Callback URL format');
    });

    it('should handle URL encoding in reset URL', async () => {
      const tokenWithSpecialChars = 'token+with/special=chars';

      await sendPasswordResetEmail(
        validParams.email,
        validParams.firstName,
        tokenWithSpecialChars,
        validParams.callbackUrl,
      );

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain(encodeURIComponent(tokenWithSpecialChars));
    });
  });

  describe('sendPasswordChangedNotification', () => {
    const validParams = {
      email: 'user@example.com',
      firstName: 'John',
    };

    it('should send password changed notification', async () => {
      await sendPasswordChangedNotification(validParams.email, validParams.firstName);

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(validParams.email);
      expect(sentEmails[0].subject).toContain('Your password was changed on TestApp');
      expect(sentEmails[0].template).toBe(EmailTemplate.PASSWORD_CHANGED);
    });

    it('should include metadata for password changed flow', async () => {
      await sendPasswordChangedNotification(validParams.email, validParams.firstName);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.metadata?.emailFlow).toBe('password-management');
      expect(sentEmail.metadata?.flowStep).toBe('confirmation');
      expect(sentEmail.metadata?.feature).toBe('authentication');
      expect(sentEmail.metadata?.action).toBe('password-changed');
      expect(sentEmail.metadata?.triggerReason).toBe('system-event');
    });

    it('should include current date and time in email', async () => {
      const beforeSend = new Date();

      await sendPasswordChangedNotification(validParams.email, validParams.firstName);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain(beforeSend.toLocaleDateString());
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

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(validParams.email);
      expect(sentEmails[0].subject).toContain('New login detected on TestApp');
      expect(sentEmails[0].template).toBe(EmailTemplate.LOGIN_NOTIFICATION);
    });

    it('should include metadata for login notification flow', async () => {
      await sendLoginNotification(validParams.email, validParams.firstName, validParams.ipAddress, validParams.device);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.metadata?.emailFlow).toBe('security-notification');
      expect(sentEmail.metadata?.flowStep).toBe('alert');
      expect(sentEmail.metadata?.feature).toBe('authentication');
      expect(sentEmail.metadata?.action).toBe('login-detected');
      expect(sentEmail.metadata?.triggerReason).toBe('user-action');
      expect(sentEmail.metadata?.ipAddress).toBe(validParams.ipAddress);
      expect(sentEmail.metadata?.userAgent).toBe(validParams.device);
    });

    it('should include login details in email content', async () => {
      await sendLoginNotification(validParams.email, validParams.firstName, validParams.ipAddress, validParams.device);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain(validParams.ipAddress);
      expect(sentEmail.html).toContain(validParams.device);
      expect(sentEmail.html).toContain(validParams.firstName);
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

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(validParams.email);
      expect(sentEmails[0].subject).toContain('Two-factor authentication enabled on TestApp');
      expect(sentEmails[0].template).toBe(EmailTemplate.TWO_FACTOR_ENABLED);
    });

    it('should include metadata for 2FA enabled flow', async () => {
      await sendTwoFactorEnabledNotification(validParams.email, validParams.firstName);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.metadata?.emailFlow).toBe('security-enhancement');
      expect(sentEmail.metadata?.flowStep).toBe('confirmation');
      expect(sentEmail.metadata?.feature).toBe('two-factor-auth');
      expect(sentEmail.metadata?.action).toBe('enable-2fa');
      expect(sentEmail.metadata?.triggerReason).toBe('user-action');
    });

    it('should include current date in email', async () => {
      await sendTwoFactorEnabledNotification(validParams.email, validParams.firstName);

      const sentEmail = emailMock.getSentEmails()[0];
      const currentDate = new Date().toLocaleDateString();
      expect(sentEmail.html).toContain(currentDate);
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

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(validParams.email);
      expect(sentEmails[0].subject).toContain('Verify your email to continue with TestApp');
      expect(sentEmails[0].template).toBe(EmailTemplate.EMAIL_SIGNUP_VERIFICATION);
    });

    it('should include metadata for signup verification flow', async () => {
      await sendSignupEmailVerification(validParams.email, validParams.token, validParams.callbackUrl);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.metadata?.emailFlow).toBe('signup');
      expect(sentEmail.metadata?.flowStep).toBe('email-verification');
      expect(sentEmail.metadata?.feature).toBe('authentication');
      expect(sentEmail.metadata?.action).toBe('verify-email');
      expect(sentEmail.metadata?.triggerReason).toBe('user-action');
      expect(sentEmail.metadata?.token).toBe('verification-token-123'); // Truncated token
    });

    it('should construct verification URL with token parameter', async () => {
      await sendSignupEmailVerification(validParams.email, validParams.token, validParams.callbackUrl);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain(`${validParams.callbackUrl}?token=${encodeURIComponent(validParams.token)}`);
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
  });

  describe('Edge Cases', () => {
    it('should handle email addresses with special characters', async () => {
      const specialEmail = 'user+test@example-domain.co.uk';

      await sendPasswordResetEmail(specialEmail, 'John', 'token', 'https://example.com');

      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails[0].to).toBe(specialEmail);
    });

    it('should handle Unicode characters in names', async () => {
      const unicodeName = 'José María';

      await sendPasswordChangedNotification('test@example.com', unicodeName);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain(unicodeName);
    });

    it('should handle tokens with special URL characters', async () => {
      const specialToken = 'token+with/special=chars&more';

      await sendPasswordResetEmail('test@example.com', 'John', specialToken, 'https://example.com');

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.html).toContain(encodeURIComponent(specialToken));
    });

    it('should merge custom metadata with automatic metadata', async () => {
      const customMetadata = {
        testId: 'custom-test-001',
        accountId: 'acc-123',
        customField: 'customValue',
      };

      await sendPasswordResetEmail('test@example.com', 'John', 'token', 'https://example.com', customMetadata);

      const sentEmail = emailMock.getSentEmails()[0];
      expect(sentEmail.metadata?.testId).toBe('custom-test-001');
      expect(sentEmail.metadata?.accountId).toBe('acc-123');
      expect(sentEmail.metadata?.customField).toBe('customValue');
      // Also check that automatic metadata is still present
      expect(sentEmail.metadata?.emailFlow).toBe('password-reset');
      expect(sentEmail.metadata?.action).toBe('reset-password');
    });
  });
});
