const express = require("express")
const app = express()
const path = require("path")
const hbs = require("hbs")
const collection = require("./mongodb")

const templatePath = path.join(__dirname, '../templates')

app.use(express.json())
app.set("view engine", "hbs")
app.set("views", templatePath)
app.use(express.urlencoded({ extended: false }))

// 1. Root Route (localhost:3000) -> Landing Page
app.get("/", (req, res) => {
    res.render("home")
})

// 2. Signup Page
app.get("/signup", (req, res) => {
    res.render("signup")
})

// Handle Signup Form
app.post("/signup", async (req, res) => {
    const data = {
        name: req.body.name,
        password: req.body.password
    }

    await collection.insertMany([data])

    // Render home with the user's name passed into handlebars
    res.render("home", { naming: req.body.name })
})

// 3. Login Page ONLY at localhost:3000/login
app.get("/login", (req, res) => {
    res.render("login")
})

// Handle Login Form
app.post("/login", async (req, res) => {
    try {
        const check = await collection.findOne({ name: req.body.name })

        if (check && check.password === req.body.password) {
            // Pass the user's name to the home template
            res.render("home", { naming: req.body.name })
        } else {
            res.send("Incorrect name or password")
        }
    } catch {
        res.send("An error occurred during login")
    }
})

app.listen(3000, () => {
    console.log("port connected")
})