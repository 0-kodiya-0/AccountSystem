import { getApiBasePATH, getGoogleClientId, getProxyUrl, getNodeEnv } from '../../../config/env.config';
import { getOAuthMockConfig } from '../../../config/mock.config';

/**
 * Google OAuth configuration with mock support
 */

export const GOOGLE_SCOPE_BASE_URL = 'https://www.googleapis.com/auth/';

export const SPECIAL_SCOPES = {
  openid: 'openid',
  email: 'https://www.googleapis.com/auth/userinfo.email',
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
} as const;

/**
 * Get OAuth endpoints (real or mock based on environment)
 */
export function getGoogleOAuthEndpoints() {
  const mockConfig = getOAuthMockConfig();
  const isProduction = getNodeEnv() === 'production';
  const useMock = !isProduction && mockConfig.enabled;

  if (useMock) {
    // Use mock endpoints for development/testing
    const mockBaseUrl = `${getProxyUrl()}${getApiBasePATH()}`;
    return {
      authorizationEndpoint: `${mockBaseUrl}/mock/oauth/authorize`,
      tokenEndpoint: `${mockBaseUrl}/mock/oauth/token`,
      userinfoEndpoint: `${mockBaseUrl}/mock/oauth/userinfo`,
      tokeninfoEndpoint: `${mockBaseUrl}/mock/oauth/tokeninfo`,
      revokeEndpoint: `${mockBaseUrl}/mock/oauth/revoke`,
      isMock: true,
    };
  } else {
    // Use real Google endpoints
    return {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userinfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
      tokeninfoEndpoint: 'https://www.googleapis.com/oauth2/v2/tokeninfo',
      revokeEndpoint: 'https://oauth2.googleapis.com/revoke',
      isMock: false,
    };
  }
}

export function buildGoogleScopeUrl(scopeName: string): string {
  if (scopeName in SPECIAL_SCOPES) {
    return SPECIAL_SCOPES[scopeName as keyof typeof SPECIAL_SCOPES];
  }

  if (scopeName.startsWith('https://') || scopeName.startsWith('http://')) {
    return scopeName;
  }

  return `${GOOGLE_SCOPE_BASE_URL}${scopeName}`;
}

/**
 * Build multiple Google OAuth scope URLs from scope names
 * @param scopeNames Array of scope names
 * @returns Array of full Google OAuth scope URLs
 */
export function buildGoogleScopeUrls(scopeNames: string[]): string[] {
  return scopeNames.map(buildGoogleScopeUrl);
}

/**
 * Validate basic scope name format
 * @param scopeName The scope name to validate
 * @returns True if the scope name is valid
 */
export function isValidScopeName(scopeName: string): boolean {
  if (!scopeName || typeof scopeName !== 'string') {
    return false;
  }

  const trimmed = scopeName.trim();

  if (trimmed.length === 0) {
    return false;
  }

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  return /^[a-zA-Z0-9._-]+$/.test(trimmed);
}

/**
 * Validate an array of scope names
 * @param scopeNames Array of scope names to validate
 * @returns Validation result with errors if any
 */
export function validateScopeNames(scopeNames: string[]): {
  valid: boolean;
  errors: string[];
} {
  if (!Array.isArray(scopeNames)) {
    return { valid: false, errors: ['Scope names must be an array'] };
  }

  if (scopeNames.length === 0) {
    return { valid: false, errors: ['At least one scope name is required'] };
  }

  const errors: string[] = [];

  scopeNames.forEach((scopeName, index) => {
    if (!isValidScopeName(scopeName)) {
      errors.push(`Invalid scope name at index ${index}: "${scopeName}"`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export interface GoogleOAuthUrlOptions {
  scopes?: string[];
  state: string;
  redirectPath: string;
  loginHint?: string;
  accessType?: 'online' | 'offline';
  prompt?: 'none' | 'consent' | 'select_account';
  includeGrantedScopes?: boolean;
  responseType?: 'code' | 'token';
  mockAccountEmail?: string; // For testing specific mock accounts
}

export interface GoogleOAuthUrlParams {
  client_id: string;
  response_type: string;
  scope?: string;
  access_type?: string;
  prompt?: string;
  login_hint?: string;
  state: string;
  include_granted_scopes?: string;
  redirect_uri: string;
}

/**
 * Build Google OAuth 2.0 authorization URL (supports both real and mock)
 */
export function buildGoogleOAuthUrl(options: GoogleOAuthUrlOptions): string {
  const {
    scopes = ['profile', 'email'],
    state,
    redirectPath,
    loginHint,
    accessType = 'offline',
    prompt = 'consent',
    includeGrantedScopes = true,
    responseType = 'code',
    mockAccountEmail,
  } = options;

  const endpoints = getGoogleOAuthEndpoints();
  const baseUrl = endpoints.authorizationEndpoint;

  const params: GoogleOAuthUrlParams = {
    client_id: getGoogleClientId(),
    response_type: responseType,
    state: state,
    redirect_uri: `${getProxyUrl()}${getApiBasePATH()}${redirectPath}`,
  };

  if (scopes.length > 0) {
    params.scope = scopes.join(' ');
  }

  if (accessType) {
    params.access_type = accessType;
  }

  if (prompt) {
    params.prompt = prompt;
  }

  // Use mockAccountEmail or loginHint for testing
  const hintEmail = mockAccountEmail || loginHint;
  if (hintEmail) {
    params.login_hint = hintEmail;
  }

  if (includeGrantedScopes) {
    params.include_granted_scopes = 'true';
  }

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value);
    }
  });

  return `${baseUrl}?${searchParams.toString()}`;
}

/**
 * Build Google OAuth URL for signup flow
 */
export function buildGoogleSignupUrl(state: string, mockAccountEmail?: string): string {
  return buildGoogleOAuthUrl({
    scopes: ['profile', 'email'],
    state,
    redirectPath: '/oauth/callback/google',
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
    mockAccountEmail,
  });
}

/**
 * Build Google OAuth URL for signin flow
 */
export function buildGoogleSigninUrl(state: string, mockAccountEmail?: string): string {
  return buildGoogleOAuthUrl({
    scopes: ['profile', 'email'],
    state,
    redirectPath: '/oauth/callback/google',
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
    mockAccountEmail,
  });
}

/**
 * Build Google OAuth URL for permission request
 */
export function buildGooglePermissionUrl(
  state: string,
  scopes: string[],
  userEmail?: string,
  mockAccountEmail?: string,
): string {
  return buildGoogleOAuthUrl({
    scopes,
    state,
    redirectPath: '/oauth/permission/callback/google',
    loginHint: userEmail,
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
    mockAccountEmail,
  });
}

/**
 * Build Google OAuth URL for reauthorization
 */
export function buildGoogleReauthorizeUrl(
  state: string,
  scopes: string[],
  userEmail: string,
  mockAccountEmail?: string,
): string {
  return buildGoogleOAuthUrl({
    scopes,
    state,
    redirectPath: '/oauth/permission/callback/google',
    loginHint: userEmail,
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
    mockAccountEmail,
  });
}
