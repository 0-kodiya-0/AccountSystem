import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Mock external dependencies
vi.mock('fs');
vi.mock('dotenv');
vi.mock('./index', () => ({
  startServer: vi.fn(),
  stopServer: vi.fn(),
}));

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

import { parseArgs, validateOptions, applyEnvironmentOverrides } from '../cli';

describe('CLI Argument Parsing', () => {
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    originalArgv = [...process.argv];
    // Mock fs.existsSync to return true by default
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  const setArgs = (args: string[]) => {
    process.argv = ['node', 'cli.js', ...args];
  };

  describe('Help and Version Options', () => {
    it('should parse --help flag', () => {
      setArgs(['--help']);
      const options = parseArgs();
      expect(options.help).toBe(true);
    });

    it('should parse -h flag', () => {
      setArgs(['-h']);
      const options = parseArgs();
      expect(options.help).toBe(true);
    });

    it('should parse --version flag', () => {
      setArgs(['--version']);
      const options = parseArgs();
      expect(options.version).toBe(true);
    });

    it('should parse -v flag', () => {
      setArgs(['-v']);
      const options = parseArgs();
      expect(options.version).toBe(true);
    });
  });

  describe('Basic Configuration Options', () => {
    it('should parse --env option with valid path', () => {
      setArgs(['--env', '.env.test']);
      const options = parseArgs();
      expect(options.env).toBe('.env.test');
    });

    it('should parse --port option with valid port number', () => {
      setArgs(['--port', '3000']);
      const options = parseArgs();
      expect(options.port).toBe(3000);
    });

    it('should parse -p shorthand for port', () => {
      setArgs(['-p', '8080']);
      const options = parseArgs();
      expect(options.port).toBe(8080);
    });

    it('should parse --db-uri option', () => {
      setArgs(['--db-uri', 'mongodb://localhost:27017/test']);
      const options = parseArgs();
      expect(options.dbUri).toBe('mongodb://localhost:27017/test');
    });

    it('should parse --db-timeout option', () => {
      setArgs(['--db-timeout', '30000']);
      const options = parseArgs();
      expect(options.dbTimeout).toBe(30000);
    });

    it('should parse --internal-port option', () => {
      setArgs(['--internal-port', '8443']);
      const options = parseArgs();
      expect(options.internalPort).toBe(8443);
    });

    it('should parse --log-level option with valid level', () => {
      setArgs(['--log-level', 'debug']);
      const options = parseArgs();
      expect(options.logLevel).toBe('debug');
    });

    it('should parse boolean flags', () => {
      setArgs(['--debug', '--quiet', '--disable-oauth', '--disable-internal']);
      const options = parseArgs();
      expect(options.debug).toBe(true);
      expect(options.quiet).toBe(true);
      expect(options.disableOauth).toBe(true);
      expect(options.disableInternal).toBe(true);
    });

    it('should parse --jwt-secret option', () => {
      setArgs(['--jwt-secret', 'my-secret-key']);
      const options = parseArgs();
      expect(options.jwtSecret).toBe('my-secret-key');
    });

    it('should parse --session-secret option', () => {
      setArgs(['--session-secret', 'my-session-secret']);
      const options = parseArgs();
      expect(options.sessionSecret).toBe('my-session-secret');
    });

    it('should parse SSL certificate paths', () => {
      setArgs([
        '--internal-ssl-key',
        '/path/to/key.pem',
        '--internal-ssl-cert',
        '/path/to/cert.pem',
        '--internal-ssl-ca',
        '/path/to/ca.pem',
      ]);
      const options = parseArgs();
      expect(options.internalSslKey).toBe('/path/to/key.pem');
      expect(options.internalSslCert).toBe('/path/to/cert.pem');
      expect(options.internalSslCa).toBe('/path/to/ca.pem');
    });
  });

  describe('Error Handling for Invalid Arguments', () => {
    it('should throw error for --env without path', () => {
      setArgs(['--env']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --env requires a path');
    });

    it('should throw error for --port without number', () => {
      setArgs(['--port']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --port requires a number');
    });

    it('should throw error for invalid port number', () => {
      setArgs(['--port', 'invalid']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --port must be a valid port number (1-65535)');
    });

    it('should throw error for port out of range', () => {
      setArgs(['--port', '70000']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --port must be a valid port number (1-65535)');
    });

    it('should throw error for --db-uri without URI', () => {
      setArgs(['--db-uri']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --db-uri requires a URI');
    });

    it('should throw error for invalid db-timeout', () => {
      setArgs(['--db-timeout', '500']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --db-timeout must be a number >= 1000');
    });

    it('should throw error for invalid log level', () => {
      setArgs(['--log-level', 'invalid']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --log-level must be one of: debug, info, warn, error');
    });

    it('should throw error for --log-level without level', () => {
      setArgs(['--log-level']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --log-level requires a level (debug, info, warn, error)');
    });

    it('should throw error for --jwt-secret without secret', () => {
      setArgs(['--jwt-secret']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --jwt-secret requires a secret');
    });

    it('should throw error for --session-secret without secret', () => {
      setArgs(['--session-secret']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --session-secret requires a secret');
    });

    it('should throw error for invalid internal port', () => {
      setArgs(['--internal-port', '70000']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --internal-port must be a valid port number (1-65535)');
    });

    it('should throw error for missing SSL certificate paths', () => {
      setArgs(['--internal-ssl-key']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: --internal-ssl-key requires a path');
    });

    it('should throw error for unknown option', () => {
      setArgs(['--unknown-option']);
      expect(() => parseArgs()).toThrow('process.exit(1)');
      expect(mockConsoleError).toHaveBeenCalledWith('Error: Unknown option: --unknown-option');
    });
  });

  describe('Complex Argument Combinations', () => {
    it('should parse multiple valid options together', () => {
      setArgs([
        '--port',
        '3000',
        '--debug',
        '--env',
        '.env.development',
        '--log-level',
        'info',
        '--jwt-secret',
        'test-secret',
        '--db-uri',
        'mongodb://localhost:27017/test',
      ]);

      const options = parseArgs();

      expect(options.port).toBe(3000);
      expect(options.debug).toBe(true);
      expect(options.env).toBe('.env.development');
      expect(options.logLevel).toBe('info');
      expect(options.jwtSecret).toBe('test-secret');
      expect(options.dbUri).toBe('mongodb://localhost:27017/test');
    });

    it('should handle mixed short and long options', () => {
      setArgs(['-p', '8080', '--debug', '-h']);
      const options = parseArgs();
      expect(options.port).toBe(8080);
      expect(options.debug).toBe(true);
      expect(options.help).toBe(true);
    });

    it('should handle all valid log levels', () => {
      const logLevels = ['debug', 'info', 'warn', 'error'];

      logLevels.forEach((level) => {
        setArgs(['--log-level', level]);
        const options = parseArgs();
        expect(options.logLevel).toBe(level);
      });
    });

    it('should handle boundary port values correctly', () => {
      const validPorts = [1, 80, 443, 3000, 8080, 65535];

      validPorts.forEach((port) => {
        setArgs(['--port', port.toString()]);
        const options = parseArgs();
        expect(options.port).toBe(port);
      });
    });

    it('should handle all SSL certificate options together', () => {
      setArgs([
        '--internal-ssl-key',
        '/path/to/key.pem',
        '--internal-ssl-cert',
        '/path/to/cert.pem',
        '--internal-ssl-ca',
        '/path/to/ca.pem',
        '--internal-port',
        '8443',
      ]);

      const options = parseArgs();
      expect(options.internalSslKey).toBe('/path/to/key.pem');
      expect(options.internalSslCert).toBe('/path/to/cert.pem');
      expect(options.internalSslCa).toBe('/path/to/ca.pem');
      expect(options.internalPort).toBe(8443);
    });

    it('should handle all disable flags', () => {
      setArgs(['--disable-oauth', '--disable-local-auth', '--disable-notifications']);
      const options = parseArgs();
      expect(options.disableOauth).toBe(true);
      expect(options.disableLocalAuth).toBe(true);
      expect(options.disableNotifications).toBe(true);
    });
  });
});

describe('Option Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate existing environment file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(() => validateOptions({ env: '.env.test' })).not.toThrow();
  });

  it('should throw error for non-existent environment file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(() => validateOptions({ env: '/nonexistent/.env' })).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: Environment file not found: /nonexistent/.env');
  });

  it('should validate SSL certificate files exist', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => {
      return path !== '/nonexistent/key.pem';
    });
    expect(() => validateOptions({ internalSslKey: '/nonexistent/key.pem' })).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: Internal SSL key file not found: /nonexistent/key.pem');
  });

  it('should validate non-empty JWT secret', () => {
    expect(() => validateOptions({ jwtSecret: 'valid-secret' })).not.toThrow();
  });

  it('should throw error for empty JWT secret', () => {
    expect(() => validateOptions({ jwtSecret: '   ' })).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: JWT secret cannot be empty');
  });

  it('should throw error for empty session secret', () => {
    expect(() => validateOptions({ sessionSecret: '   ' })).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: Session secret cannot be empty');
  });

  it('should validate multiple SSL certificate files', () => {
    vi.mocked(fs.existsSync).mockImplementation((filePath) => {
      // Only cert file is missing
      return filePath !== '/path/to/cert.pem';
    });

    expect(() =>
      validateOptions({
        internalSslKey: '/path/to/key.pem',
        internalSslCert: '/path/to/cert.pem',
        internalSslCa: '/path/to/ca.pem',
      }),
    ).toThrow('process.exit(1)');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Internal SSL cert file not found: /path/to/cert.pem');
  });

  it('should pass validation for valid options', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(() =>
      validateOptions({
        env: '.env',
        jwtSecret: 'valid-secret',
        sessionSecret: 'valid-session-secret',
        internalSslKey: '/path/to/key.pem',
      }),
    ).not.toThrow();
  });
});

describe('Environment Variable Overrides', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load custom environment file when it exists', () => {
    applyEnvironmentOverrides({ env: '.env.test' });

    expect(dotenv.config).toHaveBeenCalledWith({
      path: path.resolve('.env.test'),
      override: true,
    });
    expect(mockConsoleLog).toHaveBeenCalledWith(`Loaded environment from: ${path.resolve('.env.test')}`);
  });

  it('should not load environment file when it does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    applyEnvironmentOverrides({ env: '.env.nonexistent' });

    expect(dotenv.config).not.toHaveBeenCalled();
  });

  it('should override PORT environment variable', () => {
    applyEnvironmentOverrides({ port: 4000 });
    expect(process.env.PORT).toBe('4000');
  });

  it('should override database URI environment variables', () => {
    applyEnvironmentOverrides({ dbUri: 'mongodb://test:27017/testdb' });
    expect(process.env.MONGODB_URI).toBe('mongodb://test:27017/testdb');
    expect(process.env.ACCOUNTS_DB_URI).toBe('mongodb://test:27017/testdb');
  });

  it('should override database timeout', () => {
    applyEnvironmentOverrides({ dbTimeout: 30000 });
    expect(process.env.DB_TIMEOUT).toBe('30000');
  });

  it('should override internal server settings', () => {
    applyEnvironmentOverrides({
      internalPort: 8443,
      disableInternal: true,
    });
    expect(process.env.INTERNAL_PORT).toBe('8443');
    expect(process.env.INTERNAL_SERVER_ENABLED).toBe('false');
  });

  it('should resolve SSL certificate paths', () => {
    applyEnvironmentOverrides({
      internalSslKey: 'key.pem',
      internalSslCert: 'cert.pem',
      internalSslCa: 'ca.pem',
    });

    expect(process.env.INTERNAL_SERVER_KEY_PATH).toBe(path.resolve('key.pem'));
    expect(process.env.INTERNAL_SERVER_CERT_PATH).toBe(path.resolve('cert.pem'));
    expect(process.env.INTERNAL_CA_CERT_PATH).toBe(path.resolve('ca.pem'));
  });

  it('should override log level environment variable', () => {
    applyEnvironmentOverrides({ logLevel: 'warn' });
    expect(process.env.LOG_LEVEL).toBe('warn');
  });

  it('should set debug mode correctly', () => {
    applyEnvironmentOverrides({ debug: true });
    expect(process.env.DEBUG_MODE).toBe('true');
    expect(process.env.LOG_LEVEL).toBe('debug');
  });

  it('should set quiet mode correctly', () => {
    applyEnvironmentOverrides({ quiet: true });
    expect(process.env.LOG_LEVEL).toBe('error');
    expect(process.env.NO_REQUEST_LOGS).toBe('true');
    expect(process.env.QUIET_MODE).toBe('true');
  });

  it('should handle debug mode overriding other log levels', () => {
    applyEnvironmentOverrides({
      debug: true,
      logLevel: 'warn',
      quiet: true,
    });

    // Debug should take precedence
    expect(process.env.DEBUG_MODE).toBe('true');
    expect(process.env.LOG_LEVEL).toBe('debug');
    expect(process.env.QUIET_MODE).toBe('true');
    expect(process.env.NO_REQUEST_LOGS).toBe('true');
  });

  it('should set feature disable flags', () => {
    applyEnvironmentOverrides({
      disableOauth: true,
      disableLocalAuth: true,
      disableNotifications: true,
    });
    expect(process.env.DISABLE_OAUTH).toBe('true');
    expect(process.env.DISABLE_LOCAL_AUTH).toBe('true');
    expect(process.env.DISABLE_NOTIFICATIONS).toBe('true');
  });

  it('should set authentication secrets', () => {
    applyEnvironmentOverrides({
      jwtSecret: 'test-jwt-secret',
      sessionSecret: 'test-session-secret',
    });
    expect(process.env.JWT_SECRET).toBe('test-jwt-secret');
    expect(process.env.SESSION_SECRET).toBe('test-session-secret');
  });

  it('should set no request logs flag', () => {
    applyEnvironmentOverrides({ noRequestLogs: true });
    expect(process.env.NO_REQUEST_LOGS).toBe('true');
  });

  it('should handle multiple environment overrides', () => {
    applyEnvironmentOverrides({
      port: 3000,
      dbUri: 'mongodb://localhost:27017/test',
      dbTimeout: 25000,
      internalPort: 8443,
      debug: true,
      jwtSecret: 'test-secret',
      sessionSecret: 'test-session',
      disableOauth: true,
    });

    expect(process.env.PORT).toBe('3000');
    expect(process.env.MONGODB_URI).toBe('mongodb://localhost:27017/test');
    expect(process.env.DB_TIMEOUT).toBe('25000');
    expect(process.env.INTERNAL_PORT).toBe('8443');
    expect(process.env.DEBUG_MODE).toBe('true');
    expect(process.env.LOG_LEVEL).toBe('debug');
    expect(process.env.JWT_SECRET).toBe('test-secret');
    expect(process.env.SESSION_SECRET).toBe('test-session');
    expect(process.env.DISABLE_OAUTH).toBe('true');
  });
});

