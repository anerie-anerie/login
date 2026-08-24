const express = require("express");
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

// Page Routes
app.get("/", (req, res) => res.render("home"));
app.get("/signup", (req, res) => res.render("signup"));
app.get("/login", (req, res) => res.render("login"));

app.post("/signup", async (req, res) => {
    try {
        const data = {
            name: req.body.name,
            password: req.body.password,
            courses: [],
            assignments: []
        };
        await collection.insertMany([data]);
        res.render("dashboard", { naming: req.body.name });
    } catch {
        res.send("Error creating account or username taken");
    }
});

app.post("/login", async (req, res) => {
    try {
        const check = await collection.findOne({ name: req.body.name });
        if (check && check.password === req.body.password) {
            res.render("dashboard", { naming: req.body.name });
        } else {
            res.send("Incorrect name or password");
        }
    } catch {
        res.send("An error occurred during login");
    }
});

app.get("/dashboard", (req, res) => {
    res.render("dashboard");
});

// --- MONGO API ENDPOINTS ---

// 1. Fetch User Data from MongoDB
app.get("/api/user-data/:username", async (req, res) => {
    try {
        const user = await collection.findOne({ name: req.params.username });
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

// 2. Save User Data to MongoDB
app.post("/api/save-data", async (req, res) => {
    const { username, appData } = req.body;
    try {
        await collection.updateOne(
            { name: username },
            { 
                $set: { 
                    courses: appData.courses,
                    assignments: appData.assignments,
                    schedule: appData.schedule
                } 
            }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save data" });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));