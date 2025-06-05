import axios, { AxiosInstance, AxiosError } from 'axios';
import {
    SDKConfig,
    ApiResponse,
    Account,
    LocalSignupRequest,
    LocalLoginRequest,
    LocalLoginResponse,
    TwoFactorVerifyRequest,
    PasswordResetRequest,
    ResetPasswordRequest,
    PasswordChangeRequest,
    TwoFactorSetupRequest,
    TwoFactorSetupResponse,
    Notification,
    CreateNotificationRequest,
    NotificationListResponse,
    TokenCheckResponse,
    AuthSDKError,
    ErrorCode
} from '../types';

export class AuthClient {
    private http: AxiosInstance;

    constructor(config: SDKConfig) {
        this.http = axios.create({
            baseURL: config.baseURL,
            timeout: config.timeout || 30000,
            withCredentials: config.withCredentials !== false,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Response interceptor to handle API responses
        this.http.interceptors.response.use(
            (response) => {
                const apiResponse: ApiResponse = response.data;
                if (apiResponse.success) {
                    return { ...response, data: apiResponse.data };
                } else {
                    throw new AuthSDKError(
                        apiResponse.error?.message || 'API error',
                        apiResponse.error?.code || ErrorCode.SERVER_ERROR,
                        response.status
                    );
                }
            },
            (error: AxiosError) => {
                if (error.response?.data) {
                    const apiResponse = error.response.data as ApiResponse;
                    throw new AuthSDKError(
                        apiResponse.error?.message || error.message,
                        apiResponse.error?.code || ErrorCode.NETWORK_ERROR,
                        error.response.status,
                        apiResponse.error
                    );
                }
                throw new AuthSDKError(
                    error.message || 'Network error',
                    ErrorCode.NETWORK_ERROR,
                    undefined,
                    error
                );
            }
        );
    }

    // Account Management
    async searchAccount(email: string): Promise<{ accountId?: string }> {
        const response = await this.http.get('/account/search', {
            params: { email }
        });
        return response.data;
    }

    async getAccount(accountId: string): Promise<Account> {
        const response = await this.http.get(`/${accountId}/account`);
        return response.data;
    }

    async updateAccount(accountId: string, updates: Partial<Account>): Promise<Account> {
        const response = await this.http.patch(`/${accountId}/account`, updates);
        return response.data;
    }

    async getAccountEmail(accountId: string): Promise<{ email: string }> {
        const response = await this.http.get(`/${accountId}/account/email`);
        return response.data;
    }

    async updateAccountSecurity(accountId: string, security: any): Promise<Account> {
        const response = await this.http.patch(`/${accountId}/account/security`, security);
        return response.data;
    }

    async refreshToken(accountId: string, redirectUrl?: string): Promise<void> {
        const params = new URLSearchParams();
        if (redirectUrl) params.append('redirectUrl', redirectUrl);
        
        window.location.href = `/${accountId}/account/refreshToken?${params.toString()}`;
    }

    async revokeToken(accountId: string): Promise<{ success: boolean }> {
        const response = await this.http.get(`/${accountId}/account/refreshToken/revoke`);
        return response.data;
    }

    async logout(accountId: string): Promise<void> {
        await this.http.get('/account/logout', {
            params: { accountId }
        });
    }

    async logoutAll(accountIds: string[]): Promise<void> {
        const params = new URLSearchParams();
        accountIds.forEach(id => params.append('accountIds', id));
        
        await this.http.get(`/account/logout/all?${params.toString()}`);
    }

    // Local Authentication
    async localSignup(data: LocalSignupRequest): Promise<{ accountId: string }> {
        const response = await this.http.post('/auth/signup', data);
        return response.data;
    }

    async localLogin(data: LocalLoginRequest): Promise<LocalLoginResponse> {
        const response = await this.http.post('/auth/login', data);
        return response.data;
    }

    async verifyTwoFactor(data: TwoFactorVerifyRequest): Promise<LocalLoginResponse> {
        const response = await this.http.post('/auth/verify-two-factor', data);
        return response.data;
    }

    async verifyEmail(token: string): Promise<void> {
        await this.http.get(`/auth/verify-email?token=${token}`);
    }

    async requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
        const response = await this.http.post('/auth/reset-password-request', data);
        return response.data;
    }

    async resetPassword(token: string, data: ResetPasswordRequest): Promise<{ message: string }> {
        const response = await this.http.post(`/auth/reset-password?token=${token}`, data);
        return response.data;
    }

    async changePassword(accountId: string, data: PasswordChangeRequest): Promise<{ message: string }> {
        const response = await this.http.post(`/${accountId}/auth/change-password`, data);
        return response.data;
    }

    async setupTwoFactor(accountId: string, data: TwoFactorSetupRequest): Promise<TwoFactorSetupResponse> {
        const response = await this.http.post(`/${accountId}/auth/setup-two-factor`, data);
        return response.data;
    }

    async verifyTwoFactorSetup(accountId: string, token: string): Promise<{ message: string }> {
        const response = await this.http.post(`/${accountId}/auth/verify-two-factor-setup`, { token });
        return response.data;
    }

    async generateBackupCodes(accountId: string, password: string): Promise<{ backupCodes: string[] }> {
        const response = await this.http.post(`/${accountId}/auth/generate-backup-codes`, { password });
        return response.data;
    }

    // OAuth Authentication
    redirectToOAuthSignup(provider: string, redirectUrl?: string): void {
        const params = new URLSearchParams();
        if (redirectUrl) params.append('redirectUrl', redirectUrl);
        
        window.location.href = `/oauth/signup/${provider}?${params.toString()}`;
    }

    redirectToOAuthSignin(provider: string, redirectUrl?: string): void {
        const params = new URLSearchParams();
        if (redirectUrl) params.append('redirectUrl', redirectUrl);
        
        window.location.href = `/oauth/signin/${provider}?${params.toString()}`;
    }

    requestGooglePermission(accountId: string, scopeNames: string[], redirectUrl?: string): void {
        const params = new URLSearchParams();
        params.append('accountId', accountId);
        if (redirectUrl) params.append('redirectUrl', redirectUrl);
        
        const scopes = Array.isArray(scopeNames) ? scopeNames.join(',') : scopeNames;
        window.location.href = `/oauth/permission/${scopes}?${params.toString()}`;
    }

    reauthorizePermissions(accountId: string, redirectUrl?: string): void {
        const params = new URLSearchParams();
        params.append('accountId', accountId);
        if (redirectUrl) params.append('redirectUrl', redirectUrl);
        
        window.location.href = `/oauth/permission/reauthorize?${params.toString()}`;
    }

    // Google API
    async getGoogleTokenInfo(accountId: string): Promise<any> {
        const response = await this.http.get(`/${accountId}/google/token`);
        return response.data;
    }

    async checkGoogleScopes(accountId: string, scopeNames: string[]): Promise<TokenCheckResponse> {
        const params = new URLSearchParams();
        params.append('scopes', JSON.stringify(scopeNames));
        
        const response = await this.http.get(`/${accountId}/google/token/check?${params.toString()}`);
        return response.data;
    }

    // Notifications
    async getNotifications(
        accountId: string, 
        options?: {
            read?: boolean;
            type?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<NotificationListResponse> {
        const params = new URLSearchParams();
        if (options?.read !== undefined) params.append('read', options.read.toString());
        if (options?.type) params.append('type', options.type);
        if (options?.limit) params.append('limit', options.limit.toString());
        if (options?.offset) params.append('offset', options.offset.toString());
        
        const response = await this.http.get(`/${accountId}/notifications?${params.toString()}`);
        return response.data;
    }

    async getUnreadCount(accountId: string): Promise<{ unreadCount: number }> {
        const response = await this.http.get(`/${accountId}/notifications/unread`);
        return response.data;
    }

    async createNotification(accountId: string, notification: CreateNotificationRequest): Promise<Notification> {
        const response = await this.http.post(`/${accountId}/notifications`, notification);
        return response.data;
    }

    async markNotificationAsRead(accountId: string, notificationId: string): Promise<Notification> {
        const response = await this.http.patch(`/${accountId}/notifications/${notificationId}/read`);
        return response.data;
    }

    async markAllNotificationsAsRead(accountId: string): Promise<{ modifiedCount: number }> {
        const response = await this.http.patch(`/${accountId}/notifications/read-all`);
        return response.data;
    }

    async updateNotification(
        accountId: string, 
        notificationId: string, 
        updates: Partial<Notification>
    ): Promise<Notification> {
        const response = await this.http.patch(`/${accountId}/notifications/${notificationId}`, updates);
        return response.data;
    }

    async deleteNotification(accountId: string, notificationId: string): Promise<{ success: boolean }> {
        const response = await this.http.delete(`/${accountId}/notifications/${notificationId}`);
        return response.data;
    }

    async deleteAllNotifications(accountId: string): Promise<{ deletedCount: number }> {
        const response = await this.http.delete(`/${accountId}/notifications`);
        return response.data;
    }
}