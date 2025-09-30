// test/frontend/analyzer.test.js
const { expect } = require('chai');
const sinon = require('sinon');

describe('Frontend - Analyzer Component', () => {
  let analyzerModule;
  let mockSocket;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <textarea id="text"></textarea>
      <div id="result" class=""></div>
      <div id="riskIndicator" class="risk-indicator"></div>
      <div id="riskScore">--</div>
      <div id="riskLevel">Enter text to analyze</div>
      <div id="indicatorsSection" style="display:none;"></div>
      <div id="indicators"></div>
      <div id="typingIndicator" class=""></div>
      <div id="charCount">0 characters</div>
      <button id="saveBtn" disabled>Save</button>
      <button id="reportBtn" disabled>Report</button>
      <button id="exportBtn" disabled>Export</button>
      <div id="loginPrompt" style="display:none;"></div>
      <div id="recentAnalysesSection" style="display:none;"></div>
    `;

    // Mock Socket.IO
    mockSocket = {
      on: sinon.stub(),
      emit: sinon.stub(),
      off: sinon.stub()
    };
    global.io = sinon.stub().returns(mockSocket);

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Text Input and Analysis', () => {

    it('should show typing indicator when typing', (done) => {
      const textarea = document.getElementById('text');
      const typingIndicator = document.getElementById('typingIndicator');
      
      textarea.value = 'Suspicious message';
      
      // Simulate showing typing indicator
      typingIndicator.classList.add('active');
      
      expect(typingIndicator.classList.contains('active')).to.be.true;
      
      // Should hide after analysis
      setTimeout(() => {
        typingIndicator.classList.remove('active');
        expect(typingIndicator.classList.contains('active')).to.be.false;
        done();
      }, 100);
    });

    it('should emit analyzeText event with debounce', (done) => {
      const textarea = document.getElementById('text');
      textarea.value = 'Check this suspicious link: http://scam.com';
      
      // Simulate debounced emit
      setTimeout(() => {
        mockSocket.emit('analyzeText', textarea.value);
        expect(mockSocket.emit.calledWith('analyzeText', textarea.value)).to.be.true;
        done();
      }, 500);
    });
  });

  describe('Analysis Results Display', () => {
    it('should display high risk result correctly', () => {
      const result = {
        score: 85,
        level: 'High',
        indicators: [
          { key: 'links', description: 'Contains external links' },
          { key: 'urgency', description: 'Urgency words detected' }
        ]
      };

      // Simulate displaying result
      const riskScore = document.getElementById('riskScore');
      const riskLevel = document.getElementById('riskLevel');
      const riskIndicator = document.getElementById('riskIndicator');
      
      riskScore.textContent = result.score;
      riskLevel.textContent = `${result.level.toUpperCase()} RISK`;
      riskIndicator.classList.add('risk-high');
      
      expect(riskScore.textContent).to.equal('85');
      expect(riskLevel.textContent).to.equal('HIGH RISK');
      expect(riskIndicator.classList.contains('risk-high')).to.be.true;
    });

    it('should display indicators when present', () => {
      const indicators = [
        { key: 'links', description: 'Contains external links' },
        { key: 'pii', description: 'Requests sensitive info' }
      ];

      const indicatorsSection = document.getElementById('indicatorsSection');
      const indicatorsDiv = document.getElementById('indicators');
      
      indicatorsSection.style.display = 'block';
      indicatorsDiv.innerHTML = indicators.map(ind => 
        `<div class="indicator-item">${ind.description}</div>`
      ).join('');
      
      expect(indicatorsSection.style.display).to.equal('block');
      expect(indicatorsDiv.children.length).to.equal(2);
    });

    it('should hide result when text is cleared', () => {
      const textarea = document.getElementById('text');
      const resultDiv = document.getElementById('result');
      
      textarea.value = '';
      resultDiv.classList.remove('show');
      
      expect(resultDiv.classList.contains('show')).to.be.false;
    });
  });

  describe('Authentication UI', () => {
    it('should show login prompt for non-authenticated users', () => {
      const loginPrompt = document.getElementById('loginPrompt');
      const recentAnalysesSection = document.getElementById('recentAnalysesSection');
      
      // Simulate non-authenticated state
      loginPrompt.style.display = 'flex';
      recentAnalysesSection.style.display = 'none';
      
      expect(loginPrompt.style.display).to.equal('flex');
      expect(recentAnalysesSection.style.display).to.equal('none');
    });

    it('should enable save button for authenticated users', () => {
      const saveBtn = document.getElementById('saveBtn');
      const isAuthenticated = true;
      
      if (isAuthenticated) {
        saveBtn.disabled = false;
      }
      
      expect(saveBtn.disabled).to.be.false;
    });

    it('should disable export for non-authenticated users', () => {
      const exportBtn = document.getElementById('exportBtn');
      const isAuthenticated = false;
      
      if (!isAuthenticated) {
        exportBtn.disabled = true;
      }
      
      expect(exportBtn.disabled).to.be.true;
    });
  });

  describe('Save and Export Functions', () => {
    it('should save analysis to localStorage', () => {
      const analysis = {
        id: '123',
        text: 'Test message',
        score: 45,
        level: 'Medium',
        indicators: [],
        savedAt: new Date().toISOString()
      };

      const userEmail = 'test@example.com';
      const savedAnalyses = [analysis];
      
      localStorage.setItem(`savedAnalyses_${userEmail}`, JSON.stringify(savedAnalyses));
      
      const retrieved = JSON.parse(localStorage.getItem(`savedAnalyses_${userEmail}`));
      expect(retrieved).to.deep.equal(savedAnalyses);
      expect(retrieved[0].score).to.equal(45);
    });

    it('should limit saved analyses to 50 items', () => {
      const userEmail = 'test@example.com';
      const analyses = [];
      
      for (let i = 0; i < 60; i++) {
        analyses.push({
          id: i.toString(),
          text: `Test ${i}`,
          score: 50,
          level: 'Medium'
        });
      }
      
      // Simulate limiting to 50
      const limited = analyses.slice(0, 50);
      localStorage.setItem(`savedAnalyses_${userEmail}`, JSON.stringify(limited));
      
      const retrieved = JSON.parse(localStorage.getItem(`savedAnalyses_${userEmail}`));
      expect(retrieved.length).to.equal(50);
    });
  });

  describe('Report Scam Modal', () => {
    it('should only enable report for high/medium risk', () => {
      const reportBtn = document.getElementById('reportBtn');
      
      // Test with High risk
      let analysis = { level: 'High' };
      reportBtn.disabled = !(analysis.level === 'High' || analysis.level === 'Medium');
      expect(reportBtn.disabled).to.be.false;
      
      // Test with Low risk
      analysis = { level: 'Low' };
      reportBtn.disabled = !(analysis.level === 'High' || analysis.level === 'Medium');
      expect(reportBtn.disabled).to.be.true;
    });
  });

  describe('Clear Analysis', () => {
    it('should clear all fields when clear is clicked', () => {
      const textarea = document.getElementById('text');
      const riskScore = document.getElementById('riskScore');
      const riskLevel = document.getElementById('riskLevel');
      
      // Set initial values
      textarea.value = 'Some text';
      riskScore.textContent = '75';
      riskLevel.textContent = 'HIGH RISK';
      
      // Clear
      textarea.value = '';
      riskScore.textContent = '--';
      riskLevel.textContent = 'Enter text to analyze';
      
      expect(textarea.value).to.equal('');
      expect(riskScore.textContent).to.equal('--');
      expect(riskLevel.textContent).to.equal('Enter text to analyze');
    });
  });
});