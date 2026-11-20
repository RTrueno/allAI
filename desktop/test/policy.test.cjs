const test = require('node:test');
const assert = require('node:assert/strict');
const { APP_URL, safeHTTPS, internalURL, boundsFromSaved, loadError } = require('../policy.cjs');
test('app and explicit authentication origins stay inside the isolated view', () => {
  assert.equal(internalURL(APP_URL), true);
  assert.equal(internalURL('https://auth.openai.com/log-in'), true);
  assert.equal(internalURL('https://accounts.google.com/o/oauth2/auth'), true);
  for (const url of ['https://auth.openai.com.evil.test/', 'https://evil.test/auth.openai.com', 'https://auth.openai.com@evil.test/', 'https://auth.openai.com:8443/', 'file:///C:/Windows/', 'javascript:alert(1)', 'http://auth.openai.com']) assert.equal(internalURL(url), false, url);
});
test('external navigation permits only credential-free HTTPS URLs', () => {
  assert.equal(safeHTTPS('https://openrouter.ai/keys'), true);
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'https://user:password@example.test', 'http://example.test', 'not a URL']) assert.equal(safeHTTPS(url), false);
});
test('window bounds recover from malformed settings and disconnected monitors', () => {
  const displays = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  assert.deepEqual(boundsFromSaved(null, displays), { width: 1320, height: 880 });
  assert.deepEqual(boundsFromSaved({ x: 9000, y: 100, width: 1, height: Infinity }, displays), { width: 860, height: 880 });
  assert.deepEqual(boundsFromSaved({ x: 20, y: 30, width: 1200, height: 800 }, displays), { x: 20, y: 30, width: 1200, height: 800 });
});
test('network and certificate errors produce useful messages without disabling TLS', () => {
  assert.match(loadError(-106), /интернет/);
  assert.match(loadError(-202), /защищённое соединение/);
});
