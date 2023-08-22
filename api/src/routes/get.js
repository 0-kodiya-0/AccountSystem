const { ok, notFoundError, serverError, notAccptedError } = require("../../local_modules/MyExpressServer/src/response");
const { setSessionObject, delSessionObject, getSessionObject } = require("../config/db/cache");
const { sign } = require("../config/jwt");
const { createSessionPathAccess, s_a_UsernameAuth } = require("../middleware/auth");
const { accountTypeEx, sessionObjectEx } = require("../middleware/requirement");
const { signinUpsessionValid, isSessionSignUp, isSessionSignIn, passwordEx } = require("../middleware/validate");
const { Types } = require("mongoose");

const { Get } = require("../../local_modules/MyExpressServer/index").Routes;

const securityColl = require("../schema/security");
const serverColl = require("../schema/server");
const accessTokenColl = require("../schema/accessToken");
const names = require("../schema/names");

Get("/signin/createsession", accountTypeEx, createSessionPathAccess, async (req, res, next) => {
    try {
        const session = { userName: "", password: "" };
        const id = await setSessionObject(session, 120);
        try {
            const token = await sign({ owner: { id: id, type: req.searchParams.for }, for: "signin" }, 120);
            next(null, ok(token.token));
        } catch (error) {
            throw serverError(error);
        };
    } catch (error) {
        next(error);
    };
});

Get("/signup/createsession", accountTypeEx, createSessionPathAccess, async (req, res, next) => {
    try {
        const gloSession = { password: "", type: req.searchParams.for };
        let session;
        if (req.searchParams.for === "personal" || req.searchParams.for === "admin" || req.searchParams.for === "root" || req.searchParams.for === "business" || req.searchParams.for === "student") {
            session = { userName: "", firstName: "", lastName: "", birth: "", sex: "", ...gloSession };
            if (req.searchParams.for === "student") {
                session = { ...session, parentAccountId: "" };
            };
        } else if (req.searchParams.for === "server") {
            session = { ...gloSession, comment: "" };
        } else {
            throw notFoundError("Account type invalid");
        };
        const id = await setSessionObject(session, 360);
        try {
            const token = await sign({ owner: { id: id, type: req.searchParams.for }, for: "signup" }, 360);
            next(null, ok(token.token));
        } catch (error) {
            throw serverError(error);
        };
    } catch (error) {
        next(error);
    };
});

Get("/signin/submit", sessionObjectEx, signinUpsessionValid, isSessionSignIn, async (req, res, next) => {
    try {
        let response = "Access token created successfully";
        const cacheData = await getSessionObject(req.tokenData.owner.id);
        if (typeof cacheData.userName !== "string" && typeof cacheData.password !== "string") { // Checking if the data has been added to the session
            throw notAccptedError("Username and password not added to the session");  
        };
        const userName = new Types.ObjectId(cacheData.userName)
        await passwordEx(userName, cacheData.password);
        let newTokenData;
        switch (req.tokenData.owner.type) {
            case "server":
                try {
                    newTokenData = await sign({ message: "Token generated successfully" }, 300);
                } catch (error) {
                    throw serverError(error);
                };
                try {
                    await accessTokenColl.insertInfo({ accountId: userName, tokenId: newTokenData.tokenId, userAgent: req.headers["user-agent"], loged: true, twoFactorAuth: true }, "server");
                } catch (error) {
                    throw notAccptedError(error);
                };
                response = newTokenData.token; // Adding the token to the response
                break;
            default:
                throw forbiddenError("Account type not valid");
        };
        await delSessionObject(req.tokenData.owner.id);
        next(ok(response));
    } catch (error) {
        next(error);
    };
});

Get("/signup/submit", sessionObjectEx, signinUpsessionValid, isSessionSignUp, async (req, res, next) => {
    try {
        const cacheData = await getSessionObject(req.tokenData.owner.id);
        switch (req.tokenData.owner.type) {
            case "server":
                if (typeof cacheData.userName !== "string" && typeof cacheData.password !== "string") { // Checking if the data has been added to the session
                    throw notAccptedError("Username and password not added to the session");
                };
                try {
                    const insertedData = await serverColl.insertInfo({ comment: cacheData.comment });
                    await securityColl.insertInfo({ accountId: insertedData._id, type: "server", password: cacheData.password });
                } catch (error) {
                    throw notAccptedError(error);
                };
                break;
            default:
                throw forbiddenError("Account type not valid");
        };
        await delSessionObject(req.tokenData.owner.id);
        next(ok("Data insert successfully"));
    } catch (error) {
        next(error);
    };
});

Get("/search/account/username", s_a_UsernameAuth, async (req, res, next) => {
    try {
        let collection;
        switch (req.aType) {
            case "server":
                collection = names.server;
                break;
            default:
                throw forbiddenError("Account type not valid");
        };
        try {
            const data = await mongodbClient.collection(collection).find(req.fillter).project({ _id: 1 }).limit(req.searchParams.limit || 10).skip(req.searchParams.skip || 0).toArray();
            next(ok(data));
        } catch (error) {
            throw serverError(error);
        };
    } catch (error) {
        next(error);
    };
});