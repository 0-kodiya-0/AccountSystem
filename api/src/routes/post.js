const { Types } = require("mongoose");
const { ok, notAccptedError } = require("../../local_modules/MyExpressServer/src/response");
const { updateSessionObject, getSessionObject } = require("../config/db/cache");
const { sessionObjectEx, bodyPasswordEx, bodyCommentEx, bodyUsernameEx, bodyEmailEx, bodyNameEx, bodyBasicEx } = require("../middleware/requirement");
const { isServerAType, signinUpSessionValid, isSessionSignUp, isSessionSignIn, schemaPathValidate, userNameEx, passwordEx, isNotServerAType } = require("../middleware/validate");

const securityColl = require("../schema/security");
const commonDetailsColl = require("../schema/commonDetails");

const { Post } = require("../../local_modules/MyExpressServer/index").Routes

Post("/signin/add/username", bodyUsernameEx, sessionObjectEx, signinUpSessionValid, isSessionSignIn, async (req, res, next) => {
    try {
        // Search for the account id from with the username and if found will cache the account id for later use
        const accountId = await userNameEx(req.tokenData.aType, req.body.username);
        await updateSessionObject(req.tokenData.tid, "userName", accountId);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signin/add/password", bodyPasswordEx, sessionObjectEx, signinUpSessionValid, isSessionSignIn, async (req, res, next) => {
    try {
        try {
            securityColl.validatePassword(req.body.password);
        } catch (error) {
            throw notAccptedError(error);
        };
        const cacheData = await getSessionObject(req.tokenData.tid);
        await passwordEx(new Types.ObjectId(cacheData.userName), req.body.password);
        await updateSessionObject(req.tokenData.tid, "password", req.body.password);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/username", bodyUsernameEx, sessionObjectEx, signinUpSessionValid, isNotServerAType, isSessionSignUp, async (req, res, next) => {
    try {
        await schemaPathValidate("notserver", "userName", req.body.username);
        await updateSessionObject(req.tokenData.tid, "userName", req.body.username);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/email", bodyEmailEx, sessionObjectEx, signinUpSessionValid, isNotServerAType, isSessionSignUp, async (req, res, next) => {
    try {
        await schemaPathValidate("notserver", "email", req.body.email);
        await updateSessionObject(req.tokenData.tid, "email", req.body.email);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/name", bodyNameEx, sessionObjectEx, signinUpSessionValid, isNotServerAType, isSessionSignUp, async (req, res, next) => {
    try {
        await schemaPathValidate("notserver", "firstName", req.body.firstname);
        await schemaPathValidate("notserver", "lastName", req.body.lastname);
        await updateSessionObject(req.tokenData.tid, "firstName", req.body.firstname);
        await updateSessionObject(req.tokenData.tid, "lastName", req.body.lastname);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/basic", bodyBasicEx, sessionObjectEx, signinUpSessionValid, isNotServerAType, isSessionSignUp, async (req, res, next) => {
    try {
        await schemaPathValidate("notserver", "birth", req.body.birth);
        const age = commonDetailsColl.getAge(req.body.birth);
        commonDetailsColl.validateAge(age, req.tokenData.tid);
        await schemaPathValidate("notserver", "gender", req.body.gender);
        await updateSessionObject(req.tokenData.tid, "birth", req.body.birth);
        await updateSessionObject(req.tokenData.tid, "age", req.body.age);
        await updateSessionObject(req.tokenData.tid, "gender", req.body.gender);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/comment", bodyCommentEx, sessionObjectEx, signinUpSessionValid, isServerAType, isSessionSignUp, async (req, res, next) => {
    try {
        await schemaPathValidate("server", "comment", req.body.comment);
        await updateSessionObject(req.tokenData.tid, "comment", req.body.comment);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/password", bodyPasswordEx, sessionObjectEx, signinUpSessionValid, isSessionSignUp, async (req, res, next) => {
    try {
        try {
            securityColl.validatePassword(req.body.password);
        } catch (error) {
            throw notAccptedError(error);
        };
        await updateSessionObject(req.tokenData.tid, "password", req.body.password);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});