const mongoose = require("mongoose");

// Replace this placeholder string with your actual Atlas connection string from MongoDB Atlas!
const dbURI = "mongodb+srv://anerie_new:magic_pass@cluster0.ue1xlrj.mongodb.net/?appName=Cluster0";

mongoose.connect(dbURI)
.then(() => {
    console.log("MongoDB connected successfully");
})
.catch((err) => {
    console.log("Failed to connect to MongoDB:", err);
});

// Define Task Schema for Schedule Items
const taskSchema = new mongoose.Schema({
    text: String,
    completed: { type: Boolean, default: false }
});

// Define Day Schema
const daySchema = new mongoose.Schema({
    deadlines: [taskSchema],
    homework: [taskSchema]
}, { _id: false });

// Main User Schema
const logInSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    courses: [{
        code: String,
        name: String,
        desc: String,
        technique: String,
        color: String
    }],
    assignments: [{
        subject: String,
        name: String,
        dueDate: String
    }],
    schedule: {
        Monday: { type: daySchema, default: () => ({ deadlines: [], homework: [] }) },
        Tuesday: { type: daySchema, default: () => ({ deadlines: [], homework: [] }) },
        Wednesday: { type: daySchema, default: () => ({ deadlines: [], homework: [] }) },
        Thursday: { type: daySchema, default: () => ({ deadlines: [], homework: [] }) },
        Friday: { type: daySchema, default: () => ({ deadlines: [], homework: [] }) },
        Saturday: { type: daySchema, default: () => ({ deadlines: [], homework: [] }) },
        Sunday: { type: daySchema, default: () => ({ deadlines: [], homework: [] }) }
    }
});

const collection = mongoose.model("collection1", logInSchema);

module.exports = collection;