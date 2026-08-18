const mongoose = require("mongoose");
require("dotenv").config();

async function connect() {
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.DB_NAME,
    });

    console.log("Connected to MongoDB");
}

module.exports = { connect };