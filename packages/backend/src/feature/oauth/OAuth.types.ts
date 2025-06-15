import { OAuthProviders } from '../account/Account.types';

export interface TokenDetails {
  accessToken: string;
  refreshToken?: string | null;
}

export enum AuthType {
  SIGN_UP = 'signup',
  SIGN_IN = 'signin',
  PERMISSION = 'permission',
}

export interface OAuthState {
  state: string;
  provider: OAuthProviders;
  authType: AuthType;
  expiresAt: string;
}

// Add a new type for permission requests
export interface PermissionState extends OAuthState {
  accountId: string;
  service: string;
  scopeLevel: string;
}

export interface SignUpState {
  state: string;
  oAuthResponse: ProviderResponse;
  expiresAt: string;
}

export type SignUpDetails = 'device' | undefined | null;

export interface SignInState {
  state: string;
  oAuthResponse: ProviderResponse;
  expiresAt: string;
}

export interface AuthUrls {
  [OAuthProviders.Google]: string;
  [OAuthProviders.Microsoft]: string;
  [OAuthProviders.Facebook]: string;
}

export interface ProviderResponse {
  provider: OAuthProviders;
  name: string;
  email?: string | null;
  imageUrl?: string | null;
  tokenDetails: TokenDetails;
  permissionState?: PermissionState | null;
}

export interface OAuthTwoFactorTokens {
  accountId: string; // Include account ID directly
  accessToken: string;
  refreshToken: string;
  userInfo: ProviderResponse;
  expiresAt: string;
}
