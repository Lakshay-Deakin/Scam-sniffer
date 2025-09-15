// require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require('mongoose');
const session = require('express-session');
const http = require("http");

const app = express();
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "public")));

app.use(express.static('public'));

mongoose.connect('mongodb://localhost:27017/scam_sniffer', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error(err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false
}));

// Serve static HTML
app.use(express.static(path.join(__dirname, 'public')));

app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/public/signup.html');
});


// Routes

// REGISTER
const bcrypt = require('bcrypt');
const User = require('./models/user');

app.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10); // hash password
    const user = new User({ email, password: hashedPassword, role: role || 'user' });
    await user.save();
    req.session.userId = user._id;
    req.session.role = user.role;
    res.redirect('/analyse.html');
  } catch (err) {
    console.error(err);
    res.send('Error registering user. Maybe email already exists.');
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.send('User not found');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.send('Invalid password');
    }

    req.session.userId = user._id;
    req.session.role = user.role;
    res.redirect('/analyse.html');
  } catch (err) {
    console.error(err);
    res.send('Error logging in');
  }
});

// LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect('/login.html');
  });
});

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/index.html');
}

// Role-based middleware
function isAdmin(req, res, next) {
  console.log(req.session.role,'========================')
  if (req.session.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied. Admins only.');
}

app.get('/get/analyser', (req, res) => {
  res.sendFile(__dirname + '/public/analyse.html');
});

app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
  res.send('<h1>Welcome Admin!</h1>');
});



const analyzeRoutes = require('./routes/analyse')(io);
app.use('/analyze', analyzeRoutes);




const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
