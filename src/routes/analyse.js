const express = require("express");
const sanitizeHtml = require("sanitize-html");
const analyzeText = require("../utils/analyzer");

module.exports = function(io) {
  const router = express.Router();

  let activeUsers = 0;

  // Track connections and handle real-time analysis
  io.on("connection", (socket) => {
    activeUsers++;
    console.log("User connected. Active users:", activeUsers);

    // Broadcast active users to all clients
    io.emit("userCount", activeUsers);

    // Listen for real-time analysis requests
    socket.on("analyzeText", (rawText) => {
      const text = sanitizeHtml(rawText, { allowedTags: [], allowedAttributes: {} }).trim();
      if (!text) return;

      const result = analyzeText(text);

      // Send result back to the same client
      socket.emit("analysisResult", result);

      // Optional: broadcast to all clients (admins)
      io.emit("newAnalysis", { text, ...result });
    });

    socket.on("disconnect", () => {
      activeUsers--;
      console.log("User disconnected. Active users:", activeUsers);
      io.emit("userCount", activeUsers);
    });
  });

  // Keep the /text POST route if you still want legacy support
  router.post("/text", async (req, res) => {
    try {
      const raw = req.body.text || "";
      const text = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).trim();
      if (!text) return res.status(400).json({ error: "Please provide text" });

      const result = analyzeText(text);

      // Emit result to all connected clients
      io.emit("newAnalysis", { text, ...result });

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
};
