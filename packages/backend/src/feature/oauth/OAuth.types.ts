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
  callbackUrl: string; // NEW: Store callback URL in state
}

// Add a new type for permission requests
export interface OAuthPermissionState extends OAuthState {
  accountId: string;
  service: string;
  scopeLevel: string;
}

export interface SignUpState {
  state: string;
  oAuthResponse: ProviderResponse;
  expiresAt: string;
  callbackUrl?: string; // NEW: Optional callback URL for signup states
}

export type SignUpDetails = 'device' | undefined | null;

export interface SignInState {
  state: string;
  oAuthResponse: ProviderResponse;
  expiresAt: string;
  callbackUrl?: string; // NEW: Optional callback URL for signin states
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
  permissionState?: OAuthPermissionState | null;
}

export type StateDetails = OAuthState | SignInState | SignUpState | null;
