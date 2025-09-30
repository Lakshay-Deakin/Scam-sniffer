// test/frontend/setup.js
const { JSDOM } = require('jsdom');

// --- JSDOM environment ---
const dom = new JSDOM(
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Test</title></head><body><div id="app"></div></body></html>`,
  {
    url: 'http://localhost:5000',
    pretendToBeVisual: true,
    resources: 'usable'
  }
);

global.window = dom.window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.Element = window.Element;

// --- Polyfills used by your app ---
if (!global.URL) global.URL = {};
if (typeof global.URL.createObjectURL !== 'function') {
  global.URL.createObjectURL = () => 'blob://mock';
}
if (typeof global.URL.revokeObjectURL !== 'function') {
  global.URL.revokeObjectURL = () => {};
}

if (typeof global.Blob === 'undefined') {
  try { global.Blob = require('buffer').Blob; } catch {}
}

// localStorage mock
global.localStorage = {
  data: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
  setItem(key, value) { this.data[key] = String(value); },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; }
};

// ✅ Node 18+: use built-in fetch and expose it to window
if (typeof global.fetch === 'function') {
  window.fetch = global.fetch.bind(global);
} else {
  throw new Error('Global fetch not available. Use Node 18+ or add a fetch polyfill.');
}

// Materialize mocks
const noop = () => {};
global.M = {
  toast: (options) => console.log('Toast:', typeof options === 'string' ? options : options?.html),
  Modal: {
    init: () => ({ open: noop, close: noop }),
    getInstance: () => ({ open: noop, close: noop })
  },
  Sidenav: {
    init: () => ({ open: noop, close: noop, isOpen: false })
  }
};
window.M = global.M;

// Socket.IO mock
global.io = () => ({ on: noop, emit: noop, off: noop });

module.exports = { dom };
