const mongoose = require("mongoose");
const config = require("../config");
const dbURI = config.MONGO_URL;

mongoose.connect(dbURI)
  .then(() => {
    console.log("mongodb connected");
  })
  .catch((err) => {
    console.log("failed to connect", err);
  });

const LogInSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  }
});

const collection = new mongoose.model("Collection1", LogInSchema);

module.exports = collection;