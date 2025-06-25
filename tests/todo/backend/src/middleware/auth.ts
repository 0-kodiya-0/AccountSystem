import { Request, Response, NextFunction } from 'express';
import { authSdk } from '@/config/auth';
import type { AuthMiddlewareOptions, PermissionOptions } from '@/types';

// Inject auth clients into all requests
const injectAuthClients = authSdk.injectClients();

// Verify access token (required)
const requireAuth = authSdk.authenticate({
  fromHeader: true,
  fromCookie: true,
  loadUser: true,
  enableRefreshRedirect: true,
});

// Verify access token (optional)
const optionalAuth = authSdk.authenticate({
  fromHeader: true,
  fromCookie: true,
  loadUser: true,
  enableRefreshRedirect: false,
});

// Validate account access for specific account routes
const validateAccountAccess = (accountIdParam: string = 'accountId') => {
  return authSdk.validateAccountAccess(accountIdParam);
};

// Load session information
const loadSession = (
  options: {
    cookieName?: string;
    required?: boolean;
    validateAccount?: boolean;
  } = {},
) => {
  return authSdk.loadSession({
    cookieName: 'account_session',
    required: true,
    validateAccount: true,
    ...options,
  });
};

// Require specific permissions
const requirePermission = (options: PermissionOptions) => {
  return authSdk.requirePermission(options);
};

// Complete authorization flow (auth + account validation + session)
const authorize = (
  options: {
    accountIdParam?: string;
    sessionCookieName?: string;
    validateSessionAccount?: boolean;
    enableRefreshRedirect?: boolean;
  } = {},
) => {
  return authSdk.authorize(options);
};

// Middleware to force HTTP client usage (for testing)
const forceHttp = () => {
  return authSdk.useHttp();
};

// Middleware to force Socket client usage (for testing)
const forceSocket = () => {
  return authSdk.useSocket();
};

// Custom middleware to add user context to todos
const addUserContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Ensure we have current user info
    if (!req.currentUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Add user context for todo operations
    req.userContext = {
      userId: req.currentUser._id,
      email: req.currentUser.email,
      name: req.currentUser.name,
      accountType: req.currentUser.accountType,
      isEmailVerified: req.currentUser.isEmailVerified,
    };

    next();
  } catch (error) {
    console.error('Error adding user context:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process user context',
      },
    });
  }
};

// Error handler for auth-related errors
const handleAuthError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error.name === 'InternalApiError') {
    res.status(error.statusCode || 401).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  next(error);
};

export {
  // Basic middleware
  injectAuthClients,
  requireAuth,
  optionalAuth,
  validateAccountAccess,
  loadSession,
  requirePermission,
  authorize,

  // Client preference middleware
  forceHttp,
  forceSocket,

  // Custom middleware
  addUserContext,
  handleAuthError,

  // Direct access to SDK for custom middleware
  authSdk,
};
