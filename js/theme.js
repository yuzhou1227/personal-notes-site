/* personal-notes-site/js/theme.js */
(function() {
  var STORAGE_KEY = 'notes_theme';

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (window.mermaid && window.mermaid.setTheme) {
      window.mermaid.setTheme(theme === 'dark' ? 'dark' : 'default');
    }
  }

  function getTheme() {
    var t = localStorage.getItem(STORAGE_KEY);
    return t || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function setTheme(mode) {
    if (mode === 'auto') {
      localStorage.removeItem(STORAGE_KEY);
      applyTheme(getPreferredTheme());
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
      applyTheme(mode);
    }
  }

  function toggle() {
    var current = getTheme();
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function() {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(mq.matches ? 'dark' : 'light');
      }
    });
  }

  applyTheme(getPreferredTheme());

  window.Theme = { getTheme: getTheme, setTheme: setTheme, toggle: toggle };
})();
