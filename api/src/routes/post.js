const { Types } = require("mongoose");
const { ok, notAccptedError } = require("../../local_modules/MyExpressServer/src/response");
const { redis } = require("../config/db/cache");
const { sessionObjectEx, bodyPasswordEx, bodyCommentEx, bodyUsernameEx } = require("../middleware/requirement");
const { isServerAccountType, sessionValid, isSessionSignUp, isSessionSignIn, schemaPathValidate, userNameEx, passwordEx } = require("../middleware/validate");

const securityColl = require("../schema/security");

const { Post } = require("../../local_modules/MyExpressServer/index").Routes

Post("/signin/add/username", bodyUsernameEx, sessionObjectEx, sessionValid, isSessionSignIn, async (req, res, next) => {
    try {
        // Search for the account id from with the username and if found will cache the account id for later use
        const accountId = await userNameEx(req.tokenData.owner.type, req.body.username); 
        await redis.json.set(req.tokenData.owner.id, "userName", accountId); 
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signin/add/password", bodyPasswordEx, sessionObjectEx, sessionValid, isSessionSignIn, async (req, res, next) => {
    try {
        try {
            securityColl.validatePassword(req.body.password);
        } catch (error) {
            throw notAccptedError(error.message);
        };
        const cacheData = await redis.json.get(req.tokenData.owner.id);
        await passwordEx(new Types.ObjectId(cacheData.userName), req.body.password);
        await redis.json.set(req.tokenData.owner.id, "password", req.body.password);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/comment", bodyCommentEx, sessionObjectEx, sessionValid, isServerAccountType, isSessionSignUp, async (req, res, next) => {
    try {
        console.log(req.body.comment);
        await schemaPathValidate("server", "comment", req.body.comment);
        await redis.json.set(req.tokenData.owner.id, "comment", req.body.comment);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/password", bodyPasswordEx, sessionObjectEx, sessionValid, isSessionSignUp, async (req, res, next) => {
    try {
        try {
            securityColl.validatePassword(req.body.password);
        } catch (error) {
            throw notAccptedError(error.message);
        };
        await redis.json.set(req.tokenData.owner.id, "password", req.body.password);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});