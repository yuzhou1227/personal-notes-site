// js/app.js — Main application orchestrator

(function() {
  const GITHUB_API = 'https://api.github.com';
  let owner = '';
  let repo = '';
  let branch = 'main';
  let currentPath = null;

  function initApp() {
    owner = window.__NOTE_OWNER || '';
    repo = window.__NOTE_REPO || '';
    branch = window.__NOTE_BRANCH || 'main';

    setupEventListeners();
    loadNotes();
  }

  function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', function(e) {
      const q = e.target.value.trim();
      if (q.length < 1) {
        showBrowsingView();
        return;
      }
      performSearch(q);
    });

    document.getElementById('menuToggle').addEventListener('click', function() {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('open');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', function() {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
    });
  }

  async function loadNotes() {
    if (!owner || !repo) {
      showEmptyConfig();
      return;
    }

    const cachedTree = Cache.getFileTree();
    if (cachedTree && cachedTree.length > 0) {
      FileTree.render('fileTree', cachedTree, onNoteSelect);
      Search.buildIndex();
      const lastPath = sessionStorage.getItem('notes_lastPath');
      if (lastPath) {
        FileTree.expandTo(lastPath);
        loadAndShowNote(lastPath);
      }
    }

    try {
      await fetchAndSyncNotes();
    } catch (e) {
      console.error('Sync error:', e);
      if (!cachedTree || cachedTree.length === 0) {
        showError('加载失败', '请检查仓库配置是否正确，以及网络连接是否正常。');
      }
    }
  }

  async function fetchAndSyncNotes() {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 403 || resp.status === 429) {
        showToast('GitHub API 已达到限制，使用缓存内容浏览');
        return;
      }
      throw new Error(`API error: ${resp.status}`);
    }
    const data = await resp.json();
    const tree = data.tree || [];

    const notesEntries = tree.filter(item =>
      item.path.startsWith('notes/') && item.type === 'blob' && item.path.endsWith('.md')
    );
    const dirEntries = tree.filter(item =>
      item.path.startsWith('notes/') && item.type === 'tree'
    );

    const fileTree = buildFileTree(notesEntries, dirEntries);

    const cache = Cache.get();
    const changedPaths = [];
    for (const entry of notesEntries) {
      const relPath = entry.path.replace(/^notes\//, '');
      const cached = cache && cache.files ? cache.files[relPath] : null;
      if (!cached || cached.sha !== entry.sha) {
        changedPaths.push(entry);
      }
    }

    if (changedPaths.length === 0 && cache && cache.fileTree) {
      Cache.setLastUpdated(new Date().toISOString());
      return;
    }

    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (!cache || !cache.files) {
      progressBar.style.display = 'flex';
      progressText.textContent = `正在加载笔记... 0/${notesEntries.length}`;
    }

    let loaded = 0;
    const total = changedPaths.length;

    for (const entry of changedPaths) {
      try {
        const contentResp = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${entry.path}`);
        if (contentResp.ok) {
          const contentData = await contentResp.json();
          const mdContent = decodeURIComponent(escape(atob(contentData.content)));
          const title = extractTitle(mdContent);
          const relPath = entry.path.replace(/^notes\//, '');
          Cache.setFile(relPath, {
            sha: entry.sha,
            title: title,
            content: mdContent
          });
        }
      } catch (e) {
        console.warn('Failed to load:', entry.path, e);
      }

      loaded++;
      if (progressBar.style.display !== 'none') {
        const pct = Math.round((loaded / total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `正在加载笔记... ${loaded}/${total}`;
      }
    }

    Cache.setFileTree(fileTree);
    Cache.setLastUpdated(new Date().toISOString());

    if (progressBar.style.display !== 'none') {
      progressBar.style.display = 'none';
    }

    Search.buildIndex();
    FileTree.render('fileTree', fileTree, onNoteSelect);
  }

  function buildFileTree(notesEntries, dirEntries) {
    const root = [];

    function getOrCreateDir(pathParts, parent) {
      if (pathParts.length === 0) return parent;
      const name = pathParts[0];
      const rest = pathParts.slice(1);
      let node = parent.find(n => n.name === name && n.type === 'dir');
      if (!node) {
        node = { name, type: 'dir', children: [] };
        parent.push(node);
      }
      if (rest.length > 0) getOrCreateDir(rest, node.children);
      return node;
    }

    for (const dir of dirEntries) {
      const relPath = dir.path.replace(/^notes\//, '');
      if (!relPath) continue;
      const parts = relPath.split('/');
      getOrCreateDir(parts, root);
    }

    for (const entry of notesEntries) {
      const relPath = entry.path.replace(/^notes\//, '');
      const parts = relPath.split('/');
      const fileName = parts.pop();
      if (parts.length === 0) {
        root.push({ name: fileName, type: 'file' });
      } else {
        const dir = getOrCreateDir(parts, root);
        dir.children.push({ name: fileName, type: 'file' });
      }
    }

    function sortNodes(nodes) {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) {
        if (node.children) sortNodes(node.children);
      }
    }
    sortNodes(root);

    return root;
  }

  function extractTitle(mdContent) {
    const match = mdContent.match(/^#\s+(.+)/m);
    if (match) return match[1].trim();
    const lines = mdContent.split('\n').filter(l => l.trim());
    return lines.length > 0 ? lines[0].trim().replace(/^#+\s*/, '') : '无标题';
  }

  function onNoteSelect(path) {
    sessionStorage.setItem('notes_lastPath', path);
    loadAndShowNote(path);
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }

  async function loadAndShowNote(path) {
    currentPath = path;
    FileTree.highlight(path);
    FileTree.expandTo(path);

    const cached = Cache.getFile(path);
    if (cached) {
      showNote(path, cached.content, cached.title);
      return;
    }

    try {
      const resp = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/notes/${path}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const mdContent = atob(data.content);
      const title = extractTitle(mdContent);
      Cache.setFile(path, { sha: data.sha, title, content: mdContent });
      Search.buildIndex();
      showNote(path, mdContent, title);
    } catch (e) {
      showError('加载失败', `无法加载笔记: ${path}`);
    }
  }

  function showNote(path, mdContent, title) {
    const html = renderMarkdown(mdContent);

    const parts = path.replace(/\.md$/i, '').split('/');
    const breadcrumbHtml = parts.map((p, i) =>
      `<span>${i > 0 ? '›' : ''}</span>${escapeHtml(p)}`
    ).join(' ');

    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = breadcrumbHtml;
    breadcrumb.style.display = 'block';

    document.getElementById('welcomeMessage').style.display = 'none';
    document.getElementById('articleContent').innerHTML = html;
    document.getElementById('content').scrollTop = 0;

    // Add edit button
    var editBtn = document.createElement('button');
    editBtn.id = 'editBtn';
    editBtn.textContent = '✏️ 编辑';
    editBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:50;padding:10px 20px;background:#007aff;color:#fff;border:none;border-radius:20px;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,122,255,0.3);font-family:inherit;transition:transform .15s,box-shadow .15s';
    editBtn.onmouseover = function() { this.style.transform = 'scale(1.05)'; this.style.boxShadow = '0 6px 24px rgba(0,122,255,0.4)'; };
    editBtn.onmouseout = function() { this.style.transform = 'scale(1)'; this.style.boxShadow = '0 4px 16px rgba(0,122,255,0.3)'; };
    editBtn.onclick = function() {
      if (!getToken()) { showTokenDialog(); return; }
      Editor.enter(path);
    };
    // Remove old edit button
    var old = document.getElementById('editBtn');
    if (old) old.remove();
    document.body.appendChild(editBtn);
  }

  function performSearch(q) {
    const results = Search.query(q);
    const container = document.getElementById('articleContent');

    document.getElementById('welcomeMessage').style.display = 'none';
    document.getElementById('breadcrumb').style.display = 'none';

    if (results.length === 0) {
      container.innerHTML = `<div class="search-empty">没有找到匹配「${escapeHtml(q)}」的笔记</div>`;
      return;
    }

    let html = `<div class="search-results">
      <div class="search-result-header">搜索 "${escapeHtml(q)}" 共 ${results.length} 条结果</div>`;

    for (const r of results) {
      html += `<div class="search-result-item" data-path="${escapeHtml(r.path)}">
        <div class="search-result-title">${escapeHtml(r.title)}</div>
        <div class="search-result-path">${escapeHtml(r.path)}</div>
        ${r.snippet ? `<div class="search-result-snippet">${escapeHtml(r.snippet)}</div>` : ''}
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', function() {
        const path = this.dataset.path;
        if (path) onNoteSelect(path);
      });
    });
  }

  function showBrowsingView() {
    var old = document.getElementById('editBtn');
    if (old) old.remove();
    var oldClose = document.getElementById('closeEditorBtn');
    if (oldClose) oldClose.remove();
    if (currentPath) {
      const cached = Cache.getFile(currentPath);
      if (cached) {
        showNote(currentPath, cached.content, cached.title);
        return;
      }
    }
    document.getElementById('welcomeMessage').style.display = 'block';
    document.getElementById('articleContent').innerHTML = '';
    document.getElementById('breadcrumb').style.display = 'none';
  }

  function showEmptyConfig() {
    document.getElementById('welcomeMessage').innerHTML = `
      <h1>个人笔记</h1>
      <p>请在 index.html 中配置仓库信息：</p>
      <code style="display:block;margin:8px 0;padding:8px 12px;background:#f5f5f5;border-radius:4px;font-size:14px">
        window.__NOTE_OWNER = '你的GitHub用户名';<br>
        window.__NOTE_REPO = '你的仓库名';
      </code>
    `;
  }

  function showError(title, message) {
    document.getElementById('welcomeMessage').innerHTML = `
      <div class="error-message">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function showToast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._hide);
    el._hide = setTimeout(function() { el.classList.remove('show'); }, 3000);
  }

  function showTokenDialog() {
    if (getToken()) return;
    var overlay = document.createElement('div');
    overlay.id = 'tokenOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,0.12)">' +
      '<h2 style="font-size:18px;font-weight:600;margin-bottom:8px">需要写入权限</h2>' +
      '<p style="font-size:14px;color:#8e8e93;margin-bottom:20px">编辑笔记需要 GitHub Personal Access Token。<br>在 GitHub Settings → Developer settings → Personal access tokens 生成，勾选 <code>public_repo</code>。</p>' +
      '<input id="tokenInput" type="password" placeholder="粘贴你的 token" style="width:100%;padding:10px 14px;border:1px solid #e5e5ea;border-radius:10px;font-size:14px;outline:none;margin-bottom:16px;box-sizing:border-box">' +
      '<div style="display:flex;gap:8px">' +
      '<button id="tokenCancel" style="flex:1;padding:10px;border:1px solid #e5e5ea;border-radius:10px;background:#fff;font-size:14px;cursor:pointer">取消</button>' +
      '<button id="tokenConfirm" style="flex:1;padding:10px;border:none;border-radius:10px;background:#007aff;color:#fff;font-size:14px;cursor:pointer">确认</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    document.getElementById('tokenConfirm').addEventListener('click', function() {
      var val = document.getElementById('tokenInput').value.trim();
      if (val) { localStorage.setItem('notes_token', val); overlay.remove(); }
    });
    document.getElementById('tokenCancel').addEventListener('click', function() { overlay.remove(); });
  }

  function getToken() {
    return localStorage.getItem('notes_token') || '';
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  window.initApp = initApp;
  window.extractTitle = extractTitle;
  window.loadAndShowNote = loadAndShowNote;
  window.showBrowsingView = showBrowsingView;
  window.showTokenDialog = showTokenDialog;
  window.getToken = getToken;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