describe('Real-world CLI Usage Scenarios', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  const setArgs = (args: string[]) => {
    process.argv = ['node', 'cli.js', ...args];
  };

  it('should handle development configuration', () => {
    setArgs([
      '--port',
      '3000',
      '--debug',
      '--env',
      '.env.development',
      '--jwt-secret',
      'dev-secret',
      '--db-uri',
      'mongodb://localhost:27017/dev',
    ]);

    const options = parseArgs();
    validateOptions(options);
    applyEnvironmentOverrides(options);

    expect(options.port).toBe(3000);
    expect(options.debug).toBe(true);
    expect(options.env).toBe('.env.development');
    expect(options.jwtSecret).toBe('dev-secret');
    expect(options.dbUri).toBe('mongodb://localhost:27017/dev');

    expect(process.env.PORT).toBe('3000');
    expect(process.env.DEBUG_MODE).toBe('true');
    expect(process.env.LOG_LEVEL).toBe('debug');
    expect(process.env.JWT_SECRET).toBe('dev-secret');
    expect(process.env.MONGODB_URI).toBe('mongodb://localhost:27017/dev');
  });

  it('should handle production configuration with SSL', () => {
    setArgs([
      '--port',
      '8080',
      '--env',
      '.env.production',
      '--internal-port',
      '8443',
      '--internal-ssl-key',
      '/etc/ssl/private/server.key',
      '--internal-ssl-cert',
      '/etc/ssl/certs/server.crt',
      '--internal-ssl-ca',
      '/etc/ssl/certs/ca.crt',
      '--log-level',
      'error',
      '--quiet',
      '--jwt-secret',
      'production-secret',
      '--session-secret',
      'production-session-secret',
    ]);

    const options = parseArgs();
    validateOptions(options);
    applyEnvironmentOverrides(options);

    expect(options.port).toBe(8080);
    expect(options.internalPort).toBe(8443);
    expect(options.quiet).toBe(true);
    expect(options.logLevel).toBe('error');

    expect(process.env.PORT).toBe('8080');
    expect(process.env.INTERNAL_PORT).toBe('8443');
    expect(process.env.INTERNAL_SERVER_KEY_PATH).toBe(path.resolve('/etc/ssl/private/server.key'));
    expect(process.env.LOG_LEVEL).toBe('error');
    expect(process.env.QUIET_MODE).toBe('true');
  });

  it('should handle minimal configuration with just help', () => {
    setArgs(['--help']);
    const options = parseArgs();
    expect(options.help).toBe(true);
    expect(Object.keys(options)).toHaveLength(1);
  });

  it('should handle testing configuration', () => {
    setArgs([
      '--port',
      '3001',
      '--env',
      '.env.test',
      '--log-level',
      'info',
      '--db-uri',
      'mongodb://localhost:27017/test',
      '--db-timeout',
      '15000',
    ]);

    const options = parseArgs();
    validateOptions(options);
    applyEnvironmentOverrides(options);

    expect(process.env.PORT).toBe('3001');
    expect(process.env.LOG_LEVEL).toBe('info');
    expect(process.env.MONGODB_URI).toBe('mongodb://localhost:27017/test');
    expect(process.env.DB_TIMEOUT).toBe('15000');
  });

  it('should handle disabled features configuration', () => {
    setArgs(['--disable-oauth', '--disable-local-auth', '--disable-notifications', '--disable-internal']);

    const options = parseArgs();
    applyEnvironmentOverrides(options);

    expect(process.env.DISABLE_OAUTH).toBe('true');
    expect(process.env.DISABLE_LOCAL_AUTH).toBe('true');
    expect(process.env.DISABLE_NOTIFICATIONS).toBe('true');
    expect(process.env.INTERNAL_SERVER_ENABLED).toBe('false');
  });
});

describe('Edge Cases and Error Conditions', () => {
  let originalArgv: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    originalArgv = [...process.argv];
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  const setArgs = (args: string[]) => {
    process.argv = ['node', 'cli.js', ...args];
  };

  it('should handle empty argument list', () => {
    setArgs([]);
    const options = parseArgs();
    expect(Object.keys(options)).toHaveLength(0);
  });

  it('should handle arguments with dashes as values (should fail)', () => {
    setArgs(['--env', '--another-option']);
    expect(() => parseArgs()).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: --env requires a path');
  });

  it('should handle multiple unknown options', () => {
    setArgs(['--unknown1', '--unknown2']);
    expect(() => parseArgs()).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: Unknown option: --unknown1');
  });

  it('should handle mixed valid and invalid options', () => {
    setArgs(['--port', '3000', '--invalid-option']);
    expect(() => parseArgs()).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: Unknown option: --invalid-option');
  });

  it('should handle port validation edge cases', () => {
    // Test boundary values
    setArgs(['--port', '0']);
    expect(() => parseArgs()).toThrow('process.exit(1)');

    setArgs(['--port', '65536']);
    expect(() => parseArgs()).toThrow('process.exit(1)');

    setArgs(['--port', '-1']);
    expect(() => parseArgs()).toThrow('process.exit(1)');

    // Test valid boundary values
    setArgs(['--port', '1']);
    const validOptions1 = parseArgs();
    expect(validOptions1.port).toBe(1);

    setArgs(['--port', '65535']);
    const validOptions2 = parseArgs();
    expect(validOptions2.port).toBe(65535);
  });

  it('should handle db-timeout validation edge cases', () => {
    setArgs(['--db-timeout', '999']);
    expect(() => parseArgs()).toThrow('process.exit(1)');

    setArgs(['--db-timeout', '1000']);
    const validOptions = parseArgs();
    expect(validOptions.dbTimeout).toBe(1000);
  });

  it('should handle whitespace in secrets validation', () => {
    expect(() => validateOptions({ jwtSecret: '  \t\n  ' })).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: JWT secret cannot be empty');

    expect(() => validateOptions({ sessionSecret: '  \t\n  ' })).toThrow('process.exit(1)');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: Session secret cannot be empty');
  });
});
