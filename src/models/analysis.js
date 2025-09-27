const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  email: { type: String, required: true },
  text: { type: String, required: true },
  score: { type: Number, required: true },
  level: { type: String, required: true },
  indicators: [{
    key: String,
    description: String
  }],
  isScam: { type: Boolean, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Analysis", analysisSchema);

