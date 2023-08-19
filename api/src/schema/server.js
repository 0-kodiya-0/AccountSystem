const { Schema } = require("mongoose");
const schemaNames = require("./names");

const ServerSchema = new Schema({
    comment: {
        type: String,
        cast: false,
        minlength: [2, "comment.length didn't reached min length"],
        maxlength: [30, "comment.length reached max length"],
        lowercase: true,
        required: true
    },
    display: {
        type: Boolean,
        cast: false,
        default: true
    }
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true });

const ServerModel = global.mongooseClient.model(schemaNames.server, ServerSchema, schemaNames.server);

module.exports = {
    ServerSchema,
    ServerModel
}