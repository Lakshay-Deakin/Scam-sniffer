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
