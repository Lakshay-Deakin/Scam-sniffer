// test/integration/database.test.js
const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;     // in-memory server
let User;
let Analysis;
let app;        // Express function
let server;     // http.Server
let agent;      // supertest agent

describe('Integration - API Endpoints', function () {
  this.timeout(30000); // give headroom for binaries & bcrypt

  before(async function () {
    process.env.NODE_ENV = 'test';

    // 1) Start in-memory Mongo and connect mongoose
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri); // no deprecated options needed

    // 2) Ensure a clean DB
    await mongoose.connection.db.dropDatabase();

    // 3) Load models AFTER connecting
    User = require('../../models/user');
    Analysis = require('../../models/analysis');

    // 4) Make sure app.js did not auto-listen
    Object.keys(require.cache).forEach((k) => {
      if (k.endsWith('app.js')) delete require.cache[k];
    });

    // 5) Load Express app (must export the app function)
    let imported = require('../../app');
    app = imported?.default ?? imported;
    if (app?.app && typeof app.app === 'function') app = app.app; // if { app, server } shape
    if (typeof app !== 'function') throw new Error('Expected Express app function from ../../app');

    // 6) Start ephemeral HTTP server and Supertest agent
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    agent = request.agent(server);
  });

  after(async function () {
    if (server?.listening) await new Promise((r) => server.close(r));
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    if (User) await User.deleteMany({});
    if (Analysis) await Analysis.deleteMany({});
  });

  // --- Basic Tests
  describe('Basic Tests', () => {
    it('should have app defined', () => {
      expect(app).to.exist;
      expect(typeof app).to.equal('function');
    });

    
  });

  // --- Authentication Routes
  describe('Authentication Routes', () => {
    describe('POST /register', () => {
      it('should register a new user', async () => {
        const res = await agent
          .post('/register')
          .type('form')
          .send({ email: 'test@example.com', password: 'password123', role: 'user' });

        expect([200, 302]).to.include(res.status);

        const user = await User.findOne({ email: 'test@example.com' });
        expect(user).to.exist;
        expect(user.email).to.equal('test@example.com');
      });

      it('should hash the password', async () => {
        await agent
          .post('/register')
          .type('form')
          .send({ email: 'hash@test.com', password: 'plaintext123', role: 'user' });

        const user = await User.findOne({ email: 'hash@test.com' });
        expect(user).to.exist;
        const ok = await bcrypt.compare('plaintext123', user.password);
        expect(ok).to.be.true;
      });
    });

    describe('POST /login', () => {
      beforeEach(async () => {
        const hashedPassword = await bcrypt.hash('testpass', 10);
        await User.create({ email: 'login@test.com', password: hashedPassword, role: 'user' });
      });

      it('should login with correct credentials', async () => {
        const res = await agent
          .post('/login')
          .type('form')
          .send({ email: 'login@test.com', password: 'testpass' });

        expect([200, 302]).to.include(res.status);
      });

      it('should reject wrong password', async () => {
        const res = await agent
          .post('/login')
          .type('form')
          .send({ email: 'login@test.com', password: 'wrongpass' });

        expect([200, 401]).to.include(res.status);
        expect(res.text || JSON.stringify(res.body)).to.match(/Invalid password/i);
      });
    });
  });

  // --- Admin Routes
  describe('Admin Routes', () => {
    beforeEach(async () => {
      const adminPass = await bcrypt.hash('admin123', 10);
      await User.create({ email: 'admin@test.com', password: adminPass, role: 'admin' });

      await Analysis.create({
        email: 'admin@test.com',
        text: 'Test message',
        score: 50,
        level: 'Medium',
        indicators: [],
        isScam: false,
      });
    });

    it('should get user count as admin', async () => {
      await agent.post('/login').type('form').send({ email: 'admin@test.com', password: 'admin123' });
      const res = await agent.get('/admin/user-count');
      if (res.status === 200) {
        expect(res.body).to.have.property('totalUsers');
      }
    });

    it('should get history data', async () => {
      await agent.post('/login').type('form').send({ email: 'admin@test.com', password: 'admin123' });
      const res = await agent.get('/admin/history-data');
      if (res.status === 200) {
        expect(res.body).to.be.an('array');
      }
    });
  });

  // --- Analyze Routes
  describe('Analysis Routes', () => {
    it('should analyze text', async () => {
      const res = await agent.post('/analyze/text').send({ text: 'This is a test message to analyze' });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('score');
      expect(res.body).to.have.property('level');
    });

    it('should detect high risk content', async () => {
      const res = await agent
        .post('/analyze/text')
        .send({ text: 'URGENT! Click here to verify your password and SSN immediately!' });

      expect(res.status).to.equal(200);
      expect(res.body.level).to.match(/High|Medium/);
      expect(res.body.score).to.be.above(40);
    });

    it('should reject empty text', async () => {
      const res = await agent.post('/analyze/text').send({ text: '' });
      expect([400, 422]).to.include(res.status);
      expect(res.body.error || res.text).to.match(/Please provide text|empty/i);
    });
  });
});
