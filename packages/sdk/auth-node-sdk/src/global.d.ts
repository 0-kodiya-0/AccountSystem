declare global {
    namespace Express {
        interface Request {
            account?: SafeAccount;
            accountType?: AccountType;
            oauthAccessToken?: string;
            validatedScopes?: string[];
        }
    }
}

export { };