function checkRequired() {
    if (typeof process.env.MONGO_DB_URL === "undefined") {
        throw new TypeError("Env MONGO_DB_URL not found");
    };
    if (typeof process.env.REDIS_URL === "undefined") {
        throw new TypeError("Env REDIS_URL not found");
    };
    if (typeof process.env.DOMAIN === "undefined") {
        throw new TypeError("Env DOMAIN not found");
    };
    if (typeof process.env.CERT_PATH === "undefined") {
        throw new TypeError("Env CERT_PATH not found");
    };
    if (typeof process.env.CERT_FILE_NAME === "undefined") {
        throw new TypeError("Env CERT_FILE_NAME not found");
    };
    if (typeof process.env.SERVER_USERNAME === "undefined") {
        throw new TypeError("Env SERVER_USERNAME not found");
    };
    if (typeof process.env.SERVER_PASSWORD === "undefined") {
        throw new TypeError("Env SERVER_PASSWORD not found");
    };
};

function check(what) {
    if (what === "required" || what === "all") {
        checkRequired();
    };
};

module.exports = {
    check, checkRequired
}