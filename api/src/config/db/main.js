const { MongoClient, GridFSBucket } = require("mongoose").mongo;
const mongoose = require("mongoose");

const dbName = "account";

let mongooseClient = mongoose;
let mongodbClient;
let gridFsClient;

async function connect() {
    const client = new MongoClient(process.env.MONGO_DB_URL, { dbName: dbName, serverSelectionTimeoutMS: 1000 });
    mongodbClient = await client.connect(); // Connecting to mongodb

    mongooseClient = mongoose.createConnection().setClient(mongodbClient); // Creating a mongoose cleint
    mongooseClient.set('strictQuery', false);

    gridFsClient = new GridFSBucket(mongodbClient.db(`${dbName}_chunks`), { writeConcern: { w: "majority", j: true } }); // Creating a mongodb grid fs client

    mongodbClient = mongodbClient.db(dbName);
};

module.exports = {
    mongooseClient, mongodbClient, gridFsClient, dbName, connect
};