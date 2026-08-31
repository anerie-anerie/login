const mongoose = require("mongoose");

const dbURI = process.env.MONGO_URI;

if (!dbURI) {
    console.error("MONGO_URI is missing. Set it in your .env file locally, or in Vercel's Environment Variables.");
}

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
        dueDate: String,
        completed: { type: Boolean, default: false }
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
