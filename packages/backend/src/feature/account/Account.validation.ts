import { AccountValidationError } from '../../types/response.types';
import { UserDetails, Account, AccountType, AccountStatus, OAuthProviders, SecuritySettings } from './Account.types';

export function validateUserDetails(obj?: Partial<UserDetails>): obj is UserDetails {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    (obj.email === undefined || typeof obj.email === 'string') &&
    (obj.imageUrl === undefined || typeof obj.imageUrl === 'string') &&
    (obj.username === undefined || typeof obj.username === 'string') &&
    (obj.firstName === undefined || typeof obj.firstName === 'string') &&
    (obj.lastName === undefined || typeof obj.lastName === 'string') &&
    (obj.birthdate === undefined || typeof obj.birthdate === 'string') &&
    (obj.emailVerified === undefined || typeof obj.emailVerified === 'boolean')
  );
}

export function validateSecuritySettings(
  obj?: Partial<SecuritySettings>,
  accountType?: AccountType,
): obj is SecuritySettings {
  if (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.twoFactorEnabled === 'boolean' &&
    typeof obj.sessionTimeout === 'number' &&
    typeof obj.autoLock === 'boolean'
  ) {
    // For local accounts, password is required
    if (accountType === AccountType.Local && !obj.password) {
      throw new AccountValidationError('Local accounts must have a password');
    }

    // For OAuth accounts, password should not be present
    if (accountType === AccountType.OAuth && obj.password) {
      throw new AccountValidationError('OAuth accounts should not have a password');
    }

    return true;
  }

  throw new AccountValidationError('Invalid SecuritySettings object');
}

export function validateAccount(obj?: Omit<Partial<Account>, 'id'>): obj is Omit<Account, 'id'> {
  if (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.created === 'string' &&
    typeof obj.updated === 'string' &&
    obj.accountType &&
    Object.values(AccountType).includes(obj.accountType) &&
    obj.status &&
    Object.values(AccountStatus).includes(obj.status) &&
    validateUserDetails(obj.userDetails) &&
    validateSecuritySettings(obj.security, obj.accountType)
  ) {
    // Validate OAuth accounts have provider
    if (obj.accountType === AccountType.OAuth && !obj.provider) {
      throw new AccountValidationError('OAuth accounts must have a provider');
    }

    // Validate provider is valid
    if (obj.provider && !Object.values(OAuthProviders).includes(obj.provider)) {
      throw new AccountValidationError('Invalid OAuth provider');
    }

    // Validate local accounts don't have provider
    if (obj.accountType === AccountType.Local && obj.provider) {
      throw new AccountValidationError('Local accounts should not have a provider');
    }

    return true;
  }

  throw new AccountValidationError('Invalid Account object');
}
