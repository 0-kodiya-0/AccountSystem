import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import fs from 'fs';
import {
    AuthSDKConfig,
    ApiResponse,
    UserSearchResult,
    ScopesResult,
    SessionValidationResult,
    GoogleValidationResult,
    GoogleTokenInfoResult,
    TokenVerificationResult
} from '../types';

export class AuthClient {
    private config: AuthSDKConfig;
    private httpClient: AxiosInstance;

    constructor(config: AuthSDKConfig) {
        this.config = config;

        // Create HTTPS agent with client certificates
        const httpsAgent = new https.Agent({
            cert: fs.readFileSync(config.certificates.cert),
            key: fs.readFileSync(config.certificates.key),
            ca: fs.readFileSync(config.certificates.ca),
            requestCert: true,
            rejectUnauthorized: true
        });

        // Create axios instance with configuration
        this.httpClient = axios.create({
            baseURL: config.authServiceUrl,
            timeout: config.requestTimeout || 10000,
            httpsAgent,
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service-ID': config.serviceName.toUpperCase(),
                'X-Internal-Service-Secret': config.serviceSecret,
                'User-Agent': `auth-node-sdk/${config.serviceName}`
            }
        });

        // Add response interceptor to handle API response format
        this.httpClient.interceptors.response.use(
            (response) => {
                const apiResponse: ApiResponse = response.data;
                if (apiResponse.success) {
                    return { ...response, data: apiResponse.data };
                } else {
                    throw new Error(apiResponse.error?.message || 'Unknown API error');
                }
            },
            (error) => {
                if (error.response?.data?.error) {
                    throw new Error(error.response.data.error.message);
                }
                throw new Error(error.message || 'Request failed');
            }
        );
    }

    async getUserInfo(accountId: string): Promise<UserSearchResult> {
        const response = await this.httpClient.get(`/internal/auth/users/${accountId}`);
        return response.data;
    }

    async searchUserByEmail(email: string): Promise<UserSearchResult> {
        const response = await this.httpClient.get(`/internal/auth/users/search`, {
            params: { email }
        });
        return response.data;
    }

    async getUserScopes(accountId: string): Promise<ScopesResult> {
        const response = await this.httpClient.get(`/internal/auth/users/${accountId}/scopes`);
        return response.data;
    }

    async validateSession(
        accountId: string,
        accessToken?: string,
        refreshToken?: string
    ): Promise<SessionValidationResult> {
        const response = await this.httpClient.post('/internal/auth/session/validate', {
            accountId,
            accessToken,
            refreshToken
        });
        return response.data;
    }

    async validateGoogleAccess(
        accountId: string,
        accessToken: string,
        requiredScopes?: string[]
    ): Promise<GoogleValidationResult> {
        const response = await this.httpClient.post('/internal/auth/google/validate', {
            accountId,
            accessToken,
            requiredScopes
        });
        return response.data;
    }

    async verifyGoogleToken(accountId: string, accessToken: string): Promise<TokenVerificationResult> {
        const response = await this.httpClient.post('/internal/auth/google/token/verify', {
            accountId,
            accessToken
        });
        return response.data;
    }

    async getGoogleTokenInfo(accountId: string, accessToken: string): Promise<GoogleTokenInfoResult> {
        const response = await this.httpClient.post(`/internal/auth/google/token/info/${accountId}`, {
            accessToken
        });
        return response.data;
    }
}