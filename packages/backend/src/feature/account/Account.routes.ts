import express from 'express';
import * as AccountController from './Account.controller';

export const authRequiredRouter = express.Router({ mergeParams: true });
export const authNotRequiredRouter = express.Router({
  mergeParams: true,
});

// Public routes (no authentication required)
authNotRequiredRouter.get('/search', AccountController.searchAccount);

authNotRequiredRouter.get('/logout/all', AccountController.logoutAll);

authNotRequiredRouter.get('/logout', AccountController.logout);

// Private routes (authentication required)

// Get account details
authRequiredRouter.get('/', AccountController.getAccount);

// Update OAuth account
authRequiredRouter.patch('/', AccountController.updateAccount);

// Get account email
authRequiredRouter.get('/email', AccountController.getAccountEmail);

// Update OAuth account security settings
authRequiredRouter.patch('/security', AccountController.updateAccountSecurity);
