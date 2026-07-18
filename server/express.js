const express = require("express");
const http = require("http");
const path = require("path");
const methodOverride = require("method-override");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const db = require("./src/connectDB/db");
const route = require("./src/routes/routes");
const { initSocket } = require("./socket/socket"); // ❗ đổi thành destructure — socket.js giờ export { initSocket, getIO }

const app = express();
const port = 5000;

// ❗ Tạo server HTTP
const server = http.createServer(app);

// ❗ Gắn socket
initSocket(server);

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(helmet());

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000"
];

app.use(cors({
    origin(origin, callback) {
        // Cho phép Postman, mobile app, server-to-server (không có Origin)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));
// Rate limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later"
});
// app.use(limiter);

// View engine
app.set("view engine", "hbs");

// Connect DB
db.connect();

// Routes
route(app);

// ❗ Quan trọng: dùng server.listen
server.listen(port, () => {
    console.log(`http://localhost:${port}`);
});