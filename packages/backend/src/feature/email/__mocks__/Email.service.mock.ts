import { emailMock } from '../../../mocks/email/EmailServiceMock';
import { EmailTemplate } from '../Email.types';

/**
 * Check if email mocking is enabled
 */
export function isEmailMockEnabled(): boolean {
  return emailMock.isEnabled();
}

/**
 * Mock implementation that uses the same template system as the real service
 */
export async function sendCustomEmailMock(
  to: string,
  subject: string,
  template: EmailTemplate,
  variables: Record<string, string>,
): Promise<void> {
  return emailMock.sendEmail(to, subject, template, variables);
}

/**
 * Mock implementations using your existing email service patterns
 */
export async function sendPasswordResetEmailMock(
  email: string,
  firstName: string,
  token: string,
  callbackUrl: string,
): Promise<void> {
  return sendCustomEmailMock(email, `Reset your password for AccountSystem`, EmailTemplate.PASSWORD_RESET, {
    FIRST_NAME: firstName,
    RESET_URL: `${callbackUrl}?token=${encodeURIComponent(token)}`,
  });
}

export async function sendPasswordChangedNotificationMock(email: string, firstName: string): Promise<void> {
  const now = new Date();
  return sendCustomEmailMock(email, `Your password was changed on AccountSystem`, EmailTemplate.PASSWORD_CHANGED, {
    FIRST_NAME: firstName,
    DATE: now.toLocaleDateString(),
    TIME: now.toLocaleTimeString(),
  });
}

export async function sendLoginNotificationMock(
  email: string,
  firstName: string,
  ipAddress: string,
  device: string,
): Promise<void> {
  const now = new Date();
  return sendCustomEmailMock(email, `New login detected on AccountSystem`, EmailTemplate.LOGIN_NOTIFICATION, {
    FIRST_NAME: firstName,
    LOGIN_TIME: now.toLocaleString(),
    IP_ADDRESS: ipAddress,
    DEVICE: device,
  });
}

export async function sendTwoFactorEnabledNotificationMock(email: string, firstName: string): Promise<void> {
  const now = new Date();
  return sendCustomEmailMock(
    email,
    `Two-factor authentication enabled on AccountSystem`,
    EmailTemplate.TWO_FACTOR_ENABLED,
    {
      FIRST_NAME: firstName,
      DATE: now.toLocaleDateString(),
    },
  );
}

export async function sendSignupEmailVerificationMock(
  email: string,
  token: string,
  callbackUrl: string,
): Promise<void> {
  return sendCustomEmailMock(
    email,
    `Verify your email to continue with AccountSystem`,
    EmailTemplate.EMAIL_SIGNUP_VERIFICATION,
    {
      EMAIL: email,
      VERIFICATION_URL: `${callbackUrl}?token=${encodeURIComponent(token)}`,
    },
  );
}
