import express, { Request, Response } from 'express';
import {
  requireAuth,
  optionalAuth,
  addUserContext,
  handleAuthError,
  validateAccountAccess,
  loadSession,
  requirePermission,
  authSdk,
} from '@/middleware/auth';
import type {
  AccountValidationResponse,
  ApiResponse,
  AuthStatusResponse,
  CurrentUserResponse,
  HealthCheckResponse,
  PermissionTestResponse,
  SessionInfoResponse,
  SocketStatusResponse,
  TokenValidationRequest,
  TokenValidationResponse,
  UserLookupResponse,
} from '@/types';

const router = express.Router();

// Apply error handling to all auth routes
router.use(handleAuthError);

// GET /api/auth/status - Check authentication status (optional auth)
router.get('/status', ...optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const responseData: AuthStatusResponse = {
      isAuthenticated: !!req.currentUser,
      user: req.currentUser || null,
      tokenData: req.tokenData || null,
      sessionInfo: req.sessionInfo || null,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: responseData,
    } as ApiResponse<AuthStatusResponse>);
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check authentication status',
      },
    } as ApiResponse);
  }
});

// GET /api/auth/me - Get current user info (requires auth)
router.get('/me', ...requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    const responseData: CurrentUserResponse = {
      user: req.currentUser,
      tokenData: req.tokenData || {},
      accountId: req.tokenData?.accountId,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: responseData,
    } as ApiResponse<CurrentUserResponse>);
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user information',
      },
    } as ApiResponse);
  }
});

// GET /api/auth/session - Get session information
router.get('/session', ...requireAuth, loadSession(), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.currentUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    const responseData: SessionInfoResponse = {
      user: req.currentUser,
      sessionInfo: req.sessionInfo || null,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: responseData,
    } as ApiResponse<SessionInfoResponse>);
  } catch (error) {
    console.error('Error fetching session info:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch session information',
      },
    } as ApiResponse);
  }
});

// GET /api/auth/validate/:accountId - Validate access to specific account
router.get(
  '/validate/:accountId',
  ...requireAuth,
  validateAccountAccess('accountId'),
  async (req: Request<{ accountId: string }>, res: Response): Promise<void> => {
    try {
      const { accountId } = req.params;

      // Validate accountId format (basic validation)
      if (!accountId || accountId.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid account ID is required',
          },
        } as ApiResponse);
        return;
      }

      if (!req.currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        } as ApiResponse);
        return;
      }

      const responseData: AccountValidationResponse = {
        accountId,
        user: req.currentUser,
        hasAccess: true,
        message: 'Account access validated successfully',
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: responseData,
      } as ApiResponse<AccountValidationResponse>);
    } catch (error) {
      console.error('Error validating account access:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate account access',
        },
      } as ApiResponse);
    }
  },
);

// GET /api/auth/permissions/email-verified - Test email verification requirement
router.get(
  '/permissions/email-verified',
  ...requireAuth,
  requirePermission({ emailVerified: true }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        } as ApiResponse);
        return;
      }

      const responseData: PermissionTestResponse = {
        user: req.currentUser,
        message: 'Email verification check passed',
        emailVerified: req.currentUser.isEmailVerified,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: responseData,
      } as ApiResponse<PermissionTestResponse>);
    } catch (error) {
      console.error('Error checking email verification:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to check email verification',
        },
      } as ApiResponse);
    }
  },
);

// GET /api/auth/permissions/oauth-only - Test OAuth account type requirement
router.get(
  '/permissions/oauth-only',
  ...requireAuth,
  requirePermission({
    accountTypes: ['OAuth'],
    customValidator: (user: any) => {
      // Additional custom validation with type safety
      return user && typeof user.accountType === 'string' && user.accountType === 'OAuth';
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        } as ApiResponse);
        return;
      }

      const responseData: PermissionTestResponse = {
        user: req.currentUser,
        message: 'OAuth account type check passed',
        accountType: req.currentUser.accountType,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: responseData,
      } as ApiResponse<PermissionTestResponse>);
    } catch (error) {
      console.error('Error checking OAuth requirement:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to check OAuth requirement',
        },
      } as ApiResponse);
    }
  },
);

