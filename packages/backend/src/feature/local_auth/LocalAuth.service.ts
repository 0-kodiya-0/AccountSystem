import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { 
    AccountStatus, 
    AccountType, 
    Account, 
    SignupRequest, 
    LocalAuthRequest,
    PasswordResetRequest,
    PasswordChangeRequest,
    SetupTwoFactorRequest
} from '../account/Account.types';
import db from '../../config/db';
import { BadRequestError, NotFoundError, ValidationError, ApiErrorCode } from '../../types/response.types';
import { toSafeAccount } from '../account/Account.utils';
import { sendPasswordResetEmail, sendVerificationEmail, sendPasswordChangedNotification } from '../email/Email.service';
import { authenticator } from 'otplib';
import { ValidationUtils } from '../../utils/validation';
import { 
    saveEmailVerificationToken, 
    getEmailVerificationToken, 
    removeEmailVerificationToken,
    getPasswordResetToken,
    removePasswordResetToken,
    saveTwoFactorTempToken,
    getTwoFactorTempToken,
    markTwoFactorTempTokenAsUsed,
    removeTwoFactorTempToken
} from './LocalAuth.cache';
import { getAppName } from '../../config/env.config';

/**
 * Create a new local account
 */
export async function createLocalAccount(signupData: SignupRequest): Promise<Account> {
    const models = await db.getModels();
    
    // Use ValidationUtils for validation
    ValidationUtils.validateRequiredFields(signupData, ['firstName', 'lastName', 'email', 'password']);
    ValidationUtils.validateEmail(signupData.email);
    ValidationUtils.validatePasswordStrength(signupData.password);
    ValidationUtils.validateStringLength(signupData.firstName, 'First name', 1, 50);
    ValidationUtils.validateStringLength(signupData.lastName, 'Last name', 1, 50);
    
    if (signupData.username) {
        ValidationUtils.validateStringLength(signupData.username, 'Username', 3, 30);
    }
    
    // Check if email already exists
    const existingAccount = await models.accounts.Account.findOne({
        'userDetails.email': signupData.email
    });
    
    if (existingAccount) {
        throw new BadRequestError('Email already in use', 400, ApiErrorCode.USER_EXISTS);
    }
    
    // Check if username exists (if provided)
    if (signupData.username) {
        const usernameExists = await models.accounts.Account.findOne({
            'userDetails.username': signupData.username
        });
        
        if (usernameExists) {
            throw new BadRequestError('Username already in use', 400, ApiErrorCode.USER_EXISTS);
        }
    }
    
    // Create account with validated fields
    const timestamp = new Date().toISOString();
    
    const newAccount = await models.accounts.Account.create({
        created: timestamp,
        updated: timestamp,
        accountType: AccountType.Local,
        status: AccountStatus.Unverified, // Start as unverified
        userDetails: {
            firstName: signupData.firstName,
            lastName: signupData.lastName,
            name: `${signupData.firstName} ${signupData.lastName}`,
            email: signupData.email,
            username: signupData.username,
            birthdate: signupData.birthdate,
            emailVerified: false
        },
        security: {
            password: signupData.password, // Will be hashed by the model's pre-save hook
            twoFactorEnabled: false,
            sessionTimeout: 3600,
            autoLock: false,
            failedLoginAttempts: 0
        }
    });
    
    // Generate verification token and store in cache
    const verificationToken = saveEmailVerificationToken(
        newAccount._id.toString(),
        signupData.email
    );
    
    // Send verification email (async - don't wait for it)
    sendVerificationEmail(signupData.email, signupData.firstName, verificationToken).catch(err => {
        console.error('Failed to send verification email:', err);
    });
    
    return toSafeAccount(newAccount) as Account;
}

/**
 * Authenticate a user with local credentials
 */
export async function authenticateLocalUser(authData: LocalAuthRequest): Promise<Account | { requiresTwoFactor: true, tempToken: string, accountId: string }> {
    const models = await db.getModels();
    
    // Use ValidationUtils for validation
    if (!authData.email && !authData.username) {
        throw new BadRequestError('Email or username is required');
    }
    
    ValidationUtils.validateRequiredFields(authData, ['password']);
    
    if (authData.email) {
        ValidationUtils.validateEmail(authData.email);
    }
    
    if (authData.username) {
        ValidationUtils.validateStringLength(authData.username, 'Username', 3, 30);
    }
    
    // Find user by email or username
    const query = authData.email 
        ? { 'userDetails.email': authData.email, accountType: AccountType.Local }
        : { 'userDetails.username': authData.username, accountType: AccountType.Local };
    
    const account = await models.accounts.Account.findOne(query);
    
    if (!account) {
        throw new NotFoundError('Invalid email/username or password', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Check if account is locked
    if (account.security.lockoutUntil && account.security.lockoutUntil > new Date()) {
        throw new ValidationError(
            `Account is temporarily locked. Try again later or reset your password.`,
            401,
            ApiErrorCode.AUTH_FAILED
        );
    }
    
    // Check if account is suspended
    if (account.status === AccountStatus.Suspended) {
        throw new ValidationError(
            'This account has been suspended. Please contact support.',
            401,
            ApiErrorCode.AUTH_FAILED
        );
    }
    
    // Check if account is unverified
    if (account.status === AccountStatus.Unverified || !account.userDetails.emailVerified) {
        throw new ValidationError(
            'Please verify your email address before logging in.',
            401,
            ApiErrorCode.AUTH_FAILED
        );
    }
    
    // Verify password
    const isPasswordValid = await account.comparePassword!(authData.password);
    
    if (!isPasswordValid) {
        // Increment failed login attempts
        account.security.failedLoginAttempts = (account.security.failedLoginAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (account.security.failedLoginAttempts >= 5) {
            account.security.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            
            await account.save();
            
            throw new ValidationError(
                'Too many failed login attempts. Account locked for 15 minutes.',
                401,
                ApiErrorCode.AUTH_FAILED
            );
        }
        
        await account.save();
        
        throw new NotFoundError('Invalid email/username or password', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Reset failed login attempts on successful login
    if (!account.security.failedLoginAttempts || account.security.failedLoginAttempts > 0) {
        account.security.failedLoginAttempts = 0;
        account.security.lockoutUntil = undefined;
        await account.save();
    }
    
    // Check if 2FA is enabled
    if (account.security.twoFactorEnabled) {
        // Generate temporary token for 2FA verification
        const tempToken = saveTwoFactorTempToken(
            account._id.toString(),
            account.userDetails.email as string
        );
        
        return {
            requiresTwoFactor: true,
            tempToken,
            accountId: account._id.toString()
        };
    }
    
    // Return account
    return toSafeAccount(account) as Account;
}

/**
 * Verify a user's email address using cached token
 */
export async function verifyEmail(token: string): Promise<boolean> {
    const models = await db.getModels();
    
    ValidationUtils.validateRequiredFields({ token }, ['token']);
    ValidationUtils.validateStringLength(token, 'Verification token', 10, 200);
    
    // Get token from cache
    const tokenData = getEmailVerificationToken(token);
    
    if (!tokenData) {
        throw new ValidationError('Invalid or expired verification token', 400, ApiErrorCode.TOKEN_INVALID);
    }
    
    // Find account by ID
    const account = await models.accounts.Account.findById(tokenData.accountId);
    
    if (!account || account.accountType !== AccountType.Local) {
        throw new ValidationError('Account not found', 400, ApiErrorCode.USER_NOT_FOUND);
    }
    
    // Verify email matches
    if (account.userDetails.email !== tokenData.email) {
        throw new ValidationError('Token email mismatch', 400, ApiErrorCode.TOKEN_INVALID);
    }
    
    // Mark email as verified
    account.userDetails.emailVerified = true;
    account.status = AccountStatus.Active;
    
    await account.save();
    
    // Remove token from cache
    removeEmailVerificationToken(token);
    
    return true;
}

/**
 * Request a password reset using cache for token storage
 */
export async function requestPasswordReset(data: PasswordResetRequest): Promise<boolean> {
    const models = await db.getModels();
    
    ValidationUtils.validateRequiredFields(data, ['email']);
    ValidationUtils.validateEmail(data.email);
    
    // Find account by email
    const account = await models.accounts.Account.findOne({
        'userDetails.email': data.email,
        accountType: AccountType.Local
    });
    
    // If no account found, we still return success (security through obscurity)
    if (!account) {
        return true;
    }
    
    // Generate reset token using the model method
    const resetToken = await account.generatePasswordResetToken!();
    
    // Send password reset email (async - don't wait for it)
    sendPasswordResetEmail(
        account.userDetails.email as string,
        account.userDetails.firstName || account.userDetails.name.split(' ')[0],
        resetToken
    ).catch(err => {
        console.error('Failed to send password reset email:', err);
    });
    
    return true;
}

/**
 * Reset password with cached token
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
    const models = await db.getModels();
    
    ValidationUtils.validateRequiredFields({ token, newPassword }, ['token', 'newPassword']);
    ValidationUtils.validateStringLength(token, 'Reset token', 10, 200);
    ValidationUtils.validatePasswordStrength(newPassword);
    
    // Get token from cache
    const tokenData = getPasswordResetToken(token);
    
    if (!tokenData) {
        throw new ValidationError('Password reset token is invalid or has expired', 400, ApiErrorCode.TOKEN_INVALID);
    }
    
    // Find account by ID
    const account = await models.accounts.Account.findById(tokenData.accountId);
    
    if (!account || account.accountType !== AccountType.Local) {
        throw new ValidationError('Account not found', 400, ApiErrorCode.USER_NOT_FOUND);
    }
    
    // Verify email matches
    if (account.userDetails.email !== tokenData.email) {
        throw new ValidationError('Token email mismatch', 400, ApiErrorCode.TOKEN_INVALID);
    }
    
    // Check if new password matches any of the previous passwords
    if (account.security.previousPasswords && account.security.previousPasswords.length > 0) {
        const isReused = await Promise.all(
            account.security.previousPasswords.map(oldHash => 
                bcrypt.compare(newPassword, oldHash)
            )
        ).then(results => results.some(result => result === true));
        
        if (isReused) {
            throw new ValidationError(
                'New password cannot be the same as any of your previous passwords',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }
    }
    
    // Reset the password
    await account.resetPassword!(newPassword);
    
    // Remove token from cache
    removePasswordResetToken(token);
    
    // Send notification email (async - don't wait)
    sendPasswordChangedNotification(
        account.userDetails.email as string,
        account.userDetails.firstName || account.userDetails.name.split(' ')[0]
    ).catch(err => {
        console.error('Failed to send password change notification:', err);
    });
    
    return true;
}

/**
 * Change password (when user is logged in)
 */
export async function changePassword(accountId: string, data: PasswordChangeRequest): Promise<boolean> {
    const models = await db.getModels();
    
    ValidationUtils.validateObjectId(accountId, 'Account ID');
    ValidationUtils.validateRequiredFields(data, ['oldPassword', 'newPassword']);
    ValidationUtils.validatePasswordStrength(data.newPassword);
    
    // Find account by ID
    const account = await models.accounts.Account.findById(accountId);
    
    if (!account || account.accountType !== AccountType.Local) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }
    
    // Verify current password
    const isCurrentPasswordValid = await account.comparePassword!(data.oldPassword);
    
    if (!isCurrentPasswordValid) {
        throw new ValidationError('Current password is incorrect', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Check if new password matches any of the previous passwords
    if (account.security.previousPasswords && account.security.previousPasswords.length > 0) {
        const isReused = await Promise.all(
            account.security.previousPasswords.map(oldHash => 
                bcrypt.compare(data.newPassword, oldHash)
            )
        ).then(results => results.some(result => result === true));
        
        if (isReused) {
            throw new ValidationError(
                'New password cannot be the same as any of your previous 5 passwords',
                400,
                ApiErrorCode.VALIDATION_ERROR
            );
        }
    }
    
    // Change the password
    await account.resetPassword!(data.newPassword);
    
    // Send notification email
    sendPasswordChangedNotification(
        account.userDetails.email as string,
        account.userDetails.firstName || account.userDetails.name.split(' ')[0]
    ).catch(err => {
        console.error('Failed to send password change notification:', err);
    });
    
    return true;
}

/**
 * Set up two-factor authentication
 */
export async function setupTwoFactor(accountId: string, data: SetupTwoFactorRequest): Promise<{ secret?: string, qrCodeUrl?: string }> {
    const models = await db.getModels();
    
    ValidationUtils.validateObjectId(accountId, 'Account ID');
    ValidationUtils.validateRequiredFields(data, ['password', 'enableTwoFactor']);
    
    // Find account by ID
    const account = await models.accounts.Account.findById(accountId);
    
    if (!account || account.accountType !== AccountType.Local) {
        throw new NotFoundError('Account not found', 404, ApiErrorCode.USER_NOT_FOUND);
    }
    
    // Verify password before enabling/disabling 2FA
    const isPasswordValid = await account.comparePassword!(data.password);
    
    if (!isPasswordValid) {
        throw new ValidationError('Password is incorrect', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Enable or disable 2FA
    if (data.enableTwoFactor) {
        // Generate new secret if it doesn't exist or is being reset
        if (!account.security.twoFactorSecret) {
            const secret = authenticator.generateSecret();
            account.security.twoFactorSecret = secret;
            
            // Generate backup codes (10 codes, 8 chars each)
            const backupCodes = Array(10).fill(0).map(() => 
                crypto.randomBytes(4).toString('hex')
            );
            
            // Hash the backup codes before storing
            account.security.twoFactorBackupCodes = await Promise.all(
                backupCodes.map(async (code) => {
                    const salt = await bcrypt.genSalt(10);
                    return bcrypt.hash(code, salt);
                })
            );
            
            await account.save();
            
            const accountName = account.userDetails.email || account.userDetails.username || accountId;
            const qrCodeUrl = authenticator.keyuri(accountName.toString(), getAppName(), secret);
            
            return {
                secret,
                qrCodeUrl
            };
        } else {
            // Secret already exists
            const accountName = account.userDetails.email || account.userDetails.username || accountId;
            const qrCodeUrl = authenticator.keyuri(accountName.toString(), getAppName(), account.security.twoFactorSecret);
            
            return {
                secret: account.security.twoFactorSecret,
                qrCodeUrl
            };
        }
    } else {
        // Disable 2FA
        account.security.twoFactorEnabled = false;
        account.security.twoFactorSecret = undefined;
        account.security.twoFactorBackupCodes = undefined;
        
        await account.save();
        
        return {};
    }
}

/**
 * Verify and activate two-factor authentication
 */
export async function verifyAndEnableTwoFactor(accountId: string, token: string): Promise<boolean> {
    const models = await db.getModels();
    
    ValidationUtils.validateObjectId(accountId, 'Account ID');
    ValidationUtils.validateRequiredFields({ token }, ['token']);
    ValidationUtils.validateStringLength(token, '2FA token', 6, 6);
    
    // Find account by ID
    const account = await models.accounts.Account.findById(accountId);
    
    if (!account || account.accountType !== AccountType.Local || !account.security.twoFactorSecret) {
        throw new NotFoundError('Account not found or 2FA not set up', 404, ApiErrorCode.USER_NOT_FOUND);
    }
    
    // Verify token
    const isValid = authenticator.verify({
        token,
        secret: account.security.twoFactorSecret
    });
    
    if (!isValid) {
        throw new ValidationError('Invalid two-factor code', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Enable 2FA
    account.security.twoFactorEnabled = true;
    await account.save();
    
    return true;
}

/**
 * Verify two-factor code during login
 */
export async function verifyTwoFactorLogin(tempToken: string, twoFactorCode: string): Promise<Account> {
    const models = await db.getModels();
    
    ValidationUtils.validateRequiredFields({ tempToken, twoFactorCode }, ['tempToken', 'twoFactorCode']);
    ValidationUtils.validateStringLength(twoFactorCode, '2FA token', 6, 8);
    
    // Get temporary token from cache
    const tokenData = getTwoFactorTempToken(tempToken);
    
    if (!tokenData) {
        throw new ValidationError('Invalid or expired temporary token', 401, ApiErrorCode.TOKEN_INVALID);
    }
    
    // Find account by ID
    const account = await models.accounts.Account.findById(tokenData.accountId);
    
    if (!account || account.accountType !== AccountType.Local || !account.security.twoFactorEnabled || !account.security.twoFactorSecret) {
        throw new NotFoundError('Account not found or 2FA not enabled', 404, ApiErrorCode.USER_NOT_FOUND);
    }
    
    // Verify email matches (additional security check)
    if (account.userDetails.email !== tokenData.email) {
        throw new ValidationError('Token account mismatch', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Check if token is a backup code
    if (account.security.twoFactorBackupCodes && account.security.twoFactorBackupCodes.length > 0) {
        const backupCodeIndex = await Promise.all(
            account.security.twoFactorBackupCodes.map(async (hashedCode, index) => {
                const isMatch = await bcrypt.compare(twoFactorCode, hashedCode);
                return isMatch ? index : -1;
            })
        ).then(results => results.find(index => index !== -1));
        
        if (backupCodeIndex !== undefined && backupCodeIndex >= 0) {
            // Remove used backup code
            account.security.twoFactorBackupCodes?.splice(backupCodeIndex, 1);
            await account.save();
            
            // Mark temp token as used and remove it
            markTwoFactorTempTokenAsUsed(tempToken);
            removeTwoFactorTempToken(tempToken);

            return toSafeAccount(account) as Account;
        }
    }
    
    // Verify regular TOTP token
    const isValid = authenticator.verify({
        token: twoFactorCode,
        secret: account.security.twoFactorSecret
    });
    
    if (!isValid) {
        throw new ValidationError('Invalid two-factor code', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Mark temp token as used and remove it
    markTwoFactorTempTokenAsUsed(tempToken);
    removeTwoFactorTempToken(tempToken);
    
    return toSafeAccount(account) as Account;
}

/**
 * Generate new backup codes for two-factor authentication
 */
export async function generateNewBackupCodes(accountId: string, password: string): Promise<string[]> {
    const models = await db.getModels();
    
    ValidationUtils.validateObjectId(accountId, 'Account ID');
    ValidationUtils.validateRequiredFields({ password }, ['password']);
    
    // Find account by ID
    const account = await models.accounts.Account.findById(accountId);
    
    if (!account || account.accountType !== AccountType.Local) {
        throw new NotFoundError('Account not found or 2FA not enabled', 404, ApiErrorCode.USER_NOT_FOUND);
    }
    
    // Verify password
    const isPasswordValid = await account.comparePassword!(password);
    
    if (!isPasswordValid) {
        throw new ValidationError('Password is incorrect', 401, ApiErrorCode.AUTH_FAILED);
    }
    
    // Generate new backup codes (10 codes, 8 chars each)
    const backupCodes = Array(10).fill(0).map(() => 
        crypto.randomBytes(4).toString('hex')
    );
    
    // Hash the backup codes before storing
    account.security.twoFactorBackupCodes = await Promise.all(
        backupCodes.map(async (code) => {
            const salt = await bcrypt.genSalt(10);
            return bcrypt.hash(code, salt);
        })
    );
    
    await account.save();
    
    // Return plain text codes to show to user
    return backupCodes;
}