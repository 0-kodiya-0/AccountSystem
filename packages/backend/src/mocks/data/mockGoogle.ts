import { GooglePermissions } from '../../feature/google/models/GooglePermissions.model';

export const mockGooglePermissions: GooglePermissions = {
  accountId: '507f1f77bcf86cd799439012',
  scopes: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  lastUpdated: '2024-01-25T16:20:00.000Z',
};

export const mockGoogleTokenInfo = {
  access_token: 'ya29.example_google_access_token_12345',
  scope:
    'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly',
  expires_in: 3599,
  token_type: 'Bearer',
  audience: 'your-google-client-id.apps.googleusercontent.com',
  issued_to: 'your-google-client-id.apps.googleusercontent.com',
  verified_email: true,
  email: 'jane.smith@gmail.com',
  email_verified: true,
};
