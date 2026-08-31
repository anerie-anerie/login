const express = require("express");
const session = require("express-session"); // npm install express-session
const app = express();
const path = require("path");
const collection = require("./mongodb");
const templatePath = path.join(__dirname, '../templates');
const publicPath = path.join(__dirname, '../public');

app.use(express.json());
app.set("view engine", "hbs");
app.set("views", templatePath);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicPath));

app.use(session({
    secret: "change-this-to-a-long-random-string", // move to config.js / env var
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

// require login for a route, so /dashboard and the API can't be reached (or spoofed) by just guessing a username
function requireLogin(req, res, next) {
    if (req.session && req.session.user) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Not logged in" });
    return res.redirect("/login");
}

// Page Routes
app.get("/", (req, res) => res.render("home"));
app.get("/signup", (req, res) => res.render("signup"));
app.get("/login", (req, res) => res.render("login"));

const bcrypt = require("bcryptjs");

app.post("/signup", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const data = {
            name: req.body.name,
            password: hashedPassword,   // store the hash, never the raw password
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

// now driven by the session, not a query param anyone could edit in the URL
app.get("/dashboard", requireLogin, (req, res) => {
    res.render("dashboard", { naming: req.session.user });
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

// --- MONGO API ENDPOINTS ---

// only serves the logged-in user's own data now — ignores any username in the URL
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
    const { appData } = req.body; // username no longer trusted from the client
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

app.listen(3000, () => console.log("Server running on port 3000"));