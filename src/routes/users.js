// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');

// GET /users - return all users (email + role only)
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, 'email role').lean(); 
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
