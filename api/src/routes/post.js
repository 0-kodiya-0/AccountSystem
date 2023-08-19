const { ok, notAccptedError } = require("../../local_modules/MyExpressServer/src/response");
const { redis } = require("../config/db/cache");
const { sessionObjectEx, bodyPasswordEx, bodyCommentEx } = require("../middleware/requirement");
const { isServerAccountType, sessionValid, isSessionSignUp } = require("../middleware/validate");
const { validatePassword, insertInfo } = require("../schema/security");
const { ServerModel } = require("../schema/server");

const { Post } = require("../../local_modules/MyExpressServer/index").Routes

Post("/signup/add/comment", bodyCommentEx, sessionObjectEx, sessionValid, isSessionSignUp, async (req, res, next) => {
    try {
        await redis.json.set(req.tokenData.owner.id, "comment", req.body.comment);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/password", bodyPasswordEx, sessionObjectEx, sessionValid, isSessionSignUp, async (req, res, next) => {
    try {
        try {
            validatePassword(req.body.password);
        } catch (error) {
            throw notAccptedError(error.message);
        };
        await redis.json.set(req.tokenData.owner.id, "password", req.body.password);
        next(ok("Validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/submit", bodyPasswordEx, sessionObjectEx, sessionValid, isServerAccountType, isSessionSignUp, async (req, res, next) => {
    try {
        const cacheData = await redis.json.get(req.tokenData.owner.id);
        const insertedData = await new ServerModel({ comment: cacheData.comment }).save();
        await insertInfo({ accountId: insertedData._id, type: "server", password: cacheData.password });
        next(ok("Data insert successfully"));
    } catch (error) {
        next(error);
    };
});