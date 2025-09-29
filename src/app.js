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
      mongoUrl: "mongodb://localhost:27017/scam_sniffer", // same DB
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

// --- Simple pages
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Optional: make /signin serve the file too
app.get("/signin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signin.html"));
});


// --- REGISTER
app.post("/register", async (req, res) => {
  try {
    console.log(req.body,res.body,'_-----------=++++++++++++++++++++++')
    const { email, password, role } = req.body;
    console.log(email,password,role,'===================+++++++++++++++++++++++')
    console.log(req.body,'+++++++++++++++++++++++++++++++++++++++++++++')
    if (!password) {
        return res.status(400).send("Password is required")};
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(email,password,role,'===================+++++++++++++++++++++++')

    const user = new User({
      email,
      password: hashedPassword,
      role,
    });
    await user.save();

    // Stash session data used by analyse.html
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.email = user.email;

    res.redirect("/analyse.html");
  } catch (err) {
    console.error(err);
    res.send("Error registering user. Maybe email already exists.");
  }
});

// --- LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.send("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Invalid password");

    // Stash session data used by analyse.html
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.email = user.email;

    res.redirect("/analyse.html");
  } catch (err) {
    console.error(err);
    res.send("Error logging in");
  }
});

// --- LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect("/signin.html"); // make sure this file exists in /public
  });
});

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

// // --- Start
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
