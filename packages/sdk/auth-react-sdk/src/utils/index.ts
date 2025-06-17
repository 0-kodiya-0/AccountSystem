import { ApiErrorCode, AuthSDKError, LoadingState } from '../types';

/**
 * Parse error from any source into AuthSDKError
 */
export function parseApiError(error: any, context?: string): AuthSDKError {
  // Already an AuthSDKError
  if (error instanceof AuthSDKError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    return new AuthSDKError(context ? `${context}: ${error.message}` : error.message, ApiErrorCode.UNKNOWN_ERROR);
  }

  // HTTP Response error
  if (error?.response) {
    const statusCode = error.response.status;
    const responseData = error.response.data;

    return AuthSDKError.fromApiResponse(responseData, statusCode);
  }

  // Network error
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('network')) {
    return new AuthSDKError('Network connection failed', ApiErrorCode.NETWORK_ERROR);
  }

  // Timeout error
  if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout')) {
    return new AuthSDKError('Request timed out', ApiErrorCode.TIMEOUT_ERROR);
  }

  // Generic object with error info
  if (typeof error === 'object' && error?.message) {
    return new AuthSDKError(error.message, error.code || ApiErrorCode.UNKNOWN_ERROR, error.statusCode);
  }

  // String error
  if (typeof error === 'string') {
    return new AuthSDKError(context ? `${context}: ${error}` : error, ApiErrorCode.UNKNOWN_ERROR);
  }

  // Unknown error type
  return new AuthSDKError(
    context ? `${context}: Unknown error occurred` : 'Unknown error occurred',
    ApiErrorCode.UNKNOWN_ERROR,
  );
}

/**
 * Check if error indicates user should retry
 */
export function shouldRetryError(error: AuthSDKError): boolean {
  return error.isRetryable();
}

/**
 * Get retry delay based on error type
 */
export function getRetryDelay(error: AuthSDKError, attempt: number): number {
  if (!error.isRetryable()) return 0;

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  return Math.min(1000 * Math.pow(2, attempt), 16000);
}

// Status helper functions
export const getStatusHelpers = (status: LoadingState) => ({
  isLoading: status === 'loading',
  isUpdating: status === 'updating',
  isSaving: status === 'saving',
  isDeleting: status === 'deleting',
  isIdle: status === 'idle',
  hasError: status === 'error',
  isSuccess: status === 'success',
});
