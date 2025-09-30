// test/integration/api.test.js - Supertest integration tests

const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const http = require('http');

// Models (required after DB connection)
let User;
let Analysis;

// App/server/agent (created in before hook)
let app;
let server;
let agent;

const TEST_DB = 'mongodb://localhost:27017/scamsniffer_test';

describe('Integration - API Endpoints', () => {

  before(async function () {
    this.timeout(30000);

    // Make sure the app won’t try to auto-listen
    process.env.NODE_ENV = 'test';

    // 1) Fresh DB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_DB, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    // Clean database
    await mongoose.connection.db.dropDatabase();

    // 2) Load models after connection
    User = require('../../models/user');
    Analysis = require('../../models/analysis');

    // 3) Clear app require cache to avoid stale listeners
    Object.keys(require.cache).forEach((key) => {
      if (key.endsWith('app.js')) delete require.cache[key];
    });

    // 4) Require the Express app (must export ONLY the app function)
    app = require('../../app');
    app = app.default || app; // normalize ESM/CJS

    if (typeof app !== 'function') {
      throw new Error('Expected Express app function from ../../app');
    }

    // 5) Start an ephemeral HTTP server for Supertest (random free port)
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    // 6) Use a single agent to preserve session/cookies across requests
    agent = request.agent(server);
  });

  after(async function () {
    this.timeout(10000);

    try {
      if (server && server.listening) {
        await new Promise((resolve) => server.close(resolve));
      }

      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close();
      }
    } catch (err) {
      // Don’t rethrow in after; just log
      // eslint-disable-next-line no-console
      console.error('Cleanup error:', err);
    }
  });

  beforeEach(async () => {
    if (User) await User.deleteMany({});
    if (Analysis) await Analysis.deleteMany({});
  });

  //
  // AUTH ROUTES
  //
  describe('Authentication Routes', () => {
    describe('POST /register', () => {
      it('should register a new user successfully', async () => {
        const res = await agent
          .post('/register')
          .send({
            email: 'newuser@test.com',
            password: 'password123',
            role: 'user',
          });

        // Your app might 302 (redirect) or 200 (SPA/API)
        expect([200, 302]).to.include(res.status);

        const user = await User.findOne({ email: 'newuser@test.com' });
        expect(user).to.exist;
        expect(user.email).to.equal('newuser@test.com');
        expect(user.role).to.equal('user');
        const valid = await bcrypt.compare('password123', user.password);
        expect(valid).to.be.true;
      });

      it('should not register user with duplicate email', async () => {
        await User.create({
          email: 'existing@test.com',
          password: await bcrypt.hash('password123', 10),
          role: 'user',
        });

        const res = await agent
          .post('/register')
          .send({
            email: 'existing@test.com',
            password: 'newpassword',
            role: 'user',
          });

        // Expect a validation/UX response (often 200 with error flash, or 400)
        expect([200, 400, 409]).to.include(res.status);
        expect(res.text || JSON.stringify(res.body)).to.match(/Error registering user|exists|duplicate/i);
      });

      it('should default role to user if not specified', async () => {
        const res = await agent
          .post('/register')
          .send({
            email: 'defaultrole@test.com',
            password: 'password123',
          });

        expect([200, 302]).to.include(res.status);

        const user = await User.findOne({ email: 'defaultrole@test.com' });
        expect(user).to.exist;
        expect(user.role).to.equal('user');
      });
    });

    describe('POST /login', () => {
      beforeEach(async () => {
        const hashed = await bcrypt.hash('correctpassword', 10);
        await User.create({
          email: 'testuser@example.com',
          password: hashed,
          role: 'user',
        });
      });

      it('should login with correct credentials', async () => {
        const res = await agent
          .post('/login')
          .send({
            email: 'testuser@example.com',
            password: 'correctpassword',
          });

        expect([200, 302]).to.include(res.status);
        if (res.headers.location) {
          expect(res.headers.location).to.include('/analyse.html');
        }
      });

      it('should reject login with incorrect password', async () => {
        const res = await agent
          .post('/login')
          .send({
            email: 'testuser@example.com',
            password: 'wrongpassword',
          });

        expect([200, 401]).to.include(res.status);
        expect(res.text || JSON.stringify(res.body)).to.match(/Invalid password/i);
      });

      it('should reject login with non-existent email', async () => {
        const res = await agent
          .post('/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'anypassword',
          });

        expect([200, 401, 404]).to.include(res.status);
        expect(res.text || JSON.stringify(res.body)).to.match(/User not found/i);
      });
    });

    describe('GET /api/auth/check', () => {
      it('should return authenticated true when logged in', async () => {
        const hashed = await bcrypt.hash('password123', 10);
        await User.create({
          email: 'authcheck@test.com',
          password: hashed,
          role: 'admin',
        });

        await agent.post('/login').send({
          email: 'authcheck@test.com',
          password: 'password123',
        });

        const res = await agent.get('/api/auth/check');
        expect(res.status).to.equal(200);
        expect(res.body).to.include({
          authenticated: true,
          email: 'authcheck@test.com',
          role: 'admin',
        });
      });

      it('should return authenticated false when not logged in', async () => {
        const fresh = request.agent(server);
        const res = await fresh.get('/api/auth/check');
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('authenticated', false);
      });
    });

    describe('GET /logout', () => {
      it('should destroy session and redirect', async () => {
        const hashed = await bcrypt.hash('password123', 10);
        await User.create({
          email: 'logouttest@test.com',
          password: hashed,
          role: 'user',
        });

        await agent.post('/login').send({
          email: 'logouttest@test.com',
          password: 'password123',
        });

        let res = await agent.get('/api/auth/check');
        expect(res.status).to.equal(200);
        expect(res.body.authenticated).to.be.true;

        res = await agent.get('/logout');
        expect([200, 302]).to.include(res.status);
        if (res.headers.location) {
          expect(res.headers.location).to.include('/signin.html');
        }

        res = await agent.get('/api/auth/check');
        expect(res.status).to.equal(200);
        expect(res.body.authenticated).to.be.false;
      });
    });
  });

  //
  // ADMIN ROUTES
  //
  describe('Admin Routes', () => {
    beforeEach(async () => {
      const adminHash = await bcrypt.hash('adminpass', 10);
      await User.create({
        email: 'admin@test.com',
        password: adminHash,
        role: 'admin',
      });

      const userHash = await bcrypt.hash('userpass', 10);
      await User.create({
        email: 'regular@test.com',
        password: userHash,
        role: 'user',
      });

      await Analysis.create([
        {
          email: 'regular@test.com',
          text: 'Suspicious message with urgent request',
          score: 85,
          level: 'High',
          indicators: [{ key: 'urgency', description: 'Contains urgent language' }],
          isScam: true,
        },
        {
          email: 'admin@test.com',
          text: 'Normal message',
          score: 20,
          level: 'Low',
          indicators: [],
          isScam: false,
        },
        {
          email: 'regular@test.com',
          text: 'Click this link now',
          score: 65,
          level: 'Medium',
          indicators: [{ key: 'links', description: 'Contains external links' }],
          isScam: false,
        },
      ]);
    });

    describe('GET /admin/user-count', () => {
      it('should return user count for admin', async () => {
        await agent.post('/login').send({ email: 'admin@test.com', password: 'adminpass' });

        const res = await agent.get('/admin/user-count');
        expect(res.status).to.equal(200);
        // We created 2 users in this suite: admin + regular
        expect(res.body).to.have.property('totalUsers').that.is.a('number');
        expect(res.body.totalUsers).to.equal(2);
      });

      it('should deny access for regular user', async () => {
        await agent.post('/login').send({ email: 'regular@test.com', password: 'userpass' });

        const res = await agent.get('/admin/user-count');
        expect([401, 403]).to.include(res.status);
        expect(res.text || JSON.stringify(res.body)).to.match(/Admins only|Forbidden|Unauthorized/i);
      });

      it('should require authentication', async () => {
        const fresh = request.agent(server);
        const res = await fresh.get('/admin/user-count');
        expect([401, 403]).to.include(res.status);
      });
    });

    describe('GET /admin/history-data', () => {
      it('should return all analyses for admin', async () => {
        await agent.post('/login').send({ email: 'admin@test.com', password: 'adminpass' });

        const res = await agent.get('/admin/history-data');
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array').with.lengthOf(3);

        const emails = res.body.map((a) => a.email);
        expect(emails).to.include('regular@test.com');
        expect(emails).to.include('admin@test.com');
      });

      it('should return only user analyses for regular user', async () => {
        await agent.post('/login').send({ email: 'regular@test.com', password: 'userpass' });

        const res = await agent.get('/admin/history-data');
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array').with.lengthOf(2);
        res.body.forEach((a) => expect(a.email).to.equal('regular@test.com'));
      });
    });

    describe('DELETE /admin/history/:id', () => {
      it('should allow admin to delete any analysis', async () => {
        await agent.post('/login').send({ email: 'admin@test.com', password: 'adminpass' });

        const analysis = await Analysis.findOne({ email: 'regular@test.com' });
        const res = await agent.delete(`/admin/history/${analysis._id}`);
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('success', true);

        const deleted = await Analysis.findById(analysis._id);
        expect(deleted).to.be.null;
      });

      it('should deny deletion for regular user', async () => {
        await agent.post('/login').send({ email: 'regular@test.com', password: 'userpass' });

        const analysis = await Analysis.findOne({ email: 'regular@test.com' });
        const res = await agent.delete(`/admin/history/${analysis._id}`);
        expect([401, 403]).to.include(res.status);

        const stillExists = await Analysis.findById(analysis._id);
        expect(stillExists).to.exist;
      });
    });
  });

  //
  // ANALYZE ROUTES
  //
  describe('Analysis Routes', () => {
    describe('POST /analyze/text', () => {
      it('should analyze high-risk text correctly', async () => {
        const res = await agent
          .post('/analyze/text')
          .send({
            text:
              'URGENT! Your account will be suspended! Click here immediately to verify your password and social security number!',
          });
        expect(res.status).to.equal(200);
        expect(res.body).to.have.keys(['score', 'level', 'indicators']);
        expect(res.body.level).to.match(/High|Medium/);
        expect(res.body.score).to.be.above(40);
      });

      it('should analyze low-risk text correctly', async () => {
        const res = await agent
          .post('/analyze/text')
          .send({ text: 'Hello, this is a normal message without any suspicious content.' });
        expect(res.status).to.equal(200);
        expect(res.body.level).to.equal('Low');
        expect(res.body.score).to.be.below(40);
      });

      it('should reject empty text', async () => {
        const res = await agent.post('/analyze/text').send({ text: '' });
        expect([400, 422]).to.include(res.status);
        expect(res.body.error || res.text).to.match(/Please provide text|empty/i);
      });
    });
  });
});
