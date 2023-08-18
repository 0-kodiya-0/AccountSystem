require("dotenv").config();

const server = require("./local_modules/MyExpressServer").Server
const mongoose = require("./src/config/db/main");
const cache = require("./src/config/db/cache");

require("./src/routes/get");
require("./src/routes/post");

server.listen(3000, async () => {
    await mongoose.connect();
    await cache.redis.connect();
    console.log("server up")
})