// js/search.js — Full-text search index engine

(function() {
  let searchIndex = [];

  function buildIndex() {
    const cache = Cache.get();
    if (!cache || !cache.files) {
      searchIndex = [];
      return;
    }
    searchIndex = [];
    for (const [path, file] of Object.entries(cache.files)) {
      if (file.content || file.title) {
        searchIndex.push({
          path: path,
          title: file.title || path.split('/').pop().replace(/\.md$/i, ''),
          content: file.content || ''
        });
      }
    }
  }

  function query(text) {
    const q = text.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    const results = [];
    for (const entry of searchIndex) {
      const titleMatch = entry.title.toLowerCase().includes(q);
      const contentMatch = entry.content.toLowerCase().includes(q);
      if (titleMatch || contentMatch) {
        let snippet = '';
        if (contentMatch) {
          const idx = entry.content.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 30);
          const end = Math.min(entry.content.length, idx + q.length + 60);
          snippet = (start > 0 ? '...' : '') + entry.content.slice(start, end) + (end < entry.content.length ? '...' : '');
        }
        results.push({
          path: entry.path,
          title: entry.title,
          snippet: snippet,
          matchType: titleMatch ? 'title' : 'content'
        });
      }
    }

    results.sort((a, b) => {
      if (a.matchType !== b.matchType) return a.matchType === 'title' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return results;
  }

  function getIndex() { return searchIndex; }

  window.Search = { buildIndex, query, getIndex };
})();