// GET /api/auth/permissions/local-only - Test Local account type requirement
router.get(
  '/permissions/local-only',
  ...requireAuth,
  requirePermission({
    accountTypes: ['Local'],
    customValidator: (user: any) => {
      // Additional custom validation with type safety
      return user && typeof user.accountType === 'string' && user.accountType === 'Local';
    },
  }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        } as ApiResponse);
        return;
      }

      const responseData: PermissionTestResponse = {
        user: req.currentUser,
        message: 'Local account type check passed',
        accountType: req.currentUser.accountType,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: responseData,
      } as ApiResponse<PermissionTestResponse>);
    } catch (error) {
      console.error('Error checking Local requirement:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to check Local requirement',
        },
      } as ApiResponse);
    }
  },
);

// POST /api/auth/token/validate - Test token validation
router.post(
  '/token/validate',
  ...requireAuth,
  async (req: Request<{}, any, TokenValidationRequest>, res: Response): Promise<void> => {
    try {
      const { token, tokenType = 'access' } = req.body;

      // Input validation
      if (!token || typeof token !== 'string' || token.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Token is required and must be a non-empty string',
          },
        } as ApiResponse);
        return;
      }

      if (tokenType && !['access', 'refresh'].includes(tokenType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Token type must be either "access" or "refresh"',
          },
        } as ApiResponse);
        return;
      }

      if (!req.currentUser || !req.internalApi) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        } as ApiResponse);
        return;
      }

      // Use the auth SDK to validate the token
      const accountId = req.currentUser._id;
      const result = await req.internalApi.http.verifyToken(token.trim(), tokenType);

      const responseData: TokenValidationResponse = {
        tokenValidation: result,
        requestedBy: {
          accountId,
          email: req.currentUser.email,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: responseData,
      } as ApiResponse<TokenValidationResponse>);
    } catch (error) {
      console.error('Error validating token:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_VALIDATION_FAILED',
          message: (error as Error).message || 'Failed to validate token',
        },
      } as ApiResponse);
    }
  },
);

// GET /api/auth/user/:userId - Test user lookup by ID
router.get('/user/:userId', ...requireAuth, async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Input validation
    if (!userId || userId.trim() === '') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid user ID is required',
        },
      } as ApiResponse);
      return;
    }

    if (!req.currentUser || !req.internalApi) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      } as ApiResponse);
      return;
    }

    // Use the auth SDK to get user by ID
    const userResult = await req.internalApi.http.getUserById(userId.trim());

    const responseData: UserLookupResponse = {
      requestedUser: userResult,
      requestedBy: {
        accountId: req.currentUser._id,
        email: req.currentUser.email,
      },
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: responseData,
    } as ApiResponse<UserLookupResponse>);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_LOOKUP_FAILED',
        message: (error as Error).message || 'Failed to lookup user',
      },
    } as ApiResponse);
  }
});

// GET /api/auth/user/email/:email - Test user lookup by email
router.get(
  '/user/email/:email',
  ...requireAuth,
  async (req: Request<{ email: string }>, res: Response): Promise<void> => {
    try {
      const { email } = req.params;
      const decodedEmail = decodeURIComponent(email);

      // Input validation
      if (!decodedEmail || decodedEmail.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid email is required',
          },
        } as ApiResponse);
        return;
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(decodedEmail.trim())) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
          },
        } as ApiResponse);
        return;
      }

      if (!req.currentUser || !req.internalApi) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        } as ApiResponse);
        return;
      }

      // Use the auth SDK to get user by email
      const userResult = await req.internalApi.http.getUserByEmail(decodedEmail.trim());

      const responseData: UserLookupResponse = {
        requestedUser: userResult,
        requestedBy: {
          accountId: req.currentUser._id,
          email: req.currentUser.email,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: responseData,
      } as ApiResponse<UserLookupResponse>);
    } catch (error) {
      console.error('Error fetching user by email:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'USER_LOOKUP_FAILED',
          message: (error as Error).message || 'Failed to lookup user by email',
        },
      } as ApiResponse);
    }
  },
);

