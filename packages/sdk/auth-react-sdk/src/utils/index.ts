import { ServiceType, ScopeLevel } from '../types';

/**
 * Get valid scopes for a Google service
 */
export const getValidScopesForService = (service: ServiceType): ScopeLevel[] => {
    switch (service) {
        case 'gmail':
            return ['readonly', 'send', 'compose', 'full'];
        case 'calendar':
            return ['readonly', 'events', 'full'];
        case 'drive':
            return ['readonly', 'file', 'full'];
        case 'sheets':
        case 'docs':
            return ['readonly', 'create', 'edit', 'full'];
        case 'people':
            return ['readonly', 'full'];
        case 'meet':
            return ['readonly', 'full'];
        default:
            return ['readonly', 'full'];
    }
};

/**
 * Build Google OAuth scope URLs from scope names
 */
export const buildGoogleScopeUrls = (scopeNames: string[]): string[] => {
    const GOOGLE_SCOPE_BASE_URL = 'https://www.googleapis.com/auth/';
    const SPECIAL_SCOPES = {
        'openid': 'openid',
        'email': 'https://www.googleapis.com/auth/userinfo.email',
        'profile': 'https://www.googleapis.com/auth/userinfo.profile',
    };

    return scopeNames.map(scopeName => {
        // Handle special scopes
        if (scopeName in SPECIAL_SCOPES) {
            return SPECIAL_SCOPES[scopeName as keyof typeof SPECIAL_SCOPES];
        }
        
        // If it's already a full URL, return as-is
        if (scopeName.startsWith('https://') || scopeName.startsWith('http://')) {
            return scopeName;
        }
        
        // Build standard Google scope URL
        return `${GOOGLE_SCOPE_BASE_URL}${scopeName}`;
    });
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password: string): {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'fair' | 'strong';
} => {
    const errors: string[] = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    const isValid = errors.length === 0;
    let strength: 'weak' | 'fair' | 'strong' = 'weak';
    
    if (errors.length <= 1) {
        strength = 'strong';
    } else if (errors.length <= 2) {
        strength = 'fair';
    }
    
    return { isValid, errors, strength };
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Format account name for display
 */
export const formatAccountName = (firstName?: string, lastName?: string, name?: string): string => {
    if (firstName && lastName) {
        return `${firstName} ${lastName}`;
    }
    return name || 'Unknown User';
};

/**
 * Get account initials for avatar
 */
export const getAccountInitials = (name: string): string => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
};

/**
 * Format notification timestamp
 */
export const formatNotificationTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) {
        return 'Just now';
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else if (days < 7) {
        return `${days}d ago`;
    } else {
        return new Date(timestamp).toLocaleDateString();
    }
};