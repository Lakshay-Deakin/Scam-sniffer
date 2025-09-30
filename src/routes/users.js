// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require("bcrypt");
const path = require("path");

// --- Serve signup and signin pages
router.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "signup.html"));
});

router.get("/signin", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "signin.html"));
});

// --- REGISTER
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!password) return res.status(400).send("Password is required");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, role });
    await user.save();

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
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.send("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Invalid password");

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
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect("/users/signin"); // or /signin.html if static
  });
});

// GET /users - return all users (email + role only)
router.get('/allusers', async (req, res) => {
  try {
    const users = await User.find({}, 'email role').lean(); 
    console.log("working++++++++++++++++++++++++")
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await User.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
