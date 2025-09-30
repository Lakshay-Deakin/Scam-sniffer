const express = require("express");
const sanitizeHtml = require("sanitize-html");
const analyzeText = require("../utils/analyzer");
const Analysis = require("../models/analysis");
const { isAuthenticated } = require("../utils/auth");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const upload = multer({ dest: "uploads/" });

module.exports = function (io) {
  const router = express.Router();

  let activeUsers = 0;
  let recentPhrases = [];

  function extractKeywords(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  // --------------------
  // Socket.io handling
  // --------------------
  io.on("connection", (socket) => {
    activeUsers++;
    console.log("User connected. Active users:", activeUsers);

    // Send user count & notify only on connection
    io.emit("userCount", activeUsers);
    io.emit("notification", {
      message: `${activeUsers} users are currently online!`,
    });

    socket.on("analyzeText", async (data) => {
      const rawText = typeof data === "string" ? data : data.text;
      const email = data.email || null;

      const text = sanitizeHtml(rawText, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();
      if (!text) return;

      const normalized = text.toLowerCase();

      recentPhrases.push({
        text: normalized,
        socketId: socket.id,
        timestamp: Date.now(),
      });

      // keep only last 60 seconds
      recentPhrases = recentPhrases.filter(
        (p) => Date.now() - p.timestamp < 60000
      );

      const newKeywords = extractKeywords(normalized);
      const matches = recentPhrases.filter((p) => {
        if (p.socketId === socket.id) return false;
        const otherKeywords = extractKeywords(p.text);
        const common = newKeywords.filter((word) =>
          otherKeywords.includes(word)
        );
        return common.length >= 2;
      });

      // 👉 Only scam phrase notification here
      if (matches.length > 0) {
        io.emit("notification", {
          message: `Similar scammy phrase detected: "${rawText}"`,
          phrase: rawText,
          count: matches.length + 1,
          examples: matches.map((m) => m.text),
        });
      }

      // Analyze text
      const result = analyzeText(text);
      const indicators = Array.isArray(result.indicators)
        ? result.indicators.map((ind) =>
            typeof ind === "string" ? { key: "", description: ind } : ind
          )
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
            isScam,
          });
          await analysisDoc.save();
        } catch (err) {
          console.error("Failed to save analysis to DB:", err);
        }
      }

      socket.emit("analysisResult", { ...result, isScam, indicators });
      io.emit("newAnalysis", { text, ...result, isScam, indicators });
    });

    socket.on("disconnect", () => {
      activeUsers--;
      console.log("User disconnected. Active users:", activeUsers);

      // Send user count & notify only on disconnect
      io.emit("userCount", activeUsers);
      io.emit("notification", {
        message: `${activeUsers} users are currently online!`,
      });
    });
  });

  // --------------------
  // Legacy /text POST route
  // --------------------
  router.post("/text", async (req, res) => {
    try {
      const raw = req.body.text || "";
      const email = req.body.email || null;
      const text = sanitizeHtml(raw, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();
      if (!text) return res.status(400).json({ error: "Please provide text" });

      const result = analyzeText(text);
      const indicators = Array.isArray(result.indicators)
        ? result.indicators.map((ind) =>
            typeof ind === "string" ? { key: "", description: ind } : ind
          )
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
            isScam,
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

  // --------------------
  // GET /history
  // --------------------
  router.get("/history", isAuthenticated, async (req, res) => {
    try {
      const userEmail = res.locals.user?.email;
      if (!userEmail) return res.status(401).json({ error: "Unauthorized" });
      const userRole = res.locals.user?.role;

      let query = {};
      if (userRole !== "admin") {
        query.email = userEmail;
      }

      const analyses = await Analysis.find(query)
        .sort({ createdAt: -1 })
        .limit(50);

      res.json(
        analyses.map((a) => ({
          id: a._id,
          text: a.text,
          score: a.score,
          level: a.level,
          indicators: a.indicators,
          savedAt: a.createdAt,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // --------------------
  // Import Excel, analyze, return new Excel
  // --------------------
  router.post("/import-excel", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const analysed = rows.map((row) => {
        const raw = String(row.message || "").trim();
        const text = sanitizeHtml(raw, {
          allowedTags: [],
          allowedAttributes: {},
        });
        const result = analyzeText(text);

        const indicators = Array.isArray(result.indicators)
          ? result.indicators.map((ind) =>
              typeof ind === "string" ? ind : ind.description
            )
          : [];

        return {
          ...row,
          Score: result.score,
          Level: result.level,
          IsScam: result.score > 50 ? "Yes" : "No",
          Indicators: indicators.join(", "),
        };
      });

      const newSheet = xlsx.utils.json_to_sheet(analysed);
      workbook.Sheets[sheetName] = newSheet;

      const outputPath = path.join(
        __dirname,
        "../uploads",
        `results-${Date.now()}.xlsx`
      );
      xlsx.writeFile(workbook, outputPath);

      res.download(outputPath, "analysis-results.xlsx", () => {
        fs.unlinkSync(req.file.path);
        fs.unlinkSync(outputPath);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  return router;
};