// GET /api/auth/health - Test auth service health
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    // Access httpClient through the SDK instance
    const health = await authSdk.httpClient.healthCheck();

    const responseData: HealthCheckResponse = {
      authService: health,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: responseData,
    } as ApiResponse<HealthCheckResponse>);
  } catch (error) {
    console.error('Error checking auth service health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: (error as Error).message || 'Failed to check auth service health',
      },
    } as ApiResponse);
  }
});

// GET /api/auth/client/socket/status - Check socket client status
router.get('/client/socket/status', async (req: Request, res: Response): Promise<void> => {
  try {
    // Access socketClient through the SDK instance
    const socketClient = authSdk.socketClient;

    const responseData: SocketStatusResponse = {
      socketClient: {
        available: !!socketClient,
        connected: socketClient ? socketClient.isConnected() : false,
        reconnectAttempts: socketClient ? socketClient.getReconnectAttempts() : 0,
      },
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: responseData,
    } as ApiResponse<SocketStatusResponse>);
  } catch (error) {
    console.error('Error checking socket status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SOCKET_STATUS_FAILED',
        message: (error as Error).message || 'Failed to check socket status',
      },
    } as ApiResponse);
  }
});

// GET /api/auth/debug/middleware-chain - Debug endpoint to check middleware chain
router.get('/debug/middleware-chain', async (req: Request, res: Response): Promise<void> => {
  try {
    const debugInfo = {
      middlewareChain: {
        hasCurrentUser: !!req.currentUser,
        hasTokenData: !!req.tokenData,
        hasSessionInfo: !!req.sessionInfo,
        hasUserContext: !!req.userContext,
        hasInternalApi: !!req.internalApi,
      },
      currentUser: req.currentUser
        ? {
            id: req.currentUser._id,
            email: req.currentUser.email,
            accountType: req.currentUser.accountType,
            isEmailVerified: req.currentUser.isEmailVerified,
          }
        : null,
      tokenData: req.tokenData
        ? {
            valid: req.tokenData.valid,
            accountId: req.tokenData.accountId,
            accountType: req.tokenData.accountType,
            isRefreshToken: req.tokenData.isRefreshToken,
            expiresAt: req.tokenData.expiresAt,
          }
        : null,
      sessionInfo: req.sessionInfo
        ? {
            accountIds: req.sessionInfo.accountIds,
            currentAccountId: req.sessionInfo.currentAccountId,
            sessionId: req.sessionInfo.sessionId,
          }
        : null,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: debugInfo,
    } as ApiResponse<typeof debugInfo>);
  } catch (error) {
    console.error('Error in debug middleware chain endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Debug middleware chain endpoint failed',
      },
    } as ApiResponse);
  }
});

// POST /api/auth/debug/custom-validation - Debug endpoint for custom validation testing
router.post(
  '/debug/custom-validation',
  ...requireAuth,
  async (req: Request<{}, any, { testData?: any }>, res: Response): Promise<void> => {
    try {
      const { testData } = req.body;

      if (!req.currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        } as ApiResponse);
        return;
      }

      // Validate test data if provided
      let validationResults: Record<string, any> = {
        hasTestData: !!testData,
        testDataType: typeof testData,
      };

      if (testData) {
        validationResults = {
          ...validationResults,
          isObject: typeof testData === 'object' && testData !== null,
          isArray: Array.isArray(testData),
          hasKeys: typeof testData === 'object' && testData !== null ? Object.keys(testData).length : 0,
        };
      }

      const responseData = {
        user: {
          id: req.currentUser._id,
          email: req.currentUser.email,
          accountType: req.currentUser.accountType,
        },
        validation: validationResults,
        message: 'Custom validation test completed',
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: responseData,
      } as ApiResponse<typeof responseData>);
    } catch (error) {
      console.error('Error in custom validation debug endpoint:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Custom validation debug endpoint failed',
        },
      } as ApiResponse);
    }
  },
);

export default router;
