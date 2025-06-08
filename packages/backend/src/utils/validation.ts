import mongoose from 'mongoose';
import { BadRequestError, ValidationError, ApiErrorCode } from '../types/response.types';

/**
 * Centralized validation utilities to eliminate duplicate validation patterns
 */
export class ValidationUtils {
    /**
     * Validate MongoDB ObjectId format
     */
    static validateObjectId(id: string, fieldName: string = 'ID'): void {
        if (!id) {
            throw new BadRequestError(`${fieldName} is required`);
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new BadRequestError(`Invalid ${fieldName} format`);
        }
    }

    /**
     * Validate email format
     */
    static validateEmail(email: string): void {
        if (!email) {
            throw new ValidationError('Email is required', 400, ApiErrorCode.VALIDATION_ERROR);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new ValidationError('Invalid email format', 400, ApiErrorCode.VALIDATION_ERROR);
        }
    }

    /**
     * Validate password strength
     */
    static validatePasswordStrength(password: string): void {
        if (!password) {
            throw new ValidationError('Password is required', 400, ApiErrorCode.VALIDATION_ERROR);
        }

        // At least 8 characters
        if (password.length < 8) {
            throw new ValidationError(
                'Password must be at least 8 characters long',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        // At least one uppercase letter
        if (!/[A-Z]/.test(password)) {
            throw new ValidationError(
                'Password must contain at least one uppercase letter',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        // At least one lowercase letter
        if (!/[a-z]/.test(password)) {
            throw new ValidationError(
                'Password must contain at least one lowercase letter',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        // At least one number
        if (!/[0-9]/.test(password)) {
            throw new ValidationError(
                'Password must contain at least one number',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        // At least one special character
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            throw new ValidationError(
                'Password must contain at least one special character',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }
    }

    /**
     * Validate required fields in an object
     */
    static validateRequiredFields(obj: Record<string, any>, fields: string[]): void {
        const missingFields = fields.filter(field => !obj[field]);

        if (missingFields.length > 0) {
            throw new BadRequestError(
                `Missing required fields: ${missingFields.join(', ')}`,
                400,
                ApiErrorCode.MISSING_DATA
            );
        }
    }

    /**
     * Validate query parameters for pagination
     */
    static validatePaginationParams(params: { limit?: string; offset?: string }) {
        const result = { limit: 50, offset: 0 };

        if (params.limit) {
            const limit = parseInt(params.limit);
            if (isNaN(limit) || limit < 1 || limit > 100) {
                throw new ValidationError(
                    'Limit must be between 1 and 100',
                    400,
                    ApiErrorCode.VALIDATION_ERROR
                );
            }
            result.limit = limit;
        }

        if (params.offset) {
            const offset = parseInt(params.offset);
            if (isNaN(offset) || offset < 0) {
                throw new ValidationError(
                    'Offset must be a non-negative number',
                    400,
                    ApiErrorCode.VALIDATION_ERROR
                );
            }
            result.offset = offset;
        }

        return result;
    }

    /**
     * Validate timestamp format
     */
    static validateTimestamp(timestamp: string, fieldName: string = 'timestamp'): Date {
        if (!timestamp) {
            throw new BadRequestError(`${fieldName} is required`);
        }

        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            throw new ValidationError(
                `Invalid ${fieldName} format`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        return date;
    }

    /**
     * Validate string length
     */
    static validateStringLength(
        value: string,
        fieldName: string,
        minLength?: number,
        maxLength?: number
    ): void {
        if (!value) {
            throw new BadRequestError(`${fieldName} is required`);
        }

        if (minLength !== undefined && value.length < minLength) {
            throw new ValidationError(
                `${fieldName} must be at least ${minLength} characters`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        if (maxLength !== undefined && value.length > maxLength) {
            throw new ValidationError(
                `${fieldName} cannot exceed ${maxLength} characters`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }
    }

    /**
     * Validate array and its contents
     */
    static validateArray<T>(
        arr: T[],
        fieldName: string,
        minLength?: number,
        maxLength?: number,
        validator?: (item: T) => void
    ): void {
        if (!Array.isArray(arr)) {
            throw new ValidationError(
                `${fieldName} must be an array`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        if (minLength !== undefined && arr.length < minLength) {
            throw new ValidationError(
                `${fieldName} must contain at least ${minLength} items`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        if (maxLength !== undefined && arr.length > maxLength) {
            throw new ValidationError(
                `${fieldName} cannot contain more than ${maxLength} items`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        if (validator) {
            arr.forEach((item, index) => {
                try {
                    validator(item);
                } catch (error) {
                    throw new ValidationError(
                        `Invalid item at index ${index} in ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        400,
                        ApiErrorCode.VALIDATION_ERROR
                    );
                }
            });
        }
    }

    /**
     * Validate enum value
     */
    static validateEnum<T>(
        value: string,
        enumObject: Record<string, T>,
        fieldName: string
    ): T {
        if (!value) {
            throw new BadRequestError(`${fieldName} is required`);
        }

        const enumValues = Object.values(enumObject);
        if (!enumValues.includes(value as T)) {
            throw new ValidationError(
                `Invalid ${fieldName}. Must be one of: ${enumValues.join(', ')}`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        return value as T;
    }

    /**
     * Validate URL format
     */
    static validateUrl(url: string, fieldName: string = 'URL'): void {
        if (!url) {
            throw new BadRequestError(`${fieldName} is required`);
        }

        try {
            new URL(url);
        } catch {
            throw new ValidationError(
                `Invalid ${fieldName} format`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }
    }

    /**
     * Sanitize and validate search query
     */
    static validateSearchQuery(query: string, maxLength: number = 100): string {
        if (!query) {
            throw new BadRequestError('Search query is required');
        }

        // Remove excessive whitespace and trim
        const sanitized = query.trim().replace(/\s+/g, ' ');

        if (sanitized.length === 0) {
            throw new ValidationError(
                'Search query cannot be empty',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        if (sanitized.length > maxLength) {
            throw new ValidationError(
                `Search query cannot exceed ${maxLength} characters`,
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }

        return sanitized;
    }

    /**
     * Validate access token format and presence
     */
    static validateAccessToken(accessToken: string, context: string = 'operation'): void {
        if (!accessToken) {
            throw new BadRequestError(`Access token is required for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        if (typeof accessToken !== 'string') {
            throw new BadRequestError(`Access token must be a string for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        const trimmedToken = accessToken.trim();
        if (trimmedToken.length === 0) {
            throw new BadRequestError(`Access token cannot be empty for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        // Basic format validation - OAuth access tokens are typically long strings
        if (trimmedToken.length < 10) {
            throw new BadRequestError(`Invalid access token format for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }
    }

    /**
     * Validate refresh token format and presence
     */
    static validateRefreshToken(refreshToken: string, context: string = 'operation'): void {
        if (!refreshToken) {
            throw new BadRequestError(`Refresh token is required for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        if (typeof refreshToken !== 'string') {
            throw new BadRequestError(`Refresh token must be a string for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        const trimmedToken = refreshToken.trim();
        if (trimmedToken.length === 0) {
            throw new BadRequestError(`Refresh token cannot be empty for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        // Basic format validation
        if (trimmedToken.length < 10) {
            throw new BadRequestError(`Invalid refresh token format for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }
    }

    /**
     * Validate scope URL format and presence
     */
    static validateScopeUrl(scope: string, context: string = 'operation'): void {
        if (!scope) {
            throw new BadRequestError(`Scope is required for ${context}`, 400, ApiErrorCode.MISSING_DATA);
        }

        if (typeof scope !== 'string') {
            throw new BadRequestError(`Scope must be a string for ${context}`, 400, ApiErrorCode.VALIDATION_ERROR);
        }

        const trimmedScope = scope.trim();
        if (trimmedScope.length === 0) {
            throw new BadRequestError(`Scope cannot be empty for ${context}`, 400, ApiErrorCode.VALIDATION_ERROR);
        }

        // Basic format validation for OAuth scope URLs
        if (trimmedScope.length < 3) {
            throw new BadRequestError(`Invalid scope format for ${context}`, 400, ApiErrorCode.VALIDATION_ERROR);
        }
    }

    /**
     * Validate JWT token format and presence (generic for any JWT)
     */
    static validateJwtToken(token: string, tokenType: string = 'JWT token', context: string = 'operation'): void {
        if (!token) {
            throw new BadRequestError(`${tokenType} is required for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        if (typeof token !== 'string') {
            throw new BadRequestError(`${tokenType} must be a string for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        const trimmedToken = token.trim();
        if (trimmedToken.length === 0) {
            throw new BadRequestError(`${tokenType} cannot be empty for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        // Basic JWT format validation (should have 3 parts separated by dots)
        const parts = trimmedToken.split('.');
        if (parts.length !== 3) {
            throw new BadRequestError(`Invalid ${tokenType} format for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }

        // Each part should be non-empty
        if (parts.some(part => part.length === 0)) {
            throw new BadRequestError(`Invalid ${tokenType} structure for ${context}`, 400, ApiErrorCode.TOKEN_INVALID);
        }
    }

    /**
     * Enhanced validateObjectId with context
     */
    static validateObjectIdWithContext(id: string, fieldName: string = 'ID', context: string = 'operation'): void {
        if (!id) {
            throw new BadRequestError(`${fieldName} is required for ${context}`, 400, ApiErrorCode.MISSING_DATA);
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new BadRequestError(`Invalid ${fieldName} format for ${context}`, 400, ApiErrorCode.VALIDATION_ERROR);
        }
    }
}