/**
 * Simple logger utility that integrates with existing console.log statements
 * without requiring major code changes throughout the application.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogMeta = Record<string, any> | undefined | string | unknown;

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
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

function formatMessage(level: LogLevel, message: string | unknown, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [BACKEND]`;
    
    if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
        return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }
    
    return `${prefix} ${message}`;
}

function logAtLevel(level: LogLevel, message: string| unknown, meta?: LogMeta): void {
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
    getLogLevel
};

// Auto-initialize when module is loaded
initializeLogLevel();