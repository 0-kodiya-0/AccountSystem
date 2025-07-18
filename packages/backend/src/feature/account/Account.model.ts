import mongoose, { Document, Schema } from 'mongoose';
import { AccountStatus, AccountType, Account, OAuthProviders } from './Account.types';
import bcrypt from 'bcrypt';

// User details schema
const UserDetailsSchema = new Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    name: { type: String, required: true },
    email: { type: String },
    imageUrl: { type: String },
    birthdate: { type: String },
    username: { type: String },
    emailVerified: { type: Boolean, default: false },
  },
  { _id: false },
);

// Security settings schema
const SecuritySettingsSchema = new Schema(
  {
    password: { type: String }, // Optional - only for local accounts
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    twoFactorBackupCodes: { type: [String] },
    sessionTimeout: { type: Number, default: 3600 },
    autoLock: { type: Boolean, default: false },
    // Local account specific fields
    passwordSalt: { type: String },
    lastPasswordChange: { type: Date },
    previousPasswords: { type: [String], default: [] },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date },
  },
  { _id: false },
);

// Main Account Schema
const AccountSchema = new Schema(
  {
    created: { type: String, required: true },
    updated: { type: String, required: true },
    accountType: {
      type: String,
      enum: Object.values(AccountType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.Active,
    },
    userDetails: { type: UserDetailsSchema, required: true },
    security: { type: SecuritySettingsSchema, required: true },
    provider: {
      type: String,
      enum: Object.values(OAuthProviders),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes
AccountSchema.index({ 'userDetails.email': 1 }, { unique: true });
AccountSchema.index({ 'userDetails.username': 1 }, { sparse: true, unique: true });
AccountSchema.index({ accountType: 1 });
AccountSchema.index({ provider: 1 });

// Document interface
export interface AccountDocument extends Document, Omit<Account, 'id'> {
  _id: mongoose.Types.ObjectId;

  // Instance methods
  comparePassword?(candidatePassword: string): Promise<boolean>;
}

// Add methods for local accounts only
AccountSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (this.accountType !== AccountType.Local || !this.security.password) {
    throw new Error('Password comparison not available for OAuth accounts');
  }
  return bcrypt.compare(candidatePassword, this.security.password);
};

// Pre-save middleware to hash passwords for local accounts
AccountSchema.pre('save', async function (next) {
  const account = this as AccountDocument;

  // Only hash password for local accounts and if password is modified
  if (
    account.accountType === AccountType.Local &&
    account.isModified('security.password') &&
    account.security.password
  ) {
    try {
      // Generate a salt
      const salt = await bcrypt.genSalt(10);

      // Hash the password with the new salt
      account.security.password = await bcrypt.hash(account.security.password, salt);
      account.security.passwordSalt = salt;

      // If this is a new password (not just a new account), record the change time
      if (account.security.lastPasswordChange || !account.isNew) {
        account.security.lastPasswordChange = new Date();
      }

      next();
    } catch (error) {
      next(error as Error);
    }
  } else {
    next();
  }
});

// Pre-save validation
AccountSchema.pre('save', function (next) {
  const account = this as AccountDocument;

  // Validate OAuth accounts have provider
  if (account.accountType === AccountType.OAuth && !account.provider) {
    return next(new Error('OAuth accounts must have a provider'));
  }

  // Validate local accounts have password
  if (account.accountType === AccountType.Local && !account.security.password) {
    return next(new Error('Local accounts must have a password'));
  }

  // Validate OAuth accounts don't have password (initially)
  if (account.accountType === AccountType.OAuth && account.security.password) {
    return next(new Error('OAuth accounts should not have a password'));
  }

  next();
});

// Initialize model with database connection
const initAccountModel = async (connection: mongoose.Connection) => {
  return connection.model<AccountDocument>('Account', AccountSchema);
};

export default initAccountModel;
