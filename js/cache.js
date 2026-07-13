// js/cache.js — localStorage cache manager

(function() {
  const CACHE_KEY = 'notes_cache';

  function getCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Cache read error:', e);
      return null;
    }
  }

  function setCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Cache write error:', e);
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) { /* ignore */ }
  }

  function getCachedFile(path) {
    const cache = getCache();
    return cache && cache.files && cache.files[path] ? cache.files[path] : null;
  }

  function setCachedFile(path, data) {
    const cache = getCache() || { version: 1, lastUpdated: null, files: {}, fileTree: [] };
    cache.files[path] = data;
    setCache(cache);
  }

  function getFileTree() {
    const cache = getCache();
    return cache ? cache.fileTree : null;
  }

  function setFileTree(tree) {
    const cache = getCache() || { version: 1, lastUpdated: null, files: {}, fileTree: [] };
    cache.fileTree = tree;
    setCache(cache);
  }

  function getLastUpdated() {
    const cache = getCache();
    return cache ? cache.lastUpdated : null;
  }

  function setLastUpdated(time) {
    const cache = getCache() || { version: 1, lastUpdated: null, files: {}, fileTree: [] };
    cache.lastUpdated = time;
    setCache(cache);
  }

  window.Cache = {
    get: getCache,
    set: setCache,
    clear: clearCache,
    getFile: getCachedFile,
    setFile: setCachedFile,
    getFileTree: getFileTree,
    setFileTree: setFileTree,
    getLastUpdated: getLastUpdated,
    setLastUpdated: setLastUpdated
  };
})();
