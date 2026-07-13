// js/editor.js — Markdown editor with split pane

(function() {
  var currentPath = '';
  var currentContent = '';

  function enter(path) {
    currentPath = path;
    var cached = Cache.getFile(path);
    currentContent = cached ? cached.content : '';

    // Hide edit button
    var eb = document.getElementById('editBtn');
    if (eb) eb.style.display = 'none';

    // Add close button
    var closeBtn = document.createElement('button');
    closeBtn.id = 'closeEditorBtn';
    closeBtn.textContent = '✕ 关闭编辑器';
    closeBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:60;padding:10px 20px;background:#ff3b30;color:#fff;border:none;border-radius:20px;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(255,59,48,0.3);font-family:inherit';
    closeBtn.onclick = function() { exit(); };
    document.body.appendChild(closeBtn);

    renderEditor();
  }

  function renderEditor() {
    var container = document.getElementById('articleContent');
    container.innerHTML = '';

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.id = 'editorToolbar';
    toolbar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:0 0 12px;border-bottom:1px solid #e5e5ea;margin-bottom:0';

    var buttons = [
      { label: 'B', cmd: 'bold', title: '粗体' },
      { label: 'I', cmd: 'italic', title: '斜体' },
      { label: 'S', cmd: 'strike', title: '删除线' },
      { label: '|' },
      { label: 'H1', cmd: 'h1', title: '标题1' },
      { label: 'H2', cmd: 'h2', title: '标题2' },
      { label: 'H3', cmd: 'h3', title: '标题3' },
      { label: '|' },
      { label: '•', cmd: 'ul', title: '无序列表' },
      { label: '1.', cmd: 'ol', title: '有序列表' },
      { label: '☑', cmd: 'task', title: '任务列表' },
      { label: '|' },
      { label: '<>', cmd: 'code', title: '代码块' },
      { label: '❝', cmd: 'quote', title: '引用' },
      { label: '—', cmd: 'hr', title: '分割线' },
      { label: '|' },
      { label: '🔗', cmd: 'link', title: '链接' },
      { label: '🖼', cmd: 'image', title: '图片' },
      { label: '📊', cmd: 'table', title: '表格' },
      { label: '|' },
      { label: '💾', cmd: 'save', title: '保存到 GitHub' },
      { label: '📁', cmd: 'new', title: '新建笔记' },
    ];

    for (var b of buttons) {
      if (b.label === '|') {
        var sep = document.createElement('span');
        sep.textContent = '|';
        sep.style.cssText = 'color:#e5e5ea;font-size:12px;padding:0 2px;display:flex;align-items:center';
        toolbar.appendChild(sep);
        continue;
      }
      var btn = document.createElement('button');
      btn.textContent = b.label;
      btn.title = b.title;
      btn.style.cssText = 'padding:4px 8px;border:none;border-radius:6px;background:transparent;font-size:13px;cursor:pointer;color:#666;font-family:inherit;transition:background .1s';
      btn.onmouseover = function() { this.style.background = '#f0f0f0'; };
      btn.onmouseout = function() { this.style.background = 'transparent'; };
      btn.onclick = function(cmd) { return function() { executeCmd(cmd); }; }(b.cmd);
      toolbar.appendChild(btn);
    }

    // Split pane container
    var splitPane = document.createElement('div');
    splitPane.style.cssText = 'display:flex;gap:0;margin:0 -48px;min-height:calc(100vh - 280px)';

    // Editor textarea
    var editorPane = document.createElement('div');
    editorPane.style.cssText = 'flex:1;display:flex;flex-direction:column;border-right:1px solid #e5e5ea';

    var editorHeader = document.createElement('div');
    editorHeader.style.cssText = 'padding:8px 16px;font-size:12px;color:#8e8e93;background:#f8f8f8;border-bottom:1px solid #e5e5ea';
    editorHeader.textContent = 'Markdown';
    editorPane.appendChild(editorHeader);

    var textarea = document.createElement('textarea');
    textarea.id = 'editorTextarea';
    textarea.value = currentContent;
    textarea.style.cssText = 'flex:1;border:none;outline:none;resize:none;padding:20px 24px;font-family:"SF Mono","JetBrains Mono","Fira Code",monospace;font-size:14px;line-height:1.7;background:#fafafa;color:#1a1a1a;tab-size:2';
    textarea.spellcheck = false;
    editorPane.appendChild(textarea);

    // Preview pane
    var previewPane = document.createElement('div');
    previewPane.style.cssText = 'flex:1;display:flex;flex-direction:column;background:#fff';

    var previewHeader = document.createElement('div');
    previewHeader.style.cssText = 'padding:8px 16px;font-size:12px;color:#8e8e93;background:#f8f8f8;border-bottom:1px solid #e5e5ea';
    previewHeader.textContent = '预览';
    previewPane.appendChild(previewHeader);

    var previewContent = document.createElement('div');
    previewContent.id = 'editorPreview';
    previewContent.style.cssText = 'flex:1;padding:20px 24px;overflow-y:auto;font-size:15px;line-height:1.7';
    previewPane.appendChild(previewContent);

    splitPane.appendChild(editorPane);
    splitPane.appendChild(previewPane);

    // Status bar
    var statusBar = document.createElement('div');
    statusBar.id = 'editorStatusBar';
    statusBar.style.cssText = 'padding:8px 16px;font-size:12px;color:#8e8e93;background:#f8f8f8;border-top:1px solid #e5e5ea;display:flex;justify-content:space-between';
    statusBar.innerHTML = '<span>字数: ' + currentContent.length + '</span><span id="editorSaveStatus">草稿自动保存</span>';

    // Assemble
    container.appendChild(toolbar);
    container.appendChild(splitPane);
    container.appendChild(statusBar);

    // Initial preview render
    updatePreview();

    // Live preview on input
    textarea.addEventListener('input', function() {
      currentContent = this.value;
      updatePreview();
      updateStatusBar();
      autoSaveDraft();
    });

    // Keyboard shortcuts
    textarea.addEventListener('keydown', function(e) {
      var isCtrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Tab') {
        e.preventDefault();
        var start = this.selectionStart;
        var end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
        currentContent = this.value;
        updatePreview();
        updateStatusBar();
        autoSaveDraft();
        return;
      }

      if (!isCtrl) return;

      var handled = true;
      switch (e.key.toLowerCase()) {
        case 'b': wrapSelection(this, '**', '**'); break;
        case 'i': wrapSelection(this, '*', '*'); break;
        case 'k':
          var url = prompt('输入链接地址:', 'https://');
          if (url) wrapSelection(this, '[', '](' + url + ')');
          break;
        case 's': e.preventDefault(); saveToGitHub(); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        currentContent = this.value;
        updatePreview();
        updateStatusBar();
        autoSaveDraft();
      }
    });

    // Image paste support
    textarea.addEventListener('paste', function(e) {
      var items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          e.preventDefault();
          uploadImage(items[i].getAsFile());
          return;
        }
      }
    });

    // Image drag & drop
    textarea.addEventListener('dragover', function(e) { e.preventDefault(); });
    textarea.addEventListener('drop', function(e) {
      e.preventDefault();
      var files = e.dataTransfer.files;
      for (var i = 0; i < files.length; i++) {
        if (files[i].type && files[i].type.startsWith('image/')) {
          uploadImage(files[i]);
          return;
        }
      }
    });

    // Scroll sync: textarea -> preview
    textarea.addEventListener('scroll', function() {
      var ratio = this.scrollTop / (this.scrollHeight - this.clientHeight);
      var pv = document.getElementById('editorPreview');
      pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight);
    });
  }

  function updatePreview() {
    var preview = document.getElementById('editorPreview');
    if (!preview) return;
    preview.innerHTML = renderMarkdown(currentContent);
  }

  function updateStatusBar() {
    var sb = document.getElementById('editorStatusBar');
    if (!sb) return;
    var lines = currentContent.split('\n').length;
    sb.innerHTML = '<span>字数: ' + currentContent.length + ' · 行数: ' + lines + '</span><span id="editorSaveStatus">草稿自动保存</span>';
  }

  function autoSaveDraft() {
    try {
      localStorage.setItem('draft_' + currentPath, currentContent);
      var status = document.getElementById('editorSaveStatus');
      if (status) { status.textContent = '草稿已保存'; status.style.color = '#34c759'; }
    } catch (e) { /* ignore */ }
  }

  function executeCmd(cmd) {
    var ta = document.getElementById('editorTextarea');
    if (!ta) return;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var sel = ta.value.substring(start, end);
    var lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = ta.value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = ta.value.length;
    var line = ta.value.substring(lineStart, lineEnd);

    switch (cmd) {
      case 'bold':
        wrapSelection(ta, '**', '**', start, end);
        break;
      case 'italic':
        wrapSelection(ta, '*', '*', start, end);
        break;
      case 'strike':
        wrapSelection(ta, '~~', '~~', start, end);
        break;
      case 'h1':
        replaceLine(ta, '# ', lineStart, lineEnd, line);
        break;
      case 'h2':
        replaceLine(ta, '## ', lineStart, lineEnd, line);
        break;
      case 'h3':
        replaceLine(ta, '### ', lineStart, lineEnd, line);
        break;
      case 'ul':
        replaceLine(ta, '- ', lineStart, lineEnd, line);
        break;
      case 'ol':
        replaceLine(ta, '1. ', lineStart, lineEnd, line);
        break;
      case 'task':
        replaceLine(ta, '- [ ] ', lineStart, lineEnd, line);
        break;
      case 'code':
        wrapBlock(ta, '```\n', '\n```', start, end);
        break;
      case 'quote':
        replaceLine(ta, '> ', lineStart, lineEnd, line);
        break;
      case 'hr':
        insertAtCursor(ta, '\n---\n', start);
        break;
      case 'link':
        var url = prompt('输入链接地址:', 'https://');
        if (url) wrapSelection(ta, '[', '](' + url + ')', start, end);
        break;
      case 'image':
        var imgUrl = prompt('输入图片地址:', '');
        if (imgUrl) insertAtCursor(ta, '![](' + imgUrl + ')', start);
        break;
      case 'table':
        insertAtCursor(ta, '\n| 表头 | 表头 |\n| --- | --- |\n| 内容 | 内容 |\n', start);
        break;
      case 'save':
        saveToGitHub();
        break;
      case 'new':
        createNewNote();
        break;
    }
    currentContent = ta.value;
    updatePreview();
    updateStatusBar();
    autoSaveDraft();
  }

  function wrapSelection(ta, before, after, start, end) {
    if (start === undefined) { start = ta.selectionStart; end = ta.selectionEnd; }
    var sel = ta.value.substring(start, end) || 'text';
    var val = ta.value;
    ta.value = val.substring(0, start) + before + sel + after + val.substring(end);
    ta.selectionStart = start + before.length;
    ta.selectionEnd = end + before.length + sel.length;
    ta.focus();
  }

  function replaceLine(ta, prefix, lineStart, lineEnd, line) {
    var newLine = prefix + line.replace(/^[#*->\s]+/, '');
    ta.value = ta.value.substring(0, lineStart) + newLine + ta.value.substring(lineEnd);
    ta.focus();
  }

  function wrapBlock(ta, before, after, start, end) {
    var val = ta.value;
    var selText = val.substring(start, end) || '代码';
    ta.value = val.substring(0, start) + before + selText + after + val.substring(end);
    ta.focus();
  }

  function insertAtCursor(ta, text, pos) {
    var val = ta.value;
    ta.value = val.substring(0, pos) + text + val.substring(pos);
    ta.selectionStart = ta.selectionEnd = pos + text.length;
    ta.focus();
  }

  async function saveToGitHub() {
    var token = getToken();
    if (!token) { showTokenDialog(); return; }

    var status = document.getElementById('editorSaveStatus');
    if (status) { status.textContent = '正在保存...'; status.style.color = '#007aff'; }

    try {
      // Get current file SHA
      var path = currentPath;
      var url = 'https://api.github.com/repos/' + window.__NOTE_OWNER + '/' + window.__NOTE_REPO + '/contents/notes/' + path;
      var headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };

      var getResp = await fetch(url, { headers: headers });
      var sha = '';
      if (getResp.ok) {
        var data = await getResp.json();
        sha = data.sha;
      }

      // PUT new content
      var content = btoa(unescape(encodeURIComponent(currentContent)));
      var body = {
        message: 'update: ' + path,
        content: content,
        branch: window.__NOTE_BRANCH || 'master'
      };
      if (sha) body.sha = sha;

      var putResp = await fetch(url, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (putResp.ok) {
        if (status) { status.textContent = '✓ 已保存到 GitHub'; status.style.color = '#34c759'; }
        // Update cache
        var newSha = (await putResp.json()).content.sha;
        Cache.setFile(path, { sha: newSha, title: extractTitle(currentContent), content: currentContent });
        Search.buildIndex();
        setTimeout(function() { showEditorSaved(path); }, 1000);
      } else {
        var err = await putResp.text();
        if (status) { status.textContent = '✗ 保存失败'; status.style.color = '#ff3b30'; }
        showToast('保存失败: ' + (err.substring(0, 100) || '未知错误'));
      }
    } catch (e) {
      if (status) { status.textContent = '✗ 保存失败'; status.style.color = '#ff3b30'; }
      showToast('保存出错: ' + e.message);
    }
  }

  function showEditorSaved(savedPath) {
    exit();
    if (savedPath) {
      loadAndShowNote(savedPath);
    }
  }

  function exit() {
    document.getElementById('breadcrumb').style.display = 'none';
    var eb = document.getElementById('editBtn');
    if (eb) eb.style.display = 'block';
    var cb = document.getElementById('closeEditorBtn');
    if (cb) cb.remove();
    showBrowsingView();
    // Clear draft after save
    try { localStorage.removeItem('draft_' + currentPath); } catch(e) {}
    currentPath = '';
    currentContent = '';
  }

  // ─── Image Upload ───

  async function uploadImage(file) {
    var token = getToken();
    if (!token) { showTokenDialog(); return; }

    var reader = new FileReader();
    reader.onload = async function(e) {
      var base64 = e.target.result.split(',')[1];
      var imageName = 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6) + '.' + file.name.split('.').pop();
      var imagePath = 'assets/images/' + imageName;

      showToast('正在上传图片...');

      try {
        var headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
        var url = 'https://api.github.com/repos/' + window.__NOTE_OWNER + '/' + window.__NOTE_REPO + '/contents/' + imagePath;
        var body = {
          message: 'add image: ' + imageName,
          content: base64,
          branch: window.__NOTE_BRANCH || 'master'
        };

        var resp = await fetch(url, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
        if (resp.ok) {
          var imgMd = '![' + imageName + '](../' + imagePath + ')';
          var ta = document.getElementById('editorTextarea');
          var pos = ta.selectionStart;
          insertAtCursor(ta, imgMd + '\n', pos);
          currentContent = ta.value;
          updatePreview();
          updateStatusBar();
          autoSaveDraft();
          showToast('图片已上传');
        } else {
          showToast('图片上传失败');
        }
      } catch (err) {
        showToast('上传出错: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
  }

  // ─── File Management ───

  async function createNewNote() {
    var name = prompt('输入笔记文件名（不含 .md）：', '新笔记');
    if (!name) return;
    if (!name.endsWith('.md')) name += '.md';

    var folder = '';
    var pathParts = currentPath ? currentPath.split('/') : [];
    if (pathParts.length > 1) {
      // Create in same folder as current note
      folder = pathParts.slice(0, -1).join('/') + '/';
    }
    var fullPath = folder + name;

    var token = getToken();
    if (!token) { showTokenDialog(); return; }

    try {
      var headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
      var url = 'https://api.github.com/repos/' + window.__NOTE_OWNER + '/' + window.__NOTE_REPO + '/contents/notes/' + fullPath;

      var body = {
        message: 'create: ' + fullPath,
        content: btoa(unescape(encodeURIComponent('# ' + name.replace(/\.md$/, '') + '\n\n')),
        branch: window.__NOTE_BRANCH || 'master'
      };

      var resp = await fetch(url, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
      if (resp.ok) {
        showToast('已创建: ' + name);
        // Reload notes
        await fetchAndSyncNotes();
        // Open the new note
        setTimeout(function() { onNoteSelect(fullPath); }, 500);
      } else {
        showToast('创建失败');
      }
    } catch (e) {
      showToast('创建出错: ' + e.message);
    }
  }

  window.createNewNote = createNewNote;

  function addSidebarActions() {
    // Add "new note" button above the file tree
    var sidebar = document.getElementById('sidebar');
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 12px 8px;font-size:12px;color:#8e8e93';
    header.innerHTML = '<span>笔记列表</span>' +
      '<span style="cursor:pointer;font-size:16px;display:flex;gap:4px">' +
        '<span id="sidebarNewNote" title="新建笔记" style="cursor:pointer;padding:2px 6px;border-radius:4px;transition:background.1s">➕</span>' +
      '</span>';

    // Insert at top of sidebar
    var fileTree = document.getElementById('fileTree');
    sidebar.insertBefore(header, fileTree);

    document.getElementById('sidebarNewNote').onmouseover = function() { this.style.background = '#f0f0f0'; };
    document.getElementById('sidebarNewNote').onmouseout = function() { this.style.background = 'transparent'; };
    document.getElementById('sidebarNewNote').onclick = function() {
      if (!getToken()) { showTokenDialog(); return; }
      createNewNote();
    };
  }

  // Run once on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSidebarActions);
  } else {
    addSidebarActions();
  }

  window.Editor = { enter: enter, exit: exit, createNewNote: createNewNote };
})();
