const { ok, notFoundError, serverError } = require("../../local_modules/MyExpressServer/src/response");
const { setSessionObject } = require("../config/db/cache");
const { sign } = require("../config/jwt");
const { createSessionPathAccess } = require("../middleware/auth");
const { accountTypeEx } = require("../middleware/requirement");

const { Get } = require("../../local_modules/MyExpressServer/index").Routes;

Get("/signin/createsession", accountTypeEx, createSessionPathAccess, async (req, res, next) => {
    try {
        const session = { userName: "", password: "" };
        const id = await setSessionObject(session, 120);
        try {
            const token = await sign(JSON.stringify({ owner: { id: id, type: req.searchParams.for } }), 120);
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
        const id = await setSessionObject(session, 300);
        try {
            const token = await sign(JSON.stringify({ owner: { id: id, type: req.searchParams.for } }), 300).token;
            next(null, ok(token.token));
        } catch (error) {
            throw serverError(error);
        };
    } catch (error) {
        next(error);
    };
});