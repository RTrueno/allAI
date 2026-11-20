'use strict';
const APP_URL = 'https://allai-library-ruslan.rainyhedgehog.chatgpt.site/';
const APP_ORIGIN = new URL(APP_URL).origin;
const AUTH_HOSTS = new Set(['auth.openai.com', 'chatgpt.com', 'www.chatgpt.com', 'accounts.google.com', 'appleid.apple.com', 'login.live.com', 'login.microsoftonline.com']);
function safeHTTPS(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443'); } catch { return false; }
}
function internalURL(value) {
  if (!safeHTTPS(value)) return false;
  const u = new URL(value);
  return u.origin === APP_ORIGIN || AUTH_HOSTS.has(u.hostname);
}
function boundsFromSaved(saved, displays) {
  const width = Math.max(860, Math.min(2400, Number.isFinite(saved?.width) ? saved.width : 1320));
  const height = Math.max(620, Math.min(1800, Number.isFinite(saved?.height) ? saved.height : 880));
  const result = { width: Math.round(width), height: Math.round(height) };
  if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y) && displays.some(d => saved.x + 100 > d.x && saved.x < d.x + d.width - 100 && saved.y + 100 > d.y && saved.y < d.y + d.height - 100)) {
    result.x = Math.round(saved.x); result.y = Math.round(saved.y);
  }
  return result;
}
function loadError(code) {
  if ([-105, -106, -109, -118, -137].includes(code)) return 'Не удалось подключиться. Проверь интернет и попробуй снова.';
  if ([-200, -201, -202, -203, -204, -206, -207].includes(code)) return 'Не удалось подтвердить защищённое соединение с сайтом. Проверь дату на компьютере и подключение к сети.';
  return 'Сайт временно недоступен. Попробуй подключиться ещё раз.';
}
module.exports = { APP_URL, APP_ORIGIN, safeHTTPS, internalURL, boundsFromSaved, loadError };
