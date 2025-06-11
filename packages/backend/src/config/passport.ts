import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { OAuthProviders } from "../feature/account/Account.types";
import { ProviderResponse } from "../feature/oauth/OAuth.types";
import {
  getBaseUrl,
  getGoogleClientId,
  getGoogleClientSecret,
  getProxyUrl,
} from "./env.config";
import { logger } from "../utils/logger";

/**
 * Sets up passport strategies for OAuth providers
 */
const setupPassport = () => {
  // Main Google Strategy for authentication (sign in/sign up)
  const googleAuthStrategy = new GoogleStrategy(
    {
      clientID: getGoogleClientId(),
      clientSecret: getGoogleClientSecret(),
      callbackURL: `${getProxyUrl()}${getBaseUrl()}/oauth/callback/google`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        logger.info("Google Auth callback received");

        // Create the provider response with all user information
        const response: ProviderResponse = {
          provider: OAuthProviders.Google,
          name: profile.displayName,
          email: profile.emails?.[0].value,
          imageUrl: profile.photos?.[0].value,
          tokenDetails: {
            accessToken,
            refreshToken: refreshToken || "",
          },
        };

        logger.info(`Authentication successful for: `, response);

        return done(null, response);
      } catch (error) {
        logger.error("Error in Google auth strategy:", error);
        return done(error as Error);
      }
    },
  );

  // Separate Google Strategy for permission requests - focused only on tokens
  const googlePermissionStrategy = new GoogleStrategy(
    {
      clientID: getGoogleClientId(),
      clientSecret: getGoogleClientSecret(),
      callbackURL: `${getProxyUrl()}${getBaseUrl()}/oauth/callback/permission/google`,
      passReqToCallback: true,
      skipUserProfile: true,
    },
    async (req, accessToken, refreshToken, params, done) => {
      try {
        logger.info("Google Permission callback received");

        // For permission requests, we only care about the tokens
        // We don't need to extract profile information because we already have it
        const response: ProviderResponse = {
          provider: OAuthProviders.Google,
          // These fields will be ignored/unused for permission requests
          name: "",
          email: "",
          imageUrl: "",
          // The important part: the new token with expanded scopes
          tokenDetails: {
            accessToken,
            refreshToken: refreshToken || "",
          },
        };

        logger.info(`Permission request successful, received new access token`);

        return done(null, response);
      } catch (error) {
        logger.error("Error in Google permission strategy:", error);
        return done(error as Error);
      }
    },
  );

  // Register the strategies with different names
  passport.use("google", googleAuthStrategy);
  passport.use("google-permission", googlePermissionStrategy);
};

export default setupPassport;

// // Microsoft Strategy
// passport.use(new MicrosoftStrategy({
//     clientID: process.env.MICROSOFT_CLIENT_ID!,
//     clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
//     callbackURL: '/api/oauth/callback/microsoft',
//     scope: ['user.read']
// }, async (accessToken: string, refreshToken: string | undefined, profile: Profile, done: DoneCallback) => {
//     try {
//         const response: ProviderResponse = {
//             provider: OAuthProviders.Google,
//             name: profile.displayName,
//             email: profile.emails?.[0].value,
//             imageUrl: profile.photos?.[0].value,
//             tokenDetails: {
//                 accessToken,
//                 refreshToken: refreshToken || '',
//             }
//         };
//         return done(null, response);
//     } catch (error) {
//         return done(error as Error);
//     }
// }));

// // Facebook Strategy
// passport.use(new FacebookStrategy({
//     clientID: process.env.FACEBOOK_CLIENT_ID!,
//     clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
//     callbackURL: '/api/oauth/callback/facebook',
//     profileFields: ['id', 'displayName', 'photos', 'email']
// }, async (accessToken, refreshToken, profile, done) => {
//     try {
//         const response: ProviderResponse = {
//             provider: OAuthProviders.Google,
//             name: profile.displayName,
//             email: profile.emails?.[0].value,
//             imageUrl: profile.photos?.[0].value,
//             tokenDetails: {
//                 accessToken,
//                 refreshToken: refreshToken || '',
//             }
//         };
//         return done(null, response);
//     } catch (error) {
//         return done(error as Error);
//     }
// }));
