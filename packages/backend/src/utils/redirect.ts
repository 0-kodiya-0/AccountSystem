import { Response, Request } from "express";
import { ApiErrorCode } from "../types/response.types";
import * as path from "path";
import { logger } from "./logger";

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
 */
function getStrippedPathPrefix(req: Request): string {
    // First check if X-Path-Prefix header exists
    const headerPrefix = req.get('X-Path-Prefix');
    if (headerPrefix) {
        return headerPrefix;
    }

    return '';
}

/**
 * Creates a redirect URL with proper parameters and relative path handling
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
            logger.error('Error parsing absolute URL:', error);
            finalUrl = baseUrl;
        }
    } else {
        // For relative URLs, handle based on relative path notation
        baseUrl = decodeURIComponent(baseUrl);

        // Extract any existing query parameters from original baseUrl
        const queryIndex = baseUrl.indexOf('?');
        let cleanPath = baseUrl;
        if (queryIndex !== -1) {
            cleanPath = baseUrl.substring(0, queryIndex);
            const queryString = baseUrl.substring(queryIndex + 1);
            new URLSearchParams(queryString).forEach((value, key) => {
                queryParams.append(key, value);
            });
        }

        // Handle relative path notation
        if (cleanPath.startsWith('../')) {
            // ../ means: pathPrefix + parent paths + target path
            const targetPath = cleanPath.substring(3); // Remove '../'
            
            // Use the parentUrl set by middleware
            const parentPath = req.parentUrl || '';
            
            console.log('Parent URL from middleware:', parentPath);
            console.log('Target path:', targetPath);
            
            // Combine: pathPrefix + parentPath + targetPath
            if (pathPrefix) {
                finalUrl = path.normalize(pathPrefix + parentPath + '/' + targetPath).replace(/\/+/g, '/');
            } else {
                finalUrl = path.normalize(parentPath + '/' + targetPath).replace(/\/+/g, '/');
            }
            
            console.log('Final URL:', finalUrl);
        } else if (cleanPath.startsWith('./')) {
            // ./ means: add only pathPrefix + target path
            const targetPath = cleanPath.substring(2); // Remove './'
            
            if (pathPrefix) {
                finalUrl = path.normalize(pathPrefix + '/' + targetPath).replace(/\/+/g, '/');
            } else {
                finalUrl = '/' + targetPath;
            }
        } else {
            finalUrl = cleanPath;
            
            // Ensure it starts with /
            if (!finalUrl.startsWith('/')) {
                finalUrl = '/' + finalUrl;
            }

            console.log(finalUrl)
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
        queryParams.append('redirectUrl', encodeURIComponent(originalUrl));
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