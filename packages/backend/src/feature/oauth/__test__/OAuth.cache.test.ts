import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveOAuthState,
  getOAuthState,
  removeOAuthState,
  savePermissionState,
  getPermissionState,
  removePermissionState,
  getAllOAuthStates,
  getAllPermissionStates,
  getOAuthStatesByProvider,
} from '../OAuth.cache';
import { OAuthProviders } from '../../account/Account.types';
import { AuthType } from '../OAuth.types';

// Mock crypto module for consistent testing
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(),
  },
}));

import crypto from 'crypto';

describe('OAuth Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock crypto.randomBytes to return predictable values
    vi.mocked(crypto.randomBytes).mockImplementation((size: number) => {
      return Buffer.from('a'.repeat(size * 2), 'hex');
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('OAuth State Management', () => {
    describe('saveOAuthState', () => {
      it('should generate and save OAuth state successfully', () => {
        const provider = OAuthProviders.Google;
        const authType = AuthType.SIGN_UP;
        const callbackUrl = 'http://example.com/callback';

        const state = saveOAuthState(provider, authType, callbackUrl);

        expect(state).toBeDefined();
        expect(typeof state).toBe('string');
        expect(state.length).toBe(64); // 32 bytes * 2 hex chars per byte
        expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      });

      it('should save different auth types correctly', () => {
        const provider = OAuthProviders.Google;
        const callbackUrl = 'http://example.com/callback';

        const signupState = saveOAuthState(provider, AuthType.SIGN_UP, callbackUrl);
        const signinState = saveOAuthState(provider, AuthType.SIGN_IN, callbackUrl);

        expect(signupState).toBeDefined();
        expect(signinState).toBeDefined();
        expect(signupState).not.toBe(signinState); // Should be different states
      });

      it('should save state with correct expiration time', () => {
        const provider = OAuthProviders.Google;
        const authType = AuthType.SIGN_UP;
        const callbackUrl = 'http://example.com/callback';

        const beforeSave = Date.now();
        const state = saveOAuthState(provider, authType, callbackUrl);
        const afterSave = Date.now();

        const retrievedState = getOAuthState(state, provider);
        expect(retrievedState).toBeDefined();

        const expirationTime = new Date(retrievedState!.expiresAt).getTime();
        const expectedMinExpiration = beforeSave + 10 * 60 * 1000; // 10 minutes
        const expectedMaxExpiration = afterSave + 10 * 60 * 1000;

        expect(expirationTime).toBeGreaterThanOrEqual(expectedMinExpiration);
        expect(expirationTime).toBeLessThanOrEqual(expectedMaxExpiration);
      });
    });

    describe('getOAuthState', () => {
      it('should retrieve saved OAuth state successfully', () => {
        const provider = OAuthProviders.Google;
        const authType = AuthType.SIGN_UP;
        const callbackUrl = 'http://example.com/callback';

        const state = saveOAuthState(provider, authType, callbackUrl);
        const retrievedState = getOAuthState(state, provider);

        expect(retrievedState).toBeDefined();
        expect(retrievedState!.state).toBe(state);
        expect(retrievedState!.provider).toBe(provider);
        expect(retrievedState!.authType).toBe(authType);
        expect(retrievedState!.callbackUrl).toBe(callbackUrl);
      });

      it('should return null for non-existent state', () => {
        const provider = OAuthProviders.Google;
        const nonExistentState = 'non-existent-state';

        const result = getOAuthState(nonExistentState, provider);

        expect(result).toBeNull();
      });

      it('should return null for wrong provider', () => {
        const correctProvider = OAuthProviders.Google;
        const wrongProvider = OAuthProviders.Microsoft;
        const authType = AuthType.SIGN_UP;
        const callbackUrl = 'http://example.com/callback';

        const state = saveOAuthState(correctProvider, authType, callbackUrl);
        const result = getOAuthState(state, wrongProvider);

        expect(result).toBeNull();
      });

      it('should return null for expired state', () => {
        const provider = OAuthProviders.Google;
        const authType = AuthType.SIGN_UP;
        const callbackUrl = 'http://example.com/callback';

        const state = saveOAuthState(provider, authType, callbackUrl);

        // Mock Date.now to simulate time passing beyond expiration
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + 15 * 60 * 1000); // 15 minutes later

        const result = getOAuthState(state, provider);

        expect(result).toBeNull();

        // Restore original Date.now
        Date.now = originalNow;
      });
    });

    describe('removeOAuthState', () => {
      it('should remove OAuth state successfully', () => {
        const provider = OAuthProviders.Google;
        const authType = AuthType.SIGN_UP;
        const callbackUrl = 'http://example.com/callback';

        const state = saveOAuthState(provider, authType, callbackUrl);

        // Verify state exists
        expect(getOAuthState(state, provider)).toBeDefined();

        // Remove state
        removeOAuthState(state);

        // Verify state is removed
        expect(getOAuthState(state, provider)).toBeNull();
      });

      it('should not throw error when removing non-existent state', () => {
        expect(() => removeOAuthState('non-existent-state')).not.toThrow();
      });
    });
  });

  describe('Permission State Management', () => {
    describe('savePermissionState', () => {
      it('should generate and save permission state successfully', () => {
        const provider = OAuthProviders.Google;
        const accountId = 'account123';
        const service = 'gmail';
        const scopeLevel = 'read';
        const callbackUrl = 'http://example.com/callback';

        const state = savePermissionState(provider, accountId, service, scopeLevel, callbackUrl);

        expect(state).toBeDefined();
        expect(typeof state).toBe('string');
        expect(state.length).toBe(64);
        expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      });

      it('should save permission state with correct data', () => {
        const provider = OAuthProviders.Google;
        const accountId = 'account123';
        const service = 'gmail';
        const scopeLevel = 'read';
        const callbackUrl = 'http://example.com/callback';

        const state = savePermissionState(provider, accountId, service, scopeLevel, callbackUrl);
        const retrievedState = getPermissionState(state, provider);

        expect(retrievedState).toBeDefined();
        expect(retrievedState!.accountId).toBe(accountId);
        expect(retrievedState!.service).toBe(service);
        expect(retrievedState!.scopeLevel).toBe(scopeLevel);
        expect(retrievedState!.callbackUrl).toBe(callbackUrl);
        expect(retrievedState!.authType).toBe(AuthType.PERMISSION);
      });
    });

    describe('getPermissionState', () => {
      it('should retrieve saved permission state successfully', () => {
        const provider = OAuthProviders.Google;
        const accountId = 'account123';
        const service = 'gmail';
        const scopeLevel = 'read';
        const callbackUrl = 'http://example.com/callback';

        const state = savePermissionState(provider, accountId, service, scopeLevel, callbackUrl);
        const retrievedState = getPermissionState(state, provider);

        expect(retrievedState).toBeDefined();
        expect(retrievedState!.state).toBe(state);
        expect(retrievedState!.provider).toBe(provider);
        expect(retrievedState!.accountId).toBe(accountId);
      });

      it('should return null for non-existent permission state', () => {
        const provider = OAuthProviders.Google;
        const nonExistentState = 'non-existent-state';

        const result = getPermissionState(nonExistentState, provider);

        expect(result).toBeNull();
      });

      it('should return null for wrong provider', () => {
        const correctProvider = OAuthProviders.Google;
        const wrongProvider = OAuthProviders.Microsoft;
        const accountId = 'account123';
        const service = 'gmail';
        const scopeLevel = 'read';
        const callbackUrl = 'http://example.com/callback';

        const state = savePermissionState(correctProvider, accountId, service, scopeLevel, callbackUrl);
        const result = getPermissionState(state, wrongProvider);

        expect(result).toBeNull();
      });

      it('should return null for expired permission state', () => {
        const provider = OAuthProviders.Google;
        const accountId = 'account123';
        const service = 'gmail';
        const scopeLevel = 'read';
        const callbackUrl = 'http://example.com/callback';

        const state = savePermissionState(provider, accountId, service, scopeLevel, callbackUrl);

        // Mock Date.now to simulate time passing beyond expiration
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + 15 * 60 * 1000); // 15 minutes later

        const result = getPermissionState(state, provider);

        expect(result).toBeNull();

        // Restore original Date.now
        Date.now = originalNow;
      });
    });

    describe('removePermissionState', () => {
      it('should remove permission state successfully', () => {
        const provider = OAuthProviders.Google;
        const accountId = 'account123';
        const service = 'gmail';
        const scopeLevel = 'read';
        const callbackUrl = 'http://example.com/callback';

        const state = savePermissionState(provider, accountId, service, scopeLevel, callbackUrl);

        // Verify state exists
        expect(getPermissionState(state, provider)).toBeDefined();

        // Remove state
        removePermissionState(state);

        // Verify state is removed
        expect(getPermissionState(state, provider)).toBeNull();
      });

      it('should not throw error when removing non-existent permission state', () => {
        expect(() => removePermissionState('non-existent-state')).not.toThrow();
      });
    });
  });

  describe('Cache Utility Functions', () => {
    describe('getAllOAuthStates', () => {
      it('should return empty array when no states exist', () => {
        const states = getAllOAuthStates();
        expect(states).toEqual([]);
      });

      it('should return all valid OAuth states', () => {
        const provider = OAuthProviders.Google;
        const callbackUrl = 'http://example.com/callback';

        const state1 = saveOAuthState(provider, AuthType.SIGN_UP, callbackUrl);
        const state2 = saveOAuthState(provider, AuthType.SIGN_IN, callbackUrl);

        const allStates = getAllOAuthStates();

        expect(allStates).toHaveLength(2);
        expect(allStates.map((s) => s.state)).toContain(state1);
        expect(allStates.map((s) => s.state)).toContain(state2);
      });

      it('should exclude expired states and clean them up', () => {
        const provider = OAuthProviders.Google;
        const callbackUrl = 'http://example.com/callback';

        const state1 = saveOAuthState(provider, AuthType.SIGN_UP, callbackUrl);
        const state2 = saveOAuthState(provider, AuthType.SIGN_IN, callbackUrl);

        // Mock Date.now to make one state expired
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + 15 * 60 * 1000); // 15 minutes later

        const allStates = getAllOAuthStates();

        expect(allStates).toHaveLength(0); // All states should be expired and cleaned up

        // Restore original Date.now
        Date.now = originalNow;
      });
    });

    describe('getAllPermissionStates', () => {
      it('should return empty array when no permission states exist', () => {
        const states = getAllPermissionStates();
        expect(states).toEqual([]);
      });

      it('should return all valid permission states', () => {
        const provider = OAuthProviders.Google;
        const callbackUrl = 'http://example.com/callback';

        const state1 = savePermissionState(provider, 'account1', 'gmail', 'read', callbackUrl);
        const state2 = savePermissionState(provider, 'account2', 'drive', 'write', callbackUrl);

        const allStates = getAllPermissionStates();

        expect(allStates).toHaveLength(2);
        expect(allStates.map((s) => s.state)).toContain(state1);
        expect(allStates.map((s) => s.state)).toContain(state2);
      });

      it('should exclude expired permission states and clean them up', () => {
        const provider = OAuthProviders.Google;
        const callbackUrl = 'http://example.com/callback';

        savePermissionState(provider, 'account1', 'gmail', 'read', callbackUrl);
        savePermissionState(provider, 'account2', 'drive', 'write', callbackUrl);

        // Mock Date.now to make states expired
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + 15 * 60 * 1000); // 15 minutes later

        const allStates = getAllPermissionStates();

        expect(allStates).toHaveLength(0); // All states should be expired and cleaned up

        // Restore original Date.now
        Date.now = originalNow;
      });
    });

    describe('getOAuthStatesByProvider', () => {
      it('should return empty array for provider with no states', () => {
        const states = getOAuthStatesByProvider(OAuthProviders.Microsoft);
        expect(states).toEqual([]);
      });

      it('should return only states for specified provider', () => {
        const callbackUrl = 'http://example.com/callback';

        const googleState = saveOAuthState(OAuthProviders.Google, AuthType.SIGN_UP, callbackUrl);

        // Mock crypto to return different value for second call
        vi.mocked(crypto.randomBytes).mockImplementationOnce((size: number) => {
          return Buffer.from('b'.repeat(size * 2), 'hex');
        });

        const microsoftState = saveOAuthState(OAuthProviders.Microsoft, AuthType.SIGN_IN, callbackUrl);

        const googleStates = getOAuthStatesByProvider(OAuthProviders.Google);
        const microsoftStates = getOAuthStatesByProvider(OAuthProviders.Microsoft);

        expect(googleStates).toHaveLength(1);
        expect(googleStates[0].state).toBe(googleState);
        expect(googleStates[0].provider).toBe(OAuthProviders.Google);

        expect(microsoftStates).toHaveLength(1);
        expect(microsoftStates[0].state).toBe(microsoftState);
        expect(microsoftStates[0].provider).toBe(OAuthProviders.Microsoft);
      });

      it('should exclude expired states for provider', () => {
        const callbackUrl = 'http://example.com/callback';

        saveOAuthState(OAuthProviders.Google, AuthType.SIGN_UP, callbackUrl);

        // Mock Date.now to make state expired
        const originalNow = Date.now;
        Date.now = vi.fn(() => originalNow() + 15 * 60 * 1000); // 15 minutes later

        const googleStates = getOAuthStatesByProvider(OAuthProviders.Google);

        expect(googleStates).toHaveLength(0);

        // Restore original Date.now
        Date.now = originalNow;
      });
    });
  });

  describe('Cache TTL and Expiration', () => {
    it('should set correct TTL for OAuth states (10 minutes)', () => {
      const provider = OAuthProviders.Google;
      const authType = AuthType.SIGN_UP;
      const callbackUrl = 'http://example.com/callback';

      const beforeSave = Date.now();
      const state = saveOAuthState(provider, authType, callbackUrl);
      const afterSave = Date.now();

      const retrievedState = getOAuthState(state, provider);
      const expirationTime = new Date(retrievedState!.expiresAt).getTime();

      // Should expire in approximately 10 minutes (600,000 ms)
      const expectedMinExpiration = beforeSave + 599000; // 9 minutes 59 seconds
      const expectedMaxExpiration = afterSave + 601000; // 10 minutes 1 second

      expect(expirationTime).toBeGreaterThanOrEqual(expectedMinExpiration);
      expect(expirationTime).toBeLessThanOrEqual(expectedMaxExpiration);
    });

    it('should set correct TTL for permission states (10 minutes)', () => {
      const provider = OAuthProviders.Google;
      const accountId = 'account123';
      const service = 'gmail';
      const scopeLevel = 'read';
      const callbackUrl = 'http://example.com/callback';

      const beforeSave = Date.now();
      const state = savePermissionState(provider, accountId, service, scopeLevel, callbackUrl);
      const afterSave = Date.now();

      const retrievedState = getPermissionState(state, provider);
      const expirationTime = new Date(retrievedState!.expiresAt).getTime();

      // Should expire in approximately 10 minutes (600,000 ms)
      const expectedMinExpiration = beforeSave + 599000; // 9 minutes 59 seconds
      const expectedMaxExpiration = afterSave + 601000; // 10 minutes 1 second

      expect(expirationTime).toBeGreaterThanOrEqual(expectedMinExpiration);
      expect(expirationTime).toBeLessThanOrEqual(expectedMaxExpiration);
    });
  });

  describe('State Data Integrity', () => {
    it('should preserve all OAuth state data fields', () => {
      const provider = OAuthProviders.Google;
      const authType = AuthType.SIGN_UP;
      const callbackUrl = 'http://example.com/callback/with/path?param=value';

      const state = saveOAuthState(provider, authType, callbackUrl);
      const retrievedState = getOAuthState(state, provider);

      expect(retrievedState).toEqual({
        state,
        provider,
        authType,
        callbackUrl,
        expiresAt: expect.any(String),
      });

      // Verify expiresAt is a valid ISO string
      expect(() => new Date(retrievedState!.expiresAt)).not.toThrow();
    });

    it('should preserve all permission state data fields', () => {
      const provider = OAuthProviders.Google;
      const accountId = 'account123';
      const service = 'gmail';
      const scopeLevel = 'read,write,admin';
      const callbackUrl = 'http://example.com/permission/callback?redirect=true';

      const state = savePermissionState(provider, accountId, service, scopeLevel, callbackUrl);
      const retrievedState = getPermissionState(state, provider);

      expect(retrievedState).toEqual({
        state,
        provider,
        authType: AuthType.PERMISSION,
        accountId,
        service,
        scopeLevel,
        callbackUrl,
        expiresAt: expect.any(String),
      });

      // Verify expiresAt is a valid ISO string
      expect(() => new Date(retrievedState!.expiresAt)).not.toThrow();
    });
  });
});
