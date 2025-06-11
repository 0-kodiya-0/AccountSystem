/**
 * Google OAuth configuration without local scope validation
 *
 * This implementation removes local scope validation and lets Google OAuth API
 * handle scope validation directly. This approach is better because:
 * 1. Google is the authoritative source for valid scopes
 * 2. Scopes change over time - Google adds new scopes and deprecates old ones
 * 3. Local validation can become outdated and block valid scopes
 * 4. Google provides clear error responses for invalid scopes
 * 5. Simpler maintenance - no need to keep updating scope definitions
 */

/**
 * Google OAuth scope URL builder
 * Automatically constructs proper Google scope URLs from scope names
 */
export const GOOGLE_SCOPE_BASE_URL = "https://www.googleapis.com/auth/";

/**
 * Special scopes that don't follow the standard pattern
 * Only keeping the absolutely necessary OpenID Connect scopes
 */
export const SPECIAL_SCOPES = {
  openid: "openid",
  email: "https://www.googleapis.com/auth/userinfo.email",
  profile: "https://www.googleapis.com/auth/userinfo.profile",
} as const;

/**
 * Build Google OAuth scope URL from scope name
 * @param scopeName The scope name (e.g., 'gmail.readonly', 'calendar.events')
 * @returns Full Google OAuth scope URL
 */
export function buildGoogleScopeUrl(scopeName: string): string {
  // Handle special scopes that don't follow the standard pattern
  if (scopeName in SPECIAL_SCOPES) {
    return SPECIAL_SCOPES[scopeName as keyof typeof SPECIAL_SCOPES];
  }

  // If it's already a full URL, return as-is
  if (scopeName.startsWith("https://") || scopeName.startsWith("http://")) {
    return scopeName;
  }

  // Build standard Google scope URL
  return `${GOOGLE_SCOPE_BASE_URL}${scopeName}`;
}

/**
 * Build multiple Google OAuth scope URLs from scope names
 * @param scopeNames Array of scope names
 * @returns Array of full Google OAuth scope URLs
 */
export function buildGoogleScopeUrls(scopeNames: string[]): string[] {
  return scopeNames.map(buildGoogleScopeUrl);
}

/**
 * Validate basic scope name format
 * @param scopeName The scope name to validate
 * @returns True if the scope name is valid
 */
export function isValidScopeName(scopeName: string): boolean {
  if (!scopeName || typeof scopeName !== "string") {
    return false;
  }

  const trimmed = scopeName.trim();

  // Empty string is invalid
  if (trimmed.length === 0) {
    return false;
  }

  // If it's already a URL, just check it's well-formed
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    try {
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  // For scope names, allow alphanumeric, dots, and underscores
  return /^[a-zA-Z0-9._-]+$/.test(trimmed);
}

/**
 * Validate an array of scope names
 * @param scopeNames Array of scope names to validate
 * @returns Validation result with errors if any
 */
export function validateScopeNames(scopeNames: string[]): {
  valid: boolean;
  errors: string[];
} {
  if (!Array.isArray(scopeNames)) {
    return { valid: false, errors: ["Scope names must be an array"] };
  }

  if (scopeNames.length === 0) {
    return { valid: false, errors: ["At least one scope name is required"] };
  }

  const errors: string[] = [];

  scopeNames.forEach((scopeName, index) => {
    if (!isValidScopeName(scopeName)) {
      errors.push(`Invalid scope name at index ${index}: "${scopeName}"`);
    }
  });

  return { valid: errors.length === 0, errors };
}
