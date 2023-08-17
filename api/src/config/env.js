function checkRequired() {
    if (typeof process.env.MONGO_DB_URL === "undefined") {
        throw new TypeError("Env MONGO_DB_URL not found")
    };
    if (typeof process.env.REDIS_URL === "undefined") {
        throw new TypeError("Env REDIS_URL not found")
    };
};

function check(what) {
    if (what === "required" || what === "all") {
        checkRequired()
    };
};

module.exports = {
    check, checkRequired
}