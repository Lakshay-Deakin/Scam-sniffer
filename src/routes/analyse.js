const express = require("express");
const sanitizeHtml = require("sanitize-html");
const analyzeText = require("../utils/analyzer");
const Analysis = require("../models/analysis"); // your Mongoose model
const { isAuthenticated } = require('../utils/auth');


module.exports = function (io) {
  const router = express.Router();

  let activeUsers = 0;

  // --------------------
  // Socket.io handling
  // --------------------

  let recentPhrases = [];

  function extractKeywords(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")   // remove punctuation
      .split(/\s+/)                  // split into words
      .filter(word => word.length > 2); // remove very short words
  }

  io.on("connection", (socket) => {
    activeUsers++;
    console.log("User connected. Active users:", activeUsers);

    io.emit("userCount", activeUsers);

    if (activeUsers >= 2) {
      io.emit("notification", { message: `${activeUsers} users are currently online!` });
    }

    socket.on("analyzeText", async (data) => {
      // data can be string or object { text, email }
      const rawText = typeof data === "string" ? data : data.text;
      const email = data.email || null;

      const text = sanitizeHtml(rawText, { allowedTags: [], allowedAttributes: {} }).trim();
      if (!text) return;

      const normalized = text.toLowerCase();

      recentPhrases.push({ text: normalized, socketId: socket.id, timestamp: Date.now() });

      // Remove old phrases
      recentPhrases = recentPhrases.filter(p => Date.now() - p.timestamp < 60000);
      const newKeywords = extractKeywords(normalized);

      // find phrases from other users with keyword overlap
      const matches = recentPhrases.filter(p => {
        if (p.socketId === socket.id) return false; // skip self
        const otherKeywords = extractKeywords(p.text);
        const common = newKeywords.filter(word => otherKeywords.includes(word));
        return common.length >= 2; // threshold: at least 2 words in common
      });

      console.log(matches.length,'------------+++++++++++')
      if (activeUsers >= 2) {
      io.emit("notification", { message: `${activeUsers} users are currently online!` });
    }
      if (matches.length > 0) {
        io.emit("notification", {
          message: `Similar scammy phrase detected: "${rawText}"`,
          phrase: rawText,
          count: matches.length + 1,
          examples: matches.map(m => m.text) // optional, for debugging
        });
      }


      // Analyze text
      const result = analyzeText(text);

      // Ensure indicators is an array of objects
      const indicators = Array.isArray(result.indicators)
        ? result.indicators.map(ind => {
          if (typeof ind === "string") return { key: "", description: ind };
          return ind;
        })
        : [];

      // Mark as scam if score > 50
      const isScam = result.score > 50;

      // Save to MongoDB if email exists
      if (email) {
        try {
          const analysisDoc = new Analysis({
            email,
            text,
            score: result.score,
            level: result.level,
            indicators,
            isScam
          });
          await analysisDoc.save();
        } catch (err) {
          console.error("Failed to save analysis to DB:", err);
        }
      }

      // Send result to client
      socket.emit("analysisResult", { ...result, isScam, indicators });

      // Optional: broadcast new analysis to admins
      io.emit("newAnalysis", { text, ...result, isScam, indicators });
    });

    socket.on("phraseNotification", (data) => {
      M.toast({
        html: `${data.count} user(s) typed the same phrase: "${data.phrase}"`,
        classes: "orange"
      });
    });

    socket.on("disconnect", () => {
      activeUsers--;
      console.log("User disconnected. Active users:", activeUsers);
      io.emit("userCount", activeUsers);
    });
  });

  // --------------------
  // Legacy /text POST route
  // --------------------
  router.post("/text", async (req, res) => {
    try {
      const raw = req.body.text || "";
      const email = req.body.email || null;
      const text = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} }).trim();
      if (!text) return res.status(400).json({ error: "Please provide text" });

      const result = analyzeText(text);

      const indicators = Array.isArray(result.indicators)
        ? result.indicators.map(ind => {
          if (typeof ind === "string") return { key: "", description: ind };
          return ind;
        })
        : [];

      const isScam = result.score > 50;

      if (email) {
        try {
          const analysisDoc = new Analysis({
            email,
            text,
            score: result.score,
            level: result.level,
            indicators,
            isScam
          });
          await analysisDoc.save();
        } catch (err) {
          console.error("Failed to save analysis to DB:", err);
        }
      }

      io.emit("newAnalysis", { text, ...result, isScam, indicators });

      res.json({ ...result, isScam, indicators });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  router.get('/history', isAuthenticated, async (req, res) => {
    try {
      const userEmail = res.locals.user?.email;
      if (!userEmail) return res.status(401).json({ error: 'Unauthorized' });
      const userRole = res.locals.user?.role;

      let query = {};
      if (userRole !== 'admin') {
        // regular user → only their own analyses
        query.email = userEmail;
      }

      const analyses = await Analysis.find(query)
        .sort({ createdAt: -1 })
        .limit(50);

      res.json(analyses.map(a => ({
        id: a._id,
        text: a.text,
        score: a.score,
        level: a.level,
        indicators: a.indicators,
        savedAt: a.createdAt
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  return router;
};
