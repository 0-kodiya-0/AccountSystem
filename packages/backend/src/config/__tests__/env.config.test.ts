import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { envConfig } from '../env.config';
import {
  getJwtSecret,
  getSessionSecret,
  getPort,
  getNodeEnv,
  getBaseUrl,
  getProxyUrl,
  getAppName,
  getAccountsDbUri,
  getGoogleClientId,
  getGoogleClientSecret,
  getMicrosoftClientId,
  getMicrosoftClientSecret,
  getFacebookClientId,
  getFacebookClientSecret,
  getSmtpHost,
  getSmtpPort,
  getSmtpSecure,
  getSmtpAppPassword,
  getSenderEmail,
  getSenderName,
  getAccessTokenExpiry,
  getRefreshTokenExpiry,
  getCookieMaxAge,
  getMongodbUsername,
  getMongodbPassword,
  getInternalPort,
  getInternalServerEnabled,
  getInternalServerKeyPath,
  getInternalServerCertPath,
  getInternalCACertPath,
  isMockEnabled,
  getMockEnabled,
} from '../env.config';

describe('env.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear the module cache and reset environment
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Configuration Singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = envConfig;
      const instance2 = envConfig;
      expect(instance1).toBe(instance2);
    });

    it('should initialize automatically on import', () => {
      expect(envConfig).toBeDefined();
      expect(typeof envConfig.get).toBe('function');
      expect(typeof envConfig.initialize).toBe('function');
    });
  });

  describe('Required Environment Variables Validation', () => {
    it('should throw error for missing JWT_SECRET', () => {
      delete process.env.JWT_SECRET;

      // Mock process.exit to prevent actual exit during tests
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      expect(() => {
        // Force re-initialization by creating new instance
        envConfig.initialize();
      }).toThrow();

      exitSpy.mockRestore();
    });

    it('should validate all required environment variables are checked', () => {
      const requiredVars = [
        'JWT_SECRET',
        'SESSION_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'BASE_URL',
        'APP_NAME',
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_SECURE',
        'SMTP_APP_PASSWORD',
        'SENDER_EMAIL',
        'SENDER_NAME',
        'MONGODB_USERNAME',
        'MONGODB_PASSWORD',
      ];

      // Set all required vars to valid values
      requiredVars.forEach((varName) => {
        process.env[varName] = 'test-value';
      });

      expect(() => envConfig.initialize()).not.toThrow();
    });
  });

  describe('Environment Variable Getters', () => {
    beforeEach(() => {
      // Set up test environment variables
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.SESSION_SECRET = 'test-session-secret';
      process.env.PORT = '3001';
      process.env.NODE_ENV = 'test';
      process.env.BASE_URL = '/test-api';
      process.env.PROXY_URL = 'http://test-proxy:8000';
      process.env.APP_NAME = 'TestApp';
      process.env.ACCOUNTS_DB_URI = 'mongodb://test-db/accounts';
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
      process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-secret';
      process.env.FACEBOOK_CLIENT_ID = 'test-facebook-id';
      process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-secret';
      process.env.SMTP_HOST = 'test-smtp-host';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_APP_PASSWORD = 'test-smtp-password';
      process.env.SENDER_EMAIL = 'test@example.com';
      process.env.SENDER_NAME = 'Test Sender';
      process.env.ACCESS_TOKEN_EXPIRY = '2h';
      process.env.REFRESH_TOKEN_EXPIRY = '14d';
      process.env.COOKIE_MAX_AGE = '86400000';
      process.env.MONGODB_USERNAME = 'test-username';
      process.env.MONGODB_PASSWORD = 'test-password';
      process.env.INTERNAL_PORT = '5000';
      process.env.INTERNAL_SERVER_ENABLED = 'true';
      process.env.INTERNAL_SERVER_KEY_PATH = '/test/key.pem';
      process.env.INTERNAL_SERVER_CERT_PATH = '/test/cert.pem';
      process.env.INTERNAL_CA_CERT_PATH = '/test/ca.pem';
      process.env.MOCK_ENABLED = 'true';

      envConfig.initialize();
    });

    it('should return correct JWT secret', () => {
      expect(getJwtSecret()).toBe('test-jwt-secret');
    });

    it('should return correct session secret', () => {
      expect(getSessionSecret()).toBe('test-session-secret');
    });

    it('should return correct port as number', () => {
      expect(getPort()).toBe(3001);
    });

    it('should return correct node environment', () => {
      expect(getNodeEnv()).toBe('test');
    });

    it('should return correct base URL', () => {
      expect(getBaseUrl()).toBe('/test-api');
    });

    it('should return correct proxy URL', () => {
      expect(getProxyUrl()).toBe('http://test-proxy:8000');
    });

    it('should return correct app name', () => {
      expect(getAppName()).toBe('TestApp');
    });

    it('should return correct accounts DB URI', () => {
      expect(getAccountsDbUri()).toBe('mongodb://test-db/accounts');
    });

    it('should return correct Google OAuth credentials', () => {
      expect(getGoogleClientId()).toBe('test-google-client-id');
      expect(getGoogleClientSecret()).toBe('test-google-secret');
    });

    it('should return correct Microsoft OAuth credentials', () => {
      expect(getMicrosoftClientId()).toBe('test-microsoft-id');
      expect(getMicrosoftClientSecret()).toBe('test-microsoft-secret');
    });

    it('should return correct Facebook OAuth credentials', () => {
      expect(getFacebookClientId()).toBe('test-facebook-id');
      expect(getFacebookClientSecret()).toBe('test-facebook-secret');
    });

    it('should return correct SMTP configuration', () => {
      expect(getSmtpHost()).toBe('test-smtp-host');
      expect(getSmtpPort()).toBe(587);
      expect(getSmtpSecure()).toBe(true);
      expect(getSmtpAppPassword()).toBe('test-smtp-password');
      expect(getSenderEmail()).toBe('test@example.com');
      expect(getSenderName()).toBe('Test Sender');
    });

    it('should return correct token expiry settings', () => {
      expect(getAccessTokenExpiry()).toBe('2h');
      expect(getRefreshTokenExpiry()).toBe('14d');
      expect(getCookieMaxAge()).toBe(86400000);
    });

    it('should return correct MongoDB credentials', () => {
      expect(getMongodbUsername()).toBe('test-username');
      expect(getMongodbPassword()).toBe('test-password');
    });

    it('should return correct internal server configuration', () => {
      expect(getInternalPort()).toBe(5000);
      expect(getInternalServerEnabled()).toBe(true);
      expect(getInternalServerKeyPath()).toBe('/test/key.pem');
      expect(getInternalServerCertPath()).toBe('/test/cert.pem');
      expect(getInternalCACertPath()).toBe('/test/ca.pem');
    });

    it('should return correct mock configuration', () => {
      expect(isMockEnabled()).toBe(true);
      expect(getMockEnabled()).toBe(true);
    });
  });

  describe('Default Values', () => {
    beforeEach(() => {
      // Set only required variables, leave optional ones undefined
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.SESSION_SECRET = 'test-session-secret';
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
      process.env.BASE_URL = '/api';
      process.env.APP_NAME = 'TestApp';
      process.env.SMTP_HOST = 'test-smtp-host';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_APP_PASSWORD = 'test-password';
      process.env.SENDER_EMAIL = 'test@example.com';
      process.env.SENDER_NAME = 'Test Sender';
      process.env.MONGODB_USERNAME = 'test-username';
      process.env.MONGODB_PASSWORD = 'test-password';

      // Clear optional variables
      delete process.env.PORT;
      delete process.env.NODE_ENV;
      delete process.env.PROXY_URL;
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.FACEBOOK_CLIENT_ID;
      delete process.env.MOCK_ENABLED;

      envConfig.initialize();
    });

    it('should use default port', () => {
      expect(getPort()).toBe(3000);
    });

    it('should use default node environment', () => {
      expect(getNodeEnv()).toBe('development');
    });

    it('should use default proxy URL', () => {
      expect(getProxyUrl()).toBe('http://localhost:7000');
    });

    it('should return empty string for optional OAuth credentials', () => {
      expect(getMicrosoftClientId()).toBe('');
      expect(getFacebookClientId()).toBe('');
    });

    it('should use default mock configuration', () => {
      expect(getMockEnabled()).toBe(false);
    });
  });

  describe('Environment Detection Methods', () => {
    it('should correctly identify production environment', () => {
      process.env.NODE_ENV = 'production';
      envConfig.initialize();
      expect(envConfig.isProduction()).toBe(true);
      expect(envConfig.isDevelopment()).toBe(false);
      expect(envConfig.isTest()).toBe(false);
    });

    it('should correctly identify development environment', () => {
      process.env.NODE_ENV = 'development';
      envConfig.initialize();
      expect(envConfig.isProduction()).toBe(false);
      expect(envConfig.isDevelopment()).toBe(true);
      expect(envConfig.isTest()).toBe(false);
    });

    it('should correctly identify test environment', () => {
      process.env.NODE_ENV = 'test';
      envConfig.initialize();
      expect(envConfig.isProduction()).toBe(false);
      expect(envConfig.isDevelopment()).toBe(false);
      expect(envConfig.isTest()).toBe(true);
    });

    it('should correctly identify mock enabled state', () => {
      process.env.MOCK_ENABLED = 'true';
      envConfig.initialize();
      expect(envConfig.isMockEnabled()).toBe(true);

      process.env.MOCK_ENABLED = 'false';
      envConfig.initialize();
      expect(envConfig.isMockEnabled()).toBe(false);
    });
  });

  describe('Config Object Methods', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.SESSION_SECRET = 'test-session-secret';
      process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
      process.env.BASE_URL = '/api';
      process.env.APP_NAME = 'TestApp';
      process.env.SMTP_HOST = 'test-smtp-host';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_APP_PASSWORD = 'test-password';
      process.env.SENDER_EMAIL = 'test@example.com';
      process.env.SENDER_NAME = 'Test Sender';
      process.env.MONGODB_USERNAME = 'test-username';
      process.env.MONGODB_PASSWORD = 'test-password';
      process.env.TEST_VAR = 'test-value';

      envConfig.initialize();
    });

    it('should return individual config values', () => {
      expect(envConfig.get('JWT_SECRET')).toBe('test-jwt-secret');
      expect(envConfig.get('APP_NAME')).toBe('TestApp');
    });

    it('should return all config values', () => {
      const allConfig = envConfig.getAll();
      expect(allConfig).toBeInstanceOf(Object);
      expect(allConfig.JWT_SECRET).toBe('test-jwt-secret');
      expect(allConfig.APP_NAME).toBe('TestApp');
    });
  });
});
