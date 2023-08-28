require("dotenv").config();

const server = require("./local_modules/MyExpressServer").Server;
const db = require("./src/config/db/main");
const cache = require("./src/config/db/cache");

server.listen(4000, async () => {
    try {
        await db.connect();
        await cache.redis.connect();
        require("./src/routes/get");
        require("./src/routes/post");
        console.log("server up");
    } catch (error) {
        console.log(error);
        process.exit(1);
    };
});

process.on("unhandledRejection" , (data) =>{
    console.log(data)
})