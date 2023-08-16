const { Schema, model } = require("mongoose")
const schemaNames = require("./names");

const AccountServerSchema = new Schema({
    password: {
        type: String,
        cast: false,
        unique: true,
        required: true
    },
    comment: {
        type: String,
        cast: false,
        minlength: [1, "comment didn't reached min length"],
        maxlength: [20, "comment reached max length"],
        lowercase: true
    }
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true })

const AccountServerModel = model(schemaNames.accountServer, AccountServerSchema, schemaNames.accountServer);

module.exports = {
    AccountServerModel,
    AccountServerSchema
}