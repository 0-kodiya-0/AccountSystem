import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import {
  AccountType,
  GoogleScopeCheckResult,
  GoogleScopeResult,
  GoogleScopeState,
  GoogleTokenState,
  TokenStatusResponse,
} from '../types';
import { ApiErrorCode, AuthSDKError } from '../types';
import { parseApiError } from '../utils';

export const useGoogle = (accountId?: string) => {
  const authService = useAuthService();

  const currentAccountId = useAppStore((state) => state.getSessionState().data?.currentAccountId || null);
  const targetAccountId = accountId || currentAccountId;

  const accountState = useAppStore((state) =>
    targetAccountId
      ? state.getAccountState(targetAccountId)
      : { data: null, loading: false, error: null, lastLoaded: null },
  );

  const [tokenState, setTokenState] = useState<GoogleTokenState>({
    data: null,
    loading: false,
    error: null,
    lastLoaded: null,
  });

  const [scopeState, setScopeState] = useState<GoogleScopeState>({
    data: null,
    loading: false,
    error: null,
    lastChecked: null,
  });

  const validateOAuthAccount = useCallback((): boolean => {
    if (!targetAccountId) {
      console.error('No account ID available');
      return false;
    }

    if (accountState.data && accountState.data.accountType !== AccountType.OAuth) {
      console.error('Google operations are only available for OAuth accounts');
      return false;
    }

    return true;
  }, [targetAccountId, accountState.data]);

  const getTokenInfo = useCallback(async (): Promise<TokenStatusResponse | null> => {
    if (!validateOAuthAccount()) return null;

    try {
      setTokenState((prev) => ({ ...prev, loading: true, error: null }));

      const tokenInfo = await authService.getTokenStatus(targetAccountId!);

      setTokenState({
        data: tokenInfo,
        loading: false,
        error: null,
        lastLoaded: Date.now(),
      });

      return tokenInfo;
    } catch (err: any) {
      const apiError = parseApiError(err, 'Failed to get token info');

      setTokenState((prev) => ({
        ...prev,
        loading: false,
        error: apiError,
      }));

      return null;
    }
  }, [validateOAuthAccount, authService, targetAccountId]);

  const getAccessTokenInfo = useCallback(async () => {
    if (!validateOAuthAccount()) return null;

    try {
      return await authService.getAccessTokenInfo(targetAccountId!);
    } catch (err: any) {
      const apiError = parseApiError(err, 'Failed to get access token info');
      console.error('Failed to get access token info:', apiError);
      return null;
    }
  }, [validateOAuthAccount, authService, targetAccountId]);

  const getRefreshTokenInfo = useCallback(async () => {
    if (!validateOAuthAccount()) return null;

    try {
      return await authService.getRefreshTokenInfo(targetAccountId!);
    } catch (err: any) {
      const apiError = parseApiError(err, 'Failed to get refresh token info');
      console.error('Failed to get refresh token info:', apiError);
      return null;
    }
  }, [validateOAuthAccount, authService, targetAccountId]);

  const refreshToken = useCallback(
    async (redirectUrl: string) => {
      if (!validateOAuthAccount()) return;

      try {
        await authService.refreshToken(targetAccountId!, redirectUrl);
      } catch (err: any) {
        const apiError = parseApiError(err, 'Failed to refresh token');
        console.error('Failed to refresh token:', apiError);
      }
    },
    [validateOAuthAccount, authService, targetAccountId],
  );

  const revokeTokens = useCallback(async () => {
    if (!validateOAuthAccount()) return null;

    try {
      return await authService.revokeTokens(targetAccountId!);
    } catch (err: any) {
      const apiError = parseApiError(err, 'Failed to revoke tokens');
      console.error('Failed to revoke tokens:', apiError);
      return null;
    }
  }, [validateOAuthAccount, authService, targetAccountId]);

  const validateToken = useCallback(
    async (token: string, tokenType?: 'access' | 'refresh') => {
      if (!validateOAuthAccount()) return null;

      try {
        return await authService.validateToken(targetAccountId!, { token, tokenType });
      } catch (err: any) {
        const apiError = parseApiError(err, 'Failed to validate token');
        console.error('Failed to validate token:', apiError);
        return null;
      }
    },
    [validateOAuthAccount, authService, targetAccountId],
  );

  const checkScopes = useCallback(
    async (scopeNames: string[]): Promise<GoogleScopeCheckResult | null> => {
      if (!validateOAuthAccount()) return null;

      try {
        setScopeState((prev) => ({ ...prev, loading: true, error: null }));

        const tokenInfo = await getTokenInfo();
        if (!tokenInfo?.accessToken) {
          throw new AuthSDKError('No access token available', ApiErrorCode.TOKEN_MISSING);
        }

        const results: Record<string, GoogleScopeResult> = {};
        const requestedScopeUrls: string[] = [];

        scopeNames.forEach((scopeName) => {
          const scopeUrl = scopeName.startsWith('https://')
            ? scopeName
            : `https://www.googleapis.com/auth/${scopeName}`;

          requestedScopeUrls.push(scopeUrl);

          results[scopeName] = {
            hasAccess: false,
            scopeName,
            scopeUrl,
          };
        });

        const result: GoogleScopeCheckResult = {
          summary: {
            totalRequested: scopeNames.length,
            totalGranted: 0,
            allGranted: false,
          },
          requestedScopeNames: scopeNames,
          requestedScopeUrls,
          results,
        };

        setScopeState({
          data: result,
          loading: false,
          error: null,
          lastChecked: Date.now(),
        });

        return result;
      } catch (err: any) {
        const apiError = parseApiError(err, 'Failed to check scopes');

        setScopeState((prev) => ({
          ...prev,
          loading: false,
          error: apiError,
        }));

        return null;
      }
    },
    [validateOAuthAccount, getTokenInfo],
  );

  const requestPermission = useCallback(
    (scopeNames: string[]) => {
      if (!validateOAuthAccount()) return;

      authService.requestGooglePermission(targetAccountId!, scopeNames);
    },
    [validateOAuthAccount, authService, targetAccountId],
  );

  const reauthorizePermissions = useCallback(() => {
    if (!validateOAuthAccount()) return;

    authService.reauthorizePermissions(targetAccountId!);
  }, [validateOAuthAccount, authService, targetAccountId]);

  const hasScope = useCallback(
    async (scopeName: string): Promise<boolean> => {
      const result = await checkScopes([scopeName]);
      return result?.results[scopeName]?.hasAccess || false;
    },
    [checkScopes],
  );

  const hasAllScopes = useCallback(
    async (scopeNames: string[]): Promise<boolean> => {
      const result = await checkScopes(scopeNames);
      return result?.summary.allGranted || false;
    },
    [checkScopes],
  );

  const getMissingScopes = useCallback(
    async (scopeNames: string[]): Promise<string[]> => {
      const result = await checkScopes(scopeNames);
      if (!result) return scopeNames;

      return Object.entries(result.results)
        .filter(([, data]) => !data.hasAccess)
        .map(([scopeName]) => scopeName);
    },
    [checkScopes],
  );

  const isTokenValid = useCallback(async (): Promise<boolean> => {
    const tokenInfo = await getAccessTokenInfo();
    return (tokenInfo?.isValid && !tokenInfo?.isExpired) || false;
  }, [getAccessTokenInfo]);

  const isTokenExpired = useCallback(async (): Promise<boolean> => {
    const tokenInfo = await getAccessTokenInfo();
    return tokenInfo?.isExpired || true;
  }, [getAccessTokenInfo]);

  const getTokenTimeRemaining = useCallback(async (): Promise<number | null> => {
    const tokenInfo = await getAccessTokenInfo();
    return tokenInfo?.timeRemaining || null;
  }, [getAccessTokenInfo]);

  const clearTokenError = useCallback(() => {
    setTokenState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearScopeError = useCallback(() => {
    setScopeState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    accountId: targetAccountId,
    accountType: accountState.data?.accountType,
    isOAuthAccount: accountState.data?.accountType === AccountType.OAuth,

    tokenInfo: {
      data: tokenState.data,
      loading: tokenState.loading,
      error: tokenState.error,
      lastLoaded: tokenState.lastLoaded,
    },

    scopeCheck: {
      data: scopeState.data,
      loading: scopeState.loading,
      error: scopeState.error,
      lastChecked: scopeState.lastChecked,
    },

    getTokenInfo,
    getAccessTokenInfo,
    getRefreshTokenInfo,
    refreshToken,
    revokeTokens,
    validateToken,

    checkScopes,
    requestPermission,
    reauthorizePermissions,

    hasScope,
    hasAllScopes,
    getMissingScopes,
    isTokenValid,
    isTokenExpired,
    getTokenTimeRemaining,

    clearTokenError,
    clearScopeError,

    isTokenLoading: tokenState.loading,
    isScopeLoading: scopeState.loading,
    hasTokenError: !!tokenState.error,
    hasScopeError: !!scopeState.error,
    tokenError: tokenState.error,
    scopeError: scopeState.error,
  };
};
