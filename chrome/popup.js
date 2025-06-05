function render(state) {
    document.body.className = state === 'SIGNED_IN' ? 'authed' : 'logout';
    document.getElementById('status').textContent =
      state === 'SIGNED_IN' ? '✅ 已登入' : '🔒 尚未登入';
  }
  
  chrome.storage.session.get('authState').then(({ authState }) => {
    render(authState || 'SIGNED_OUT');
  });
  
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.authState) {
      render(changes.authState.newValue);
    }
  });