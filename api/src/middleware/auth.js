const { forbiddenError } = require("../../local_modules/MyExpressServer/src/response");

function basicAuthCheck(req, res, next) {
    try {
        if (process.env.BASIC_AUTH === "false"){
            throw forbiddenError("Need to have valid account");
        };

        const authDetails = req.headers.authorization.split(" ");
        const authDataArr = Buffer.from(authDetails[1], "base64").toString("utf-8").split(":");
        if (authDataArr[0] !== process.env.SERVER_USERNAME || authDataArr[1] !== process.env.SERVER_PASSWORD) { // remider to fix
            throw forbiddenError("Basic details not valid");
        };
        next()
    } catch (error) {
        next(error)
    }
};

module.exports = {
    basicAuthCheck
}