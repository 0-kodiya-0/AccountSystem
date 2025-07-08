import { Request } from 'express';

export interface OAuthAuthorizationResult {
  success: boolean;
  data?: {
    code: string;
    state: string;
    redirect_uri: string;
  };
  error?: {
    error: string;
    error_description: string;
    state: string;
    redirect_uri: string;
  };
}

export interface OAuthTokenRequest {
  grant_type: string;
  code?: string;
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
}

export interface OAuthUserInfoRequest extends Request {
  headers: {
    authorization?: string;
  };
}

export interface OAuthTokenInfoRequest extends Request {
  query: {
    access_token?: string;
  };
}

export interface OAuthRevokeRequest {
  token: string;
}

export interface OAuthRevokeResponse {
  success: boolean;
}

export interface ProviderInfoResponse {
  provider: string;
  accountCount: number;
  accounts: Array<{
    id: string;
    email: string;
    name: string;
    status: string;
    twoFactorEnabled: boolean;
  }>;
  endpoints: Record<string, unknown>;
  supported: boolean;
}

export interface OAuthMockStatusResponse {
  enabled: boolean;
  [key: string]: unknown;
}

export interface OAuthCacheResponse {
  message: string;
}

export interface OAuthConfigResponse {
  message: string;
  config: unknown;
}
