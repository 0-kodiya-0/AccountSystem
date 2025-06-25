import { describe, it, expect, vi } from 'vitest';
import {
  buildGoogleScopeUrl,
  buildGoogleScopeUrls,
  isValidScopeName,
  validateScopeNames,
  buildGoogleOAuthUrl,
  buildGoogleSignupUrl,
  buildGoogleSigninUrl,
  buildGooglePermissionUrl,
  buildGoogleReauthorizeUrl,
  GOOGLE_SCOPE_BASE_URL,
  SPECIAL_SCOPES,
} from '../config';

// Mock environment config
vi.mock('../../../../config/env.config', () => ({
  getGoogleClientId: () => 'test-client-id',
  getProxyUrl: () => 'http://localhost:7000',
  getBaseUrl: () => '/api',
}));

describe('Google OAuth Config', () => {
  describe('buildGoogleScopeUrl', () => {
    it('should build standard scope URLs', () => {
      expect(buildGoogleScopeUrl('gmail.readonly')).toBe('https://www.googleapis.com/auth/gmail.readonly');
      expect(buildGoogleScopeUrl('calendar.events')).toBe('https://www.googleapis.com/auth/calendar.events');
      expect(buildGoogleScopeUrl('drive.file')).toBe('https://www.googleapis.com/auth/drive.file');
      expect(buildGoogleScopeUrl('spreadsheets')).toBe('https://www.googleapis.com/auth/spreadsheets');
    });

    it('should handle special scopes correctly', () => {
      expect(buildGoogleScopeUrl('openid')).toBe('openid');
      expect(buildGoogleScopeUrl('email')).toBe('https://www.googleapis.com/auth/userinfo.email');
      expect(buildGoogleScopeUrl('profile')).toBe('https://www.googleapis.com/auth/userinfo.profile');
    });

    it('should return full URLs as-is', () => {
      const fullUrl = 'https://www.googleapis.com/auth/custom.scope';
      expect(buildGoogleScopeUrl(fullUrl)).toBe(fullUrl);

      const httpUrl = 'http://example.com/custom/scope';
      expect(buildGoogleScopeUrl(httpUrl)).toBe(httpUrl);
    });

    it('should handle edge cases', () => {
      expect(buildGoogleScopeUrl('simple')).toBe('https://www.googleapis.com/auth/simple');
      expect(buildGoogleScopeUrl('scope.with.dots')).toBe('https://www.googleapis.com/auth/scope.with.dots');
      expect(buildGoogleScopeUrl('scope_with_underscores')).toBe(
        'https://www.googleapis.com/auth/scope_with_underscores',
      );
    });

    it('should handle empty and invalid inputs gracefully', () => {
      expect(buildGoogleScopeUrl('')).toBe('https://www.googleapis.com/auth/');
      expect(buildGoogleScopeUrl('   ')).toBe('https://www.googleapis.com/auth/   ');
    });
  });

  describe('buildGoogleScopeUrls', () => {
    it('should build multiple scope URLs', () => {
      const scopeNames = ['gmail.readonly', 'calendar.events', 'openid'];
      const result = buildGoogleScopeUrls(scopeNames);

      expect(result).toEqual([
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'openid',
      ]);
    });

    it('should handle empty array', () => {
      expect(buildGoogleScopeUrls([])).toEqual([]);
    });

    it('should handle mixed scope types', () => {
      const scopeNames = ['gmail.readonly', 'email', 'https://www.googleapis.com/auth/custom.scope', 'drive.file'];
      const result = buildGoogleScopeUrls(scopeNames);

      expect(result).toEqual([
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/custom.scope',
        'https://www.googleapis.com/auth/drive.file',
      ]);
    });
  });

  describe('isValidScopeName', () => {
    it('should accept valid scope names', () => {
      expect(isValidScopeName('gmail.readonly')).toBe(true);
      expect(isValidScopeName('calendar_events')).toBe(true);
      expect(isValidScopeName('user-profile')).toBe(true);
      expect(isValidScopeName('scope123')).toBe(true);
      expect(isValidScopeName('simple')).toBe(true);
      expect(isValidScopeName('scope.with.many.dots')).toBe(true);
    });

    it('should accept valid full URLs', () => {
      expect(isValidScopeName('https://www.googleapis.com/auth/gmail.readonly')).toBe(true);
      expect(isValidScopeName('http://example.com/scope')).toBe(true);
      expect(isValidScopeName('https://custom.api.com/v1/scope')).toBe(true);
    });

    it('should reject invalid scope names', () => {
      expect(isValidScopeName('')).toBe(false);
      expect(isValidScopeName('   ')).toBe(false);
      expect(isValidScopeName('invalid scope')).toBe(false); // Contains space
      expect(isValidScopeName('scope@invalid')).toBe(false); // Contains @
      expect(isValidScopeName('scope#invalid')).toBe(false); // Contains #
      expect(isValidScopeName('scope%invalid')).toBe(false); // Contains %
    });

    it('should reject null and undefined', () => {
      expect(isValidScopeName(null as any)).toBe(false);
      expect(isValidScopeName(undefined as any)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isValidScopeName(123 as any)).toBe(false);
      expect(isValidScopeName({} as any)).toBe(false);
      expect(isValidScopeName([] as any)).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidScopeName('http://')).toBe(false);
      expect(isValidScopeName('https://')).toBe(false);
      expect(isValidScopeName('http://[invalid')).toBe(false);
    });
  });

  describe('validateScopeNames', () => {
    it('should validate array of valid scope names', () => {
      const scopeNames = ['gmail.readonly', 'calendar.events', 'drive.file'];
      const result = validateScopeNames(scopeNames);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject non-array input', () => {
      const result = validateScopeNames('not-an-array' as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Scope names must be an array']);
    });

    it('should reject empty array', () => {
      const result = validateScopeNames([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['At least one scope name is required']);
    });

    it('should identify invalid scope names with indices', () => {
      const scopeNames = ['gmail.readonly', 'invalid scope', 'calendar.events', 'scope@invalid'];
      const result = validateScopeNames(scopeNames);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid scope name at index 1: "invalid scope"');
      expect(result.errors).toContain('Invalid scope name at index 3: "scope@invalid"');
      expect(result.errors).toHaveLength(2);
    });

    it('should handle mixed valid and invalid scopes', () => {
      const scopeNames = ['gmail.readonly', '', 'calendar.events'];
      const result = validateScopeNames(scopeNames);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Invalid scope name at index 1: ""']);
    });
  });

  describe('buildGoogleOAuthUrl', () => {
    const defaultOptions = {
      state: 'test-state-123',
      redirectPath: '/oauth/callback',
    };

    it('should build basic OAuth URL with default options', () => {
      const url = buildGoogleOAuthUrl(defaultOptions);
      const urlObj = new URL(url);

      expect(urlObj.origin).toBe('https://accounts.google.com');
      expect(urlObj.pathname).toBe('/o/oauth2/v2/auth');
      expect(urlObj.searchParams.get('client_id')).toBe('test-client-id');
      expect(urlObj.searchParams.get('response_type')).toBe('code');
      expect(urlObj.searchParams.get('state')).toBe('test-state-123');
      expect(urlObj.searchParams.get('redirect_uri')).toBe('http://localhost:7000/api/oauth/callback');
    });

    it('should include custom scopes', () => {
      const options = {
        ...defaultOptions,
        scopes: ['gmail.readonly', 'calendar.events'],
      };

      const url = buildGoogleOAuthUrl(options);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('scope')).toBe('gmail.readonly calendar.events');
    });

    it('should handle all optional parameters', () => {
      const options = {
        ...defaultOptions,
        scopes: ['profile', 'email'],
        loginHint: 'user@example.com',
        accessType: 'offline' as const,
        prompt: 'consent' as const,
        includeGrantedScopes: true,
        responseType: 'code' as const,
      };

      const url = buildGoogleOAuthUrl(options);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('scope')).toBe('profile email');
      expect(urlObj.searchParams.get('login_hint')).toBe('user@example.com');
      expect(urlObj.searchParams.get('access_type')).toBe('offline');
      expect(urlObj.searchParams.get('prompt')).toBe('consent');
      expect(urlObj.searchParams.get('include_granted_scopes')).toBe('true');
      expect(urlObj.searchParams.get('response_type')).toBe('code');
    });

    it('should omit empty or undefined optional parameters', () => {
      const options = {
        ...defaultOptions,
        scopes: [],
        loginHint: undefined,
        accessType: undefined,
        prompt: undefined,
        includeGrantedScopes: false,
      };

      const url = buildGoogleOAuthUrl(options);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.has('scope')).toBe(false);
      expect(urlObj.searchParams.has('login_hint')).toBe(false);
      expect(urlObj.searchParams.has('access_type')).toBe(false);
      expect(urlObj.searchParams.has('prompt')).toBe(false);
      expect(urlObj.searchParams.has('include_granted_scopes')).toBe(false);
    });

    it('should handle special characters in state parameter', () => {
      const options = {
        ...defaultOptions,
        state: 'state-with-special-chars!@#$%^&*()',
      };

      const url = buildGoogleOAuthUrl(options);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('state')).toBe('state-with-special-chars!@#$%^&*()');
    });
  });

  describe('buildGoogleSignupUrl', () => {
    it('should build signup URL with correct parameters', () => {
      const url = buildGoogleSignupUrl('signup-state-123');
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('state')).toBe('signup-state-123');
      expect(urlObj.searchParams.get('scope')).toBe('profile email');
      expect(urlObj.searchParams.get('redirect_uri')).toContain('/oauth/callback/google');
      expect(urlObj.searchParams.get('access_type')).toBe('offline');
      expect(urlObj.searchParams.get('prompt')).toBe('consent');
      expect(urlObj.searchParams.get('include_granted_scopes')).toBe('true');
    });
  });

  describe('buildGoogleSigninUrl', () => {
    it('should build signin URL with correct parameters', () => {
      const url = buildGoogleSigninUrl('signin-state-456');
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('state')).toBe('signin-state-456');
      expect(urlObj.searchParams.get('scope')).toBe('profile email');
      expect(urlObj.searchParams.get('redirect_uri')).toContain('/oauth/callback/google');
      expect(urlObj.searchParams.get('access_type')).toBe('offline');
      expect(urlObj.searchParams.get('prompt')).toBe('consent');
    });
  });

  describe('buildGooglePermissionUrl', () => {
    it('should build permission URL with custom scopes', () => {
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ];
      const url = buildGooglePermissionUrl('permission-state-789', scopes, 'user@example.com');
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('state')).toBe('permission-state-789');
      expect(urlObj.searchParams.get('scope')).toBe(scopes.join(' '));
      expect(urlObj.searchParams.get('login_hint')).toBe('user@example.com');
      expect(urlObj.searchParams.get('redirect_uri')).toContain('oauth/permission/callback/google');
    });

    it('should work without login hint', () => {
      const scopes = ['https://www.googleapis.com/auth/drive.file'];
      const url = buildGooglePermissionUrl('permission-state', scopes);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('login_hint')).toBe(null);
      expect(urlObj.searchParams.get('scope')).toBe(scopes[0]);
    });
  });

  describe('buildGoogleReauthorizeUrl', () => {
    it('should build reauthorization URL', () => {
      const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
      const url = buildGoogleReauthorizeUrl('reauth-state', scopes, 'user@example.com');
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('state')).toBe('reauth-state');
      expect(urlObj.searchParams.get('scope')).toBe(scopes[0]);
      expect(urlObj.searchParams.get('login_hint')).toBe('user@example.com');
      expect(urlObj.searchParams.get('prompt')).toBe('consent');
      expect(urlObj.searchParams.get('redirect_uri')).toContain('oauth/permission/callback/google');
    });
  });

  describe('Constants', () => {
    it('should have correct Google scope base URL', () => {
      expect(GOOGLE_SCOPE_BASE_URL).toBe('https://www.googleapis.com/auth/');
    });

    it('should have correct special scopes', () => {
      expect(SPECIAL_SCOPES.openid).toBe('openid');
      expect(SPECIAL_SCOPES.email).toBe('https://www.googleapis.com/auth/userinfo.email');
      expect(SPECIAL_SCOPES.profile).toBe('https://www.googleapis.com/auth/userinfo.profile');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long scope names', () => {
      const longScope = 'very.long.scope.name.that.exceeds.normal.length.limits.and.tests.boundary.conditions';
      expect(isValidScopeName(longScope)).toBe(true);
      expect(buildGoogleScopeUrl(longScope)).toBe(`https://www.googleapis.com/auth/${longScope}`);
    });

    it('should handle Unicode characters in scope names', () => {
      const unicodeScope = 'scope.with.ñicode.characters';
      expect(isValidScopeName(unicodeScope)).toBe(true);
    });

    it('should handle state parameters with spaces', () => {
      const url = buildGoogleOAuthUrl({
        state: 'state with spaces',
        redirectPath: '/callback',
      });
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('state')).toBe('state with spaces');
    });

    it('should handle empty scopes array in OAuth URL building', () => {
      const url = buildGoogleOAuthUrl({
        state: 'test-state',
        redirectPath: '/callback',
        scopes: [],
      });
      const urlObj = new URL(url);

      expect(urlObj.searchParams.has('scope')).toBe(false);
    });

    it('should handle redirect paths with leading slash', () => {
      const url = buildGoogleOAuthUrl({
        state: 'test-state',
        redirectPath: '/oauth/callback',
      });

      expect(url).toContain('redirect_uri=http%3A//localhost%3A7000/api/oauth/callback');
    });

    it('should handle redirect paths without leading slash', () => {
      const url = buildGoogleOAuthUrl({
        state: 'test-state',
        redirectPath: 'oauth/callback',
      });

      expect(url).toContain('redirect_uri=http%3A//localhost%3A7000/api/oauth/callback');
    });
  });
});
