const { MongoClient, GridFSBucket } = require("mongoose").mongo;
const mongoose = require("mongoose");

const dbName = "account";

async function connect() {
    if (typeof global.mongooseClient === "undefined" && typeof global.mongodbClient === "undefined" && typeof global.gridFsClient === "undefined") {
        const client = await new MongoClient(process.env.MONGO_DB_URL, { serverSelectionTimeoutMS: 1000 }).connect();
        global.mongooseClient = mongoose.createConnection().setClient(client); // Creating a mongoose cleint
        global.mongooseClient.set('strictQuery', false);
        global.gridFsClient = new GridFSBucket(client.db(`${dbName}_chunks`), { writeConcern: { w: "majority", j: true } }); // Creating a mongodb grid fs client
        global.mongodbClient = client.db(dbName);
    };
};

module.exports = {
    dbName, connect
};