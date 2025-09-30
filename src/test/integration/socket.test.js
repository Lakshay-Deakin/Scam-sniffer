const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const http = require('http');

describe('Integration - Socket.IO', () => {
  let server;
  let serverSocket;
  let clientSocket;
  let httpServer;

  before((done) => {
    httpServer = http.createServer();
    server = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      server.on('connection', (socket) => {
        serverSocket = socket;
        
        // Simulate the analyze route behavior
        socket.on('analyzeText', (text) => {
          // Simple mock analysis
          const result = {
            score: text.includes('scam') ? 80 : 20,
            level: text.includes('scam') ? 'High' : 'Low',
            indicators: text.includes('scam') ? 
              [{ key: 'suspicious', description: 'Suspicious content detected' }] : []
          };
          
          socket.emit('analysisResult', result);
        });
      });

      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  after(() => {
    server.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('Real-time Analysis', () => {
    it('should emit and receive analysis results', (done) => {
      clientSocket.on('analysisResult', (result) => {
        expect(result).to.have.property('score');
        expect(result).to.have.property('level');
        expect(result.score).to.equal(80);
        expect(result.level).to.equal('High');
        done();
      });

      clientSocket.emit('analyzeText', 'This is a scam message');
    });

   

    it('should broadcast user count updates', (done) => {
      let activeUsers = 0;
      
      server.emit('userCount', 5);
      
      clientSocket.on('userCount', (count) => {
        expect(count).to.equal(5);
        done();
      });
    });
  });

  describe('Connection Handling', () => {
    it('should handle disconnect gracefully', (done) => {
      const tempClient = Client(`http://localhost:${httpServer.address().port}`);
      
      tempClient.on('connect', () => {
        tempClient.disconnect();
        
        setTimeout(() => {
          expect(tempClient.connected).to.be.false;
          done();
        }, 100);
      });
    });

    
  });
});
