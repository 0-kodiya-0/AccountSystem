const { ok, notFoundError, serverError } = require("../../local_modules/MyExpressServer/src/response");
const { setSessionObject } = require("../config/db/cache");
const { sign } = require("../config/jwt");
const { createSessionPathAccess } = require("../middleware/auth");
const { accountTypeEx } = require("../middleware/requirement");

const { Get } = require("../../local_modules/MyExpressServer/index").Routes;

Get("/signin/createsession", accountTypeEx, createSessionPathAccess, async (req, res, next) => {
    try {
        const session = { userName: "", password: "" };
        const id = await setSessionObject(session, 500000000);
        try {
            const token = await sign({ owner: { id: id, type: req.searchParams.for }, for: "signin" }, 500000000);
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
        const id = await setSessionObject(session, 500000000);
        try {
            const token = await sign({ owner: { id: id, type: req.searchParams.for }, for: "signup" }, 500000000);
            next(null, ok(token.token));
        } catch (error) {
            throw serverError(error);
        };
    } catch (error) {
        next(error);
    };
});