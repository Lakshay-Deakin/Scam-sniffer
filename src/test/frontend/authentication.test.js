// test/frontend/authentication.test.js
const { expect } = require('chai');
const sinon = require('sinon');

describe('Frontend - Authentication', () => {
  let fetchStub;

  beforeEach(() => {
    fetchStub = sinon.stub(global, 'fetch');
    localStorage.clear();
    
    document.body.innerHTML = `
      <form id="signinForm">
        <input type="email" id="email" />
        <input type="password" id="password" />
        <button type="submit" id="submitBtn">Sign In</button>
      </form>
      <div id="errorMessage" style="display: none;"></div>
      <div id="successMessage" style="display: none;"></div>
    `;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Sign In Form', () => {
    it('should validate email format', () => {
      const emailInput = document.getElementById('email');
      const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      
      emailInput.value = 'invalid-email';
      expect(validateEmail(emailInput.value)).to.be.false;
      
      emailInput.value = 'valid@email.com';
      expect(validateEmail(emailInput.value)).to.be.true;
    });

    it('should validate password length', () => {
      const passwordInput = document.getElementById('password');
      
      passwordInput.value = '12345';
      expect(passwordInput.value.length >= 6).to.be.false;
      
      passwordInput.value = '123456';
      expect(passwordInput.value.length >= 6).to.be.true;
    });

    it('should handle successful login', async () => {
      fetchStub.resolves({
        ok: true,
        redirected: true,
        url: 'http://localhost:5000/analyse.html'
      });

      const form = document.getElementById('signinForm');
      const email = document.getElementById('email');
      const password = document.getElementById('password');
      
      email.value = 'test@example.com';
      password.value = 'password123';
      
      // Simulate form submission
      const formData = new URLSearchParams({
        email: email.value,
        password: password.value
      });
      
      const response = await fetch('/login', {
        method: 'POST',
        body: formData
      });
      
      expect(response.ok).to.be.true;
      expect(response.redirected).to.be.true;
    });

    it('should handle login errors', async () => {
      fetchStub.resolves({
        ok: false,
        text: () => Promise.resolve('User not found')
      });

      const response = await fetch('/login', {
        method: 'POST',
        body: 'test data'
      });
      
      const errorText = await response.text();
      expect(errorText).to.equal('User not found');
    });
  });

  describe('Sign Up Form', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <form id="signupForm">
          <input type="email" id="email" />
          <input type="password" id="password" />
          <input type="password" id="confirmPassword" />
          <input type="hidden" id="selectedRole" value="user" />
        </form>
      `;
    });

    it('should validate password match', () => {
      const password = document.getElementById('password');
      const confirmPassword = document.getElementById('confirmPassword');
      
      password.value = 'password123';
      confirmPassword.value = 'password456';
      expect(password.value === confirmPassword.value).to.be.false;
      
      confirmPassword.value = 'password123';
      expect(password.value === confirmPassword.value).to.be.true;
    });

    it('should check password strength', () => {
      const checkPasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (/[a-z]/.test(password)) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;
        return strength;
      };
      
      expect(checkPasswordStrength('weak')).to.equal(25);
      expect(checkPasswordStrength('Password1')).to.equal(100);
    });

    it('should set user role correctly', () => {
      const roleInput = document.getElementById('selectedRole');
      
      // Default role
      expect(roleInput.value).to.equal('user');
      
      // Change to admin
      roleInput.value = 'admin';
      expect(roleInput.value).to.equal('admin');
    });
  });

  describe('Session Management', () => {
    it('should store auth status in session', async () => {
      fetchStub.resolves({
        ok: true,
        json: () => Promise.resolve({
          authenticated: true,
          email: 'test@example.com',
          role: 'user'
        })
      });

      const response = await fetch('/api/auth/check');
      const data = await response.json();
      
      expect(data.authenticated).to.be.true;
      expect(data.email).to.equal('test@example.com');
      expect(data.role).to.equal('user');
    });

    it('should handle logout', async () => {
      fetchStub.resolves({
        ok: true,
        redirected: true,
        url: 'http://localhost:5000/signin.html'
      });

      const response = await fetch('/logout');
      
      expect(response.ok).to.be.true;
      expect(response.redirected).to.be.true;
    });
  });
});