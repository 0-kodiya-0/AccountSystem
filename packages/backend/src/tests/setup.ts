import { beforeEach, vi } from 'vitest';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests';
process.env.SESSION_SECRET = 'test-session-secret-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.BASE_URL = '/api';
process.env.PROXY_URL = 'http://localhost:7000';
process.env.APP_NAME = 'TestApp';
process.env.SMTP_HOST = 'test-smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_APP_PASSWORD = 'test-smtp-password';
process.env.SENDER_EMAIL = 'noreply@testapp.com';
process.env.SENDER_NAME = 'TestApp Team';
process.env.ACCOUNTS_DB_URI = 'mongodb://localhost:27017/test-accounts';
process.env.ACCESS_TOKEN_EXPIRY = '1h';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
process.env.COOKIE_MAX_AGE = '31536000000';
process.env.INTERNAL_PORT = '4443';
process.env.INTERNAL_SERVER_ENABLED = 'false';

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});
