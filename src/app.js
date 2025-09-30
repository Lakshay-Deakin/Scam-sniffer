// require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const http = require("http");
const bcrypt = require("bcrypt");
const MongoStore = require("connect-mongo");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });


// Models
const User = require("./models/user");

// Auth helpers
const {
  withUser,
  isAuthenticated,
  isAdmin,
  mountAuthEndpoints,
} = require("./utils/auth");

// --- Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Static files (serve /public)
app.use(express.static(path.join(__dirname, "public")));

// --- Mongo Connection
mongoose
  .connect("mongodb+srv://lakshaymodgil476_db_user:cibYIOwWdTMf8SdE@cluster0.rdwiuv5.mongodb.net/scam_sniffer_1?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));

// --- Session (connect-mongo)
app.use(
  session({
    secret: "mysecretkey", // ⚠️ better to use process.env.SESSION_SECRET
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: "mongodb+srv://lakshaymodgil476_db_user:cibYIOwWdTMf8SdE@cluster0.rdwiuv5.mongodb.net/scam_sniffer_1?retryWrites=true&w=majority", // same DB
      collectionName: "sessions", // will create a new "sessions" collection
      ttl: 14 * 24 * 60 * 60, // = 14 days
    }),
    cookie: {
      maxAge: 1000 * 60 * 60, // 1 hour
      httpOnly: true,
      secure: false, // set to true if using HTTPS
    },
  })
);

// Attach res.locals.user
app.use(withUser);




// --- Auth status endpoints for the front-end
mountAuthEndpoints(app);


// Example protected admin page
app.get("/admin", isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Serve analyse page (public access; features are gated client-side)
app.get("/get/analyser", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "analyse.html"));
});

// Socket-driven analysis routes
const analyzeRoutes = require("./routes/analyse")(io);
app.use("/analyze", analyzeRoutes);

// --- Optional: global userCount broadcast
let liveUsers = 0;
io.on("connection", (socket) => {
  liveUsers++;
  io.emit("userCount", liveUsers);

  socket.on("disconnect", () => {
    liveUsers = Math.max(0, liveUsers - 1);
    io.emit("userCount", liveUsers);
  });
});


const adminRoutes = require("./routes/admin");

// use it under /admin
app.use("/admin", adminRoutes);
app.use(express.static(path.join(__dirname, "public")));

const usersRouter = require('./routes/users');
app.use('/users', usersRouter);

module.exports = { app, server };