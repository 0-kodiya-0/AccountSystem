const { forbiddenError, notFoundError, ok } = require("../../local_modules/MyExpressServer/src/response");
const { redis } = require("../config/db/cache");
const { sessionValid } = require("../middleware/auth");
const { sessionObjectEx, bodyPasswordEx } = require("../middleware/requirement");
const { validatePassword } = require("../middleware/validate");

const { Post } = require("../../local_modules/MyExpressServer/index").Routes

Post("/signup/add/comment", sessionObjectEx, sessionValid, (req, res, next) => {
    try {
        if (req.tokenData.owner.type !== "server") {
            throw forbiddenError(`account type ${req.tokenData.owner.type} cannot access this path`);
        };
        if (typeof req.body.comment !== "string") {
            throw notFoundError("comment not found");
        };
        next();
    } catch (error) {
        next(error);
    };
}, async (req, res, next) => {
    try {
        await redis.json.set(req.tokenData.owner.id, "comment", req.body.comment);
        next(ok("validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/add/password", bodyPasswordEx, validatePassword, sessionObjectEx, sessionValid, async (req, res, next) => {
    try {
        await redis.json.set(req.tokenData.owner.id, "password", req.body.password);
        next(ok("validated successfully"));
    } catch (error) {
        next(error);
    };
});

Post("/signup/submit", bodyPasswordEx, validatePassword, sessionObjectEx, sessionValid, async (req, res, next) => {
    try {
        
    } catch (error) {
        next(error);
    };
});