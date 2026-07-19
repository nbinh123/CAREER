const mongoose = require("mongoose");
require("dotenv").config();

async function connect() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.DB_NAME,
        });

        console.log("✅ Connected to MongoDB");
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err);
    }
}

module.exports = { connect };