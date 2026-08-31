require("dotenv").config(); // reads .env locally; on Vercel, env vars come from the dashboard instead

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const app = express();
const path = require("path");
const collection = require("./mongodb");

const templatePath = path.join(__dirname, '../templates');
const publicPath = path.join(__dirname, '../public');

app.set("trust proxy", 1); // needed so secure cookies work correctly behind Vercel's proxy

app.use(express.json());
app.set("view engine", "hbs");
app.set("views", templatePath);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicPath));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        secure: process.env.NODE_ENV === "production", // only require HTTPS in production, not local dev
        sameSite: "lax"
    }
}));

// Blocks a route unless the user is logged in.
// Page routes redirect to /login; API routes (used by fetch()) get a JSON 401 instead.
function requireLogin(req, res, next) {
    if (req.session && req.session.user) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Not logged in" });
    return res.redirect("/login");
}

// Page Routes
app.get("/", (req, res) => res.render("home"));
app.get("/signup", (req, res) => res.render("signup"));
app.get("/login", (req, res) => res.render("login"));

app.post("/signup", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const data = {
            name: req.body.name,
            password: hashedPassword,
            courses: [],
            assignments: []
        };
        await collection.insertMany([data]);
        req.session.user = req.body.name;
        res.render("dashboard", { naming: req.body.name });
    } catch {
        res.send("Error creating account or username taken");
    }
});

app.post("/login", async (req, res) => {
    try {
        const check = await collection.findOne({ name: req.body.name });
        const passwordMatches = check && await bcrypt.compare(req.body.password, check.password);

        if (passwordMatches) {
            req.session.user = check.name;
            res.render("dashboard", { naming: check.name });
        } else {
            res.send("Incorrect name or password");
        }
    } catch {
        res.send("An error occurred during login");
    }
});

// driven by the session, not a query param anyone could edit in the URL
app.get("/dashboard", requireLogin, (req, res) => {
    res.render("dashboard", { naming: req.session.user });
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

// --- MONGO API ENDPOINTS ---

// only ever serves the logged-in user's own data, ignoring any username in the URL
app.get("/api/user-data/:username", requireLogin, async (req, res) => {
    try {
        const user = await collection.findOne({ name: req.session.user });
        if (user) {
            res.json({
                courses: user.courses || [],
                assignments: user.assignments || [],
                schedule: user.schedule || {}
            });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post("/api/save-data", requireLogin, async (req, res) => {
    const { appData } = req.body; // username comes from the session, not the client
    try {
        await collection.updateOne(
            { name: req.session.user },
            { $set: {
                courses: appData.courses,
                assignments: appData.assignments,
                schedule: appData.schedule
            }}
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save data" });
    }
});

// Only actually start listening on a port locally.
// On Vercel, the exported app is run as a serverless function instead.
if (process.env.NODE_ENV !== "production") {
    app.listen(3000, () => console.log("Server running on port 3000"));
}

module.exports = app;
