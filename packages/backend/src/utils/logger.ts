type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogMeta = Record<string, any> | undefined | string | unknown;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLogLevel: LogLevel = 'info';

// Initialize log level from environment
function initializeLogLevel(): void {
  const envLogLevel = process.env.LOG_LEVEL as LogLevel;
  if (envLogLevel && LOG_LEVELS[envLogLevel] !== undefined) {
    currentLogLevel = envLogLevel;
  }

  // Enable debug mode if specified
  if (process.env.DEBUG_MODE === 'true') {
    currentLogLevel = 'debug';
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

// Helper function to properly serialize errors
function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    // Include any custom properties that might exist on the error
    ...Object.getOwnPropertyNames(error).reduce((acc, key) => {
      if (key !== 'name' && key !== 'message' && key !== 'stack') {
        acc[key] = (error as any)[key];
      }
      return acc;
    }, {} as Record<string, unknown>),
  };
}

// Helper function to safely stringify objects, handling errors and circular references
function safeStringify(obj: unknown): string {
  try {
    if (obj instanceof Error) {
      return JSON.stringify(serializeError(obj), null, 2);
    }

    if (typeof obj === 'object' && obj !== null) {
      return JSON.stringify(obj, null, 2);
    }

    return String(obj);
  } catch (error) {
    // Handle circular references or other JSON.stringify errors
    return `[Unable to serialize: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

function formatMessage(level: LogLevel, message: string | unknown, meta?: LogMeta): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [BACKEND]`;

  let formattedMessage = '';

  // Handle the main message
  if (message instanceof Error) {
    // For errors as main message, use the formatted error with stack
    formattedMessage = `${message.name}: ${message.message}`;
    if (message.stack) {
      formattedMessage += `\n${message.stack}`;
    }
  } else {
    formattedMessage = String(message);
  }

  // Handle meta information
  if (meta !== undefined) {
    if (typeof meta === 'string') {
      formattedMessage += ` | ${meta}`;
    } else if (meta instanceof Error) {
      // For errors as meta, show them with proper formatting
      formattedMessage += `\n${meta.name}: ${meta.message}`;
      if (meta.stack) {
        formattedMessage += `\n${meta.stack}`;
      }
    } else if (typeof meta === 'object' && meta !== null && Object.keys(meta).length > 0) {
      formattedMessage += `\n${safeStringify(meta)}`;
    } else if (meta !== undefined) {
      formattedMessage += ` | ${String(meta)}`;
    }
  }

  return `${prefix} ${formattedMessage}`;
}

function logAtLevel(level: LogLevel, message: string | unknown, meta?: LogMeta): void {
  if (!shouldLog(level)) {
    return;
  }

  // Check for quiet mode - only show errors
  if (process.env.QUIET_MODE === 'true' && level !== 'error') {
    return;
  }

  const formattedMessage = formatMessage(level, message, meta);

  switch (level) {
    case 'debug':
      console.debug(formattedMessage);
      break;
    case 'info':
      console.info(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'error':
      console.error(formattedMessage);
      break;
  }
}

// Main logging functions
export function debug(message: string | unknown, meta?: LogMeta): void {
  logAtLevel('debug', message, meta);
}

export function info(message: string | unknown, meta?: LogMeta): void {
  logAtLevel('info', message, meta);
}

export function warn(message: string | unknown, meta?: LogMeta): void {
  logAtLevel('warn', message, meta);
}

export function error(message: string | unknown, meta?: LogMeta): void {
  logAtLevel('error', message, meta);
}

// Utility functions
export function setLogLevel(level: LogLevel): void {
  if (LOG_LEVELS[level] !== undefined) {
    currentLogLevel = level;
  }
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

// Logger object for compatibility
export const logger = {
  debug,
  info,
  warn,
  error,
  setLogLevel,
  getLogLevel,
};

// Auto-initialize when module is loaded
initializeLogLevel();
