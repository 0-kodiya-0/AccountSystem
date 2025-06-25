import { SDKConfig } from '../../../../packages/sdk/auth-react-sdk/src'; // Replace with your actual package name

// Auth SDK configuration
export const authConfig: SDKConfig = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:7000',
  timeout: 30000,
  withCredentials: true,
  backendProxyUrl: '/api/v1/account', // API prefix for backend
};

// Auth service URL for direct calls (if needed)
export const authServiceUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || '/account';

// Application routes
export const routes = {
  home: '/',
  dashboard: '/dashboard',
  auth: '/auth',
  login: `${authServiceUrl}/login`,
  signup: `${authServiceUrl}/signup`,
  accountSelection: `${authServiceUrl}/accounts`,
} as const;

// Auth configuration validation
function validateAuthConfig() {
  if (!authConfig.backendUrl) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL is required');
  }

  try {
    new URL(authConfig.backendUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_BACKEND_URL must be a valid URL');
  }

  console.log('✅ Auth configuration validated:', {
    backendUrl: authConfig.backendUrl,
    authServiceUrl,
    withCredentials: authConfig.withCredentials,
  });
}

// Validate on import
validateAuthConfig();

export default authConfig;
