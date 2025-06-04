import { ApiErrorCode } from "../types";

// Response utility functions (adapted from backend)
export interface ErrorResponse {
    success: false;
    error: {
        code: ApiErrorCode;
        message: string;
        data?: any;
    };
}

export interface SuccessResponse<T = any> {
    success: true;
    data: T;
}

export const createErrorResponse = (
    code: ApiErrorCode,
    message: string,
    data?: any
): ErrorResponse => ({
    success: false,
    error: {
        code,
        message,
        ...(data && { data })
    }
});

export const createSuccessResponse = <T>(data: T): SuccessResponse<T> => ({
    success: true,
    data
});

// URL utility function (simplified from backend)
export function removeRootUrl(url: string): string {
    const segments = url.split('/').filter(segment => segment);
    segments.shift(); // Remove root segment

    // Handle query parameters manually
    const queryIndex = url.indexOf('?');
    const queryString = queryIndex !== -1 ? url.substring(queryIndex) : '';

    return '/' + segments.join('/') + queryString;
}