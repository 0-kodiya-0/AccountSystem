import { Response, Request } from "express";
import { ApiErrorCode } from "../types/response.types";
import * as path from "path";

// Redirect types
export enum RedirectType {
    SUCCESS = 'success',
    ERROR = 'error',
    PERMISSION = 'permission'
}

// Interface for redirect options
export interface RedirectOptions {
    type: RedirectType;
    code?: ApiErrorCode;
    message?: string;
    data?: Record<string, any>;
    sendStatus?: boolean;
}

/**
 * Get the path prefix that was stripped by the proxy
 * @param req Express request object
 * @returns The stripped path prefix (e.g., "/api")
 */
function getStrippedPathPrefix(req: Request): string {
    // First check if X-Path-Prefix header exists
    const headerPrefix = req.get('X-Path-Prefix');
    if (headerPrefix) {
        return headerPrefix;
    }

    // Fallback: calculate from original URL vs current URL
    const originalUrl = req.originalUrl || req.url;
    const currentUrl = req.url;

    // Parse URLs to get just the path (no query params)
    const originalPath = originalUrl.split('?')[0];
    const currentPath = currentUrl.split('?')[0];

    // If originalPath ends with currentPath, the difference is the stripped prefix
    if (originalPath.endsWith(currentPath) && originalPath !== currentPath) {
        const strippedPrefix = originalPath.substring(0, originalPath.length - currentPath.length);
        // Remove trailing slash if present
        return strippedPrefix.endsWith('/') ? strippedPrefix.slice(0, -1) : strippedPrefix;
    }

    return '';
}

/**
 * Creates a redirect URL with proper parameters and smart path prefix handling
 */
export const createRedirectUrl = (
    req: Request,
    baseUrl: string,
    options: RedirectOptions,
    originalUrl?: string
): string => {
    let finalUrl = '';
    const queryParams = new URLSearchParams();

    // Get the path prefix that was stripped by proxy
    const pathPrefix = getStrippedPathPrefix(req);

    // Check if it's an absolute URL (starts with http:// or https://)
    const isAbsoluteUrl = baseUrl.startsWith('http://') || baseUrl.startsWith('https://');

    if (isAbsoluteUrl) {
        // For absolute URLs, use as-is
        try {
            const urlObj = new URL(baseUrl);
            finalUrl = urlObj.origin + urlObj.pathname;

            // Copy existing query parameters if any
            urlObj.searchParams.forEach((value, key) => {
                queryParams.append(key, value);
            });
        } catch (error) {
            console.error('Error parsing absolute URL:', error);
            finalUrl = baseUrl;
        }
    } else {
        // For relative URLs, clean them up and add path prefix
        baseUrl = decodeURIComponent(baseUrl);

        // Normalize the path and remove any query parameters
        let cleanPath = path.normalize(baseUrl).split('?')[0];

        // Remove any leading "./" or "../" patterns - we don't want relative navigation
        cleanPath = cleanPath.replace(/^(\.\.?\/)+/, '');

        // Ensure path starts with /
        if (!cleanPath.startsWith('/')) {
            cleanPath = '/' + cleanPath;
        }

        // Add path prefix if it exists and isn't already present
        if (pathPrefix && !cleanPath.startsWith(pathPrefix)) {
            cleanPath = pathPrefix + cleanPath;
        }

        finalUrl = cleanPath;

        // Extract any existing query parameters from original baseUrl
        const queryIndex = baseUrl.indexOf('?');
        if (queryIndex !== -1) {
            const queryString = baseUrl.substring(queryIndex + 1);
            new URLSearchParams(queryString).forEach((value, key) => {
                queryParams.append(key, value);
            });
        }
    }

    // Add status parameter
    if (options.sendStatus !== false) {
        queryParams.append('status', options.type);
    }

    // Add code and message for errors
    if (options.code) {
        queryParams.append('errorCode', options.code);

        if (options.message) {
            queryParams.append('errorMessage', encodeURIComponent(options.message));
        }
    }

    // Add data for success
    if (options.data) {
        if (typeof options.data === "object" && options.data !== null) {
            Object.keys(options.data).forEach(key => {
                const value = options.data![key];
                queryParams.append(key, encodeURIComponent(value));
            });
        } else {
            queryParams.append('data', encodeURIComponent(JSON.stringify(options.data)));
        }
    }

    // For permission redirects, include original URL (cleaned)
    if (originalUrl) {
        // Clean the original URL too
        let cleanOriginalUrl = originalUrl.replace(/^(\.\.?\/)+/, '');
        if (pathPrefix && !cleanOriginalUrl.startsWith(pathPrefix)) {
            cleanOriginalUrl = pathPrefix + cleanOriginalUrl;
        }
        queryParams.append('redirectUrl', encodeURIComponent(cleanOriginalUrl));
    }

    // Construct the final URL with query parameters
    const queryString = queryParams.toString();
    if (queryString) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
    }

    return finalUrl;
};

/**
 * Handle redirects with proper status and parameters
 */
export const handleRedirect = (
    req: Request,
    res: Response,
    baseUrl: string,
    options: RedirectOptions,
    originalUrl?: string
): void => {
    const redirectUrl = createRedirectUrl(req, baseUrl, options, originalUrl);
    res.redirect(redirectUrl);
};

/**
 * Redirect on success
 */
export const redirectWithSuccess = (
    req: Request,
    res: Response,
    path: string,
    options: {
        originalUrl?: string,
        message?: string,
        data?: Record<string, any>,
        sendStatus?: boolean
    }
): void => {
    handleRedirect(req, res, path, {
        type: RedirectType.SUCCESS,
        ...options
    }, options.originalUrl);
};

/**
 * Redirect on error
 */
export const redirectWithError = (
    req: Request,
    res: Response,
    path: string,
    code: ApiErrorCode,
    options: {
        originalUrl?: string,
        message?: string,
        data?: Record<string, any>,
        sendStatus?: boolean
    }
): void => {
    handleRedirect(req, res, path, {
        type: RedirectType.ERROR,
        code,
        ...options
    }, options.originalUrl);
};

/**
 * Extract frontend redirect URL from request query parameters
 * With fallback to default URL and smart path prefix handling
 */
export const getRedirectUrl = (req: Request, defaultUrl: string): string => {
    const redirectUrl = req.query.redirectUrl as string;
    const pathPrefix = getStrippedPathPrefix(req);

    // Validate the URL to prevent open redirects
    if (redirectUrl) {
        // Clean up any relative navigation patterns
        let cleanUrl = redirectUrl.replace(/^(\.\.?\/)+/, '');

        // If it's a relative URL, add path prefix if needed
        if (cleanUrl.startsWith('/') && pathPrefix && !cleanUrl.startsWith(pathPrefix)) {
            cleanUrl = pathPrefix + cleanUrl;
        }

        // Basic validation for relative URLs
        if (cleanUrl.startsWith('/')) {
            return cleanUrl;
        }
    }

    // Apply path prefix to default URL if needed
    let finalDefaultUrl = defaultUrl;
    if (pathPrefix && !finalDefaultUrl.startsWith(pathPrefix) && finalDefaultUrl.startsWith('/')) {
        finalDefaultUrl = pathPrefix + finalDefaultUrl;
    }

    return finalDefaultUrl;
};