const { ok, notFoundError, serverError, notAccptedError, forbiddenError } = require("../../local_modules/MyExpressServer/src/response");
const { setSessionObject, delSessionObject, getSessionObject } = require("../config/db/cache");
const { sign } = require("../config/jwt");
const { createSessionPathAccess, s_a_UsernameAuth } = require("../middleware/auth");
const { accountTypeEx, sessionObjectEx } = require("../middleware/requirement");
const { signinUpSessionValid, isSessionSignUp, isSessionSignIn, passwordEx } = require("../middleware/validate");
const { Types } = require("mongoose");

const { Get } = require("../../local_modules/MyExpressServer/index").Routes;

const securityColl = require("../schema/security");
const serverColl = require("../schema/server");
const accessTokenColl = require("../schema/accessToken");
const commonDetails = require("../schema/commonDetails");
const names = require("../schema/names");

Get("/signin/createsession", accountTypeEx, createSessionPathAccess, async (req, res, next) => {
    try {
        const session = { userName: "", password: "" };
        const id = await setSessionObject(session, 120);
        try {
            const token = await sign({ aType: req.searchParams.for, for: "signin" }, 120, id);
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
            session = { userName: "", email: "", firstName: "", lastName: "", age: "", birth: "", gender: "", ...gloSession };
            if (req.searchParams.for === "student") {
                if (typeof req.dbTokenData === "undefined") {
                    throw forbiddenError("Access token required");
                };
                if (req.dbTokenData.type !== "personal" && req.dbTokenData.type !== "business") {
                    throw forbiddenError("Account type need to be personal or business");
                };
                session = { ...session, parentAccountId: req.dbTokenData.accountId };
            };
        } else if (req.searchParams.for === "server") {
            session = { ...gloSession, comment: "" };
        } else {
            throw notFoundError("Account type invalid");
        };
        const id = await setSessionObject(session, 360000);
        try {
            const token = await sign({ aType: req.searchParams.for, for: "signup" }, 360000, id);
            next(null, ok(token.token));
        } catch (error) {
            throw serverError(error);
        };
    } catch (error) {
        next(error);
    };
});

Get("/signin/submit", sessionObjectEx, signinUpSessionValid, isSessionSignIn, async (req, res, next) => {
    try {
        let response = "Access token created successfully";
        const cacheData = await getSessionObject(req.sessionData.jti);
        if (typeof cacheData.userName !== "string" && typeof cacheData.password !== "string") { // Checking if the data has been added to the session
            throw notAccptedError("Username and password not added to the session");
        };
        const userName = new Types.ObjectId(cacheData.userName)
        await passwordEx(userName, cacheData.password);
        let newsessionData;
        switch (req.sessionData.aType) {
            case "server":
                try {
                    newsessionData = await sign({ message: "Token generated successfully" }, 300);
                } catch (error) {
                    throw serverError(error);
                };
                try {
                    await accessTokenColl.insertInfo({ accountId: userName, tokenId: newsessionData.tokenId, userAgent: req.headers["user-agent"], loged: true, twoFactorAuth: true }, "server");
                } catch (error) {
                    throw notAccptedError(error);
                };
                response = newsessionData.token; // Adding the token to the response
                break;
            default:
                throw forbiddenError("Account type not valid");
        };
        await delSessionObject(req.sessionData.jti);
        next(ok(response));
    } catch (error) {
        next(error);
    };
});

Get("/signup/submit", sessionObjectEx, signinUpSessionValid, isSessionSignUp, async (req, res, next) => {
    try {
        const cacheData = await getSessionObject(req.sessionData.jti);
        if (typeof cacheData.type !== "string") { // Checking if the data has been added to the session
            throw notAccptedError("Type not added to the session");
        };
        switch (req.sessionData.aType) {
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
            case "personal" || "admin" || "root" || "student":
                try {
                    if (typeof cacheData.userName !== "string" && typeof cacheData.email !== "string") { // Checking if the data has been added to the session
                        throw notAccptedError("Username and email not added to the session");
                    };
                    if (typeof cacheData.firstName !== "string" && typeof cacheData.lastName !== "string") {
                        throw notAccptedError("Firstname and lastname not added to the session");
                    };
                    if (typeof cacheData.birth !== "string" && typeof cacheData.age !== "string" && typeof cacheData.gender !== "string") {
                        throw notAccptedError("Birth and age and gender not added to the session");
                    };
                    if (req.sessionData.aType === "student") {
                        if (typeof cacheData.parentAccountId !== "string") {
                            throw notAccptedError("Parent account not added to the session");
                        };
                    };
                    const insertedData = await commonDetails.insertInfo(req.sessionData.aType, { userName: cacheData.userName, email: cacheData.email, firstName: cacheData.firstName, lastName: cacheData.lastName, birth: cacheData.birth, age: cacheData.age, gender: cacheData.gender });
                    await securityColl.insertInfo({ accountId: insertedData._id, type: req.sessionData.aType, password: cacheData.password, parentAccountId: cacheData.parentAccountId });
                } catch (error) {
                    throw notAccptedError(error);
                };
                break
            default:
                throw forbiddenError("Account type not valid");
        };
        await delSessionObject(req.sessionData.jti);
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