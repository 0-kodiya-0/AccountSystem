import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, debug, info, warn, error, setLogLevel, getLogLevel } from '../logger';

describe('Logger Utils', () => {
  const originalEnv = process.env;

  // Mock console methods
  const consoleMocks = {
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };

  beforeEach(() => {
    // Clear all console mocks
    Object.values(consoleMocks).forEach((mock) => mock.mockClear());

    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.LOG_LEVEL;
    delete process.env.DEBUG_MODE;
    delete process.env.QUIET_MODE;

    // Reset to default log level
    setLogLevel('info');
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Log Format Validation', () => {
    it('should format message with correct timestamp and level', () => {
      info('Test message');

      expect(consoleMocks.info).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.info.mock.calls[0][0];

      // Check format: [timestamp] [LEVEL] [BACKEND] message
      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[BACKEND\] Test message$/,
      );
    });

    it('should format debug messages correctly', () => {
      setLogLevel('debug');
      debug('Debug message');

      expect(consoleMocks.debug).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.debug.mock.calls[0][0];

      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[DEBUG\] \[BACKEND\] Debug message$/,
      );
    });

    it('should format warn messages correctly', () => {
      warn('Warning message');

      expect(consoleMocks.warn).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.warn.mock.calls[0][0];

      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] \[BACKEND\] Warning message$/,
      );
    });

    it('should format error messages correctly', () => {
      error('Error message');

      expect(consoleMocks.error).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.error.mock.calls[0][0];

      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] \[BACKEND\] Error message$/,
      );
    });

    it('should format messages with metadata correctly', () => {
      const metadata = { userId: '123', action: 'login' };
      info('User action', metadata);

      expect(consoleMocks.info).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.info.mock.calls[0][0];

      // Should include JSON stringified metadata
      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[BACKEND\] User action {"userId":"123","action":"login"}$/,
      );
    });

    it('should handle non-string messages', () => {
      const objectMessage = { type: 'error', code: 500 };
      info(objectMessage);

      expect(consoleMocks.info).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.info.mock.calls[0][0];

      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[BACKEND\] {"type":"error","code":500}$/,
      );
    });

    it('should handle empty metadata gracefully', () => {
      info('Message', {});

      expect(consoleMocks.info).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.info.mock.calls[0][0];

      // Should not include empty metadata
      expect(loggedMessage).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[BACKEND\] Message$/);
    });

    it('should handle string metadata', () => {
      info('Message', 'additional info');

      expect(consoleMocks.info).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.info.mock.calls[0][0];

      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[BACKEND\] Message additional info$/,
      );
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect debug log level', () => {
      setLogLevel('debug');

      debug('Debug message');
      info('Info message');
      warn('Warn message');
      error('Error message');

      expect(consoleMocks.debug).toHaveBeenCalledOnce();
      expect(consoleMocks.info).toHaveBeenCalledOnce();
      expect(consoleMocks.warn).toHaveBeenCalledOnce();
      expect(consoleMocks.error).toHaveBeenCalledOnce();
    });

    it('should respect info log level (default)', () => {
      setLogLevel('info');

      debug('Debug message');
      info('Info message');
      warn('Warn message');
      error('Error message');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).toHaveBeenCalledOnce();
      expect(consoleMocks.warn).toHaveBeenCalledOnce();
      expect(consoleMocks.error).toHaveBeenCalledOnce();
    });

    it('should respect warn log level', () => {
      setLogLevel('warn');

      debug('Debug message');
      info('Info message');
      warn('Warn message');
      error('Error message');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).toHaveBeenCalledOnce();
      expect(consoleMocks.error).toHaveBeenCalledOnce();
    });

    it('should respect error log level', () => {
      setLogLevel('error');

      debug('Debug message');
      info('Info message');
      warn('Warn message');
      error('Error message');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).not.toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalledOnce();
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should use LOG_LEVEL from environment', () => {
      process.env.LOG_LEVEL = 'warn';

      // Re-import to trigger initialization
      vi.resetModules();

      expect(getLogLevel()).toBe('warn');
    });

    it('should enable debug mode when DEBUG_MODE is true', () => {
      process.env.DEBUG_MODE = 'true';

      // Re-import to trigger initialization
      vi.resetModules();

      expect(getLogLevel()).toBe('debug');
    });

    it('should respect quiet mode for non-error logs', () => {
      process.env.QUIET_MODE = 'true';

      info('Info message');
      warn('Warn message');
      error('Error message');

      // Only error should be logged in quiet mode
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).not.toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalledOnce();
    });
  });

  describe('Logger Object Interface', () => {
    it('should provide logger object with all methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.setLogLevel).toBe('function');
      expect(typeof logger.getLogLevel).toBe('function');
    });

    it('should work through logger object', () => {
      logger.info('Logger object message');

      expect(consoleMocks.info).toHaveBeenCalledOnce();
      const loggedMessage = consoleMocks.info.mock.calls[0][0];

      expect(loggedMessage).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[BACKEND\] Logger object message$/,
      );
    });
  });

  describe('Log Level Management', () => {
    it('should get and set log level', () => {
      expect(getLogLevel()).toBe('info'); // default

      setLogLevel('debug');
      expect(getLogLevel()).toBe('debug');

      setLogLevel('error');
      expect(getLogLevel()).toBe('error');
    });

    it('should ignore invalid log levels', () => {
      setLogLevel('info');
      const originalLevel = getLogLevel();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Testing invalid input
      setLogLevel('invalid');

      expect(getLogLevel()).toBe(originalLevel);
    });
  });
});
