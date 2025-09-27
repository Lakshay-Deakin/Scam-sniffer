// routes/admin.js
const express = require("express");
const router = express.Router();
const User = require("../models/user"); // adjust path if needed
const Analysis = require("../models/analysis");

// Admin dashboard: show total users
router.get("/user-count", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    res.json({ totalUsers });
  } catch (err) {
    res.status(500).json({ error: "Error fetching user count" });
  }
});

// History redirect page
router.get("/history", (req, res) => {
  res.render("/history.html");
});

router.get("/history-data", async (req, res) => {
  try {
    const records = await Analysis.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Error fetching records" });
  }
});

// Delete a record by ID
router.delete("/history/:id", async (req, res) => {
  try {
    await Analysis.findByIdAndDelete(req.params.id);
    res.json({ message: "Record deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting record" });
  }
});

module.exports = router;
