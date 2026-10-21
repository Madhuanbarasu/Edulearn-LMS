const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    // Message only: never print the connection string (it contains credentials).
    console.error(`DB connection error: ${String(err.message).replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "<uri hidden>")}`);
    process.exit(1);
  }
};

module.exports = connectDB;
