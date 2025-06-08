import { Request } from "express";
import * as path from "path";
import { logger } from "./logger";
import { getProxyUrl } from "../config/env.config";

/**
 * Get the path prefix that was stripped by the proxy
 */
export function getStrippedPathPrefix(req: Request): string {
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
    data?: Record<string, any>,
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
        }
    }

    // Add data for success
    if (data) {
        if (typeof data === "object" && data !== null) {
            Object.keys(data).forEach(key => {
                const value = data![key];
                queryParams.append(key, encodeURIComponent(value));
            });
        } else {
            queryParams.append('data', encodeURIComponent(JSON.stringify(data)));
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
 * Build unified callback URL with code and data
 */
export function getCallbackUrl(): string {
    return `${getProxyUrl()}/auth/callback`;
}