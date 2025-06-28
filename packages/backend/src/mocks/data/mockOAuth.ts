import { OAuthProviders } from '../../feature/account';
import { OAuthState, PermissionState, ProviderResponse, AuthType } from '../../feature/oauth/OAuth.types';

export const mockOAuthState: OAuthState = {
  state: 'oauth_state_12345abcdef',
  provider: OAuthProviders.Google,
  authType: AuthType.SIGN_IN,
  expiresAt: new Date(Date.now() + 600000).toISOString(), // 10 minutes from now
  callbackUrl: 'https://app.example.com/auth/callback',
};

export const mockPermissionState: PermissionState = {
  state: 'permission_state_67890ghijkl',
  provider: OAuthProviders.Google,
  authType: AuthType.PERMISSION,
  accountId: '507f1f77bcf86cd799439012',
  service: 'gmail',
  scopeLevel: 'read',
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  callbackUrl: 'https://app.example.com/permission/callback',
};

export const mockProviderResponse: ProviderResponse = {
  provider: OAuthProviders.Google,
  name: 'Jane Smith',
  email: 'jane.smith@gmail.com',
  imageUrl: 'https://lh3.googleusercontent.com/a/example',
  tokenDetails: {
    accessToken: 'ya29.example_google_access_token_12345',
    refreshToken: '1//example_google_refresh_token_67890',
  },
};
