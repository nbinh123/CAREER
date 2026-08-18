require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const methodOverride = require("method-override");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const db = require("./src/connectDB/db");
const route = require("./src/routes/routes");
const { initSocket } = require("./socket/socket");
require("./telegram/bot");

const app = express();
const port = 5000;

const server = http.createServer(app);

initSocket(server);

app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(helmet());

const allowedOrigins = [
    "https://career-eight-lilac.vercel.app",
    "https://career-mu-sage.vercel.app",
    "https://career-ten.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:3002",
];

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("CORS_FORBIDDEN"));
        },
        credentials: true,
    })
);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests, please try again later",
    },
});

// app.use("/api", limiter);

app.set("view engine", "hbs");

route(app);

app.use((err, req, res, next) => {
    if (err.message === "CORS_FORBIDDEN") {
        return res.status(403).json({
            success: false,
            message: "Forbidden",
        });
    }

    console.error("Server error:", err.message);

    return res.status(500).json({
        success: false,
        message: "Internal server error",
    });
});

const startServer = async () => {
    try {
        await db.connect();

        server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

startServer();