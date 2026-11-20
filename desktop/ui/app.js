document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', event => {
  event.preventDefault(); window.allAI.action(el.dataset.action);
}));
function update(state) {
  if (!state) return;
  document.getElementById('status-label').textContent = state.status === 'ready' ? 'Подключено' : state.status === 'offline' ? 'Нет соединения' : 'Подключение…';
  document.getElementById('status-dot').className = state.status;
  document.getElementById('message').textContent = state.message;
  document.getElementById('back').disabled = !state.canGoBack;
  document.getElementById('forward').disabled = !state.canGoForward;
  document.getElementById('version').textContent = state.version;
  document.getElementById('retry').textContent = state.status === 'loading' ? 'Подключиться снова' : 'Подключиться';
}
window.allAI.onState(update);
window.allAI.getState().then(update);
