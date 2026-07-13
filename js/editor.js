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

    // Add floating action buttons
    var actions = document.createElement('div');
    actions.id = 'editorActions';
    actions.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:60;display:flex;gap:8px';

    var saveBtn = document.createElement('button');
    saveBtn.id = 'editorSaveBtn';
    saveBtn.textContent = '💾 保存';
    saveBtn.style.cssText = 'padding:10px 22px;background:#007aff;color:#fff;border:none;border-radius:20px;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,122,255,0.3);font-family:inherit;font-weight:500;transition:transform.15s,box-shadow.15s';
    saveBtn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    saveBtn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    saveBtn.onclick = async function() {
      if (saveInProgress) return;
      saveInProgress = true;
      this.textContent = '⏳ 保存中...';
      this.disabled = true;
      try {
        syncWysiwygToMarkdown();
        await saveToGitHub();
      } catch (e) {
        showToast('保存出错: ' + e.message);
        reenableSaveBtn();
      }
      saveInProgress = false;
    };

    var closeBtn = document.createElement('button');
    closeBtn.id = 'closeEditorBtn';
    closeBtn.textContent = '✕ 关闭';
    closeBtn.style.cssText = 'padding:10px 18px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:20px;font-size:13px;cursor:pointer;font-family:inherit;backdrop-filter:blur(10px);transition:background.15s';
    closeBtn.onmouseover = function() { this.style.background = 'rgba(0,0,0,0.8)'; };
    closeBtn.onmouseout = function() { this.style.background = 'rgba(0,0,0,0.6)'; };
    closeBtn.onclick = function() { exit(); };

    actions.appendChild(saveBtn);
    actions.appendChild(closeBtn);
    document.body.appendChild(actions);

    renderEditor();

    // Auto-focus the editor
    setTimeout(function() {
      var preview = document.getElementById('editorPreview');
      if (preview) { preview.focus(); }
    }, 100);
  }

  var showSource = false;
  var saveInProgress = false;

  function renderEditor() {
    var container = document.getElementById('articleContent');
    container.innerHTML = '';

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.id = 'editorToolbar';
    toolbar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:0 0 12px;border-bottom:1px solid #e5e5ea;margin-bottom:0;align-items:center';

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
      { label: '|' },
      { label: '源码', cmd: 'toggleSource', title: '显示/隐藏 Markdown 源码' },
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
      if (b.cmd === 'toggleSource') { btn.style.fontSize = '11px'; btn.style.color = '#007aff'; }
      toolbar.appendChild(btn);
    }

    // Editor area (WYSIWYG primary)
    var editorWrap = document.createElement('div');
    editorWrap.style.cssText = 'display:flex;gap:0;margin:0 -48px;min-height:calc(100vh - 280px)';

    // WYSIWYG contenteditable pane (visible by default)
    var wysiwygPane = document.createElement('div');
    wysiwygPane.style.cssText = 'flex:1;display:flex;flex-direction:column;';

    var wysiwygHeader = document.createElement('div');
    wysiwygHeader.style.cssText = 'padding:8px 16px;font-size:12px;color:#8e8e93;background:#f8f8f8;border-bottom:1px solid #e5e5ea';
    wysiwygHeader.textContent = '编辑区 — 点击内容直接编辑';
    wysiwygPane.appendChild(wysiwygHeader);

    var wysiwygContent = document.createElement('div');
    wysiwygContent.id = 'editorPreview';
    wysiwygContent.contentEditable = true;
    wysiwygContent.innerHTML = renderMarkdown(currentContent);
    wysiwygContent.style.cssText = 'flex:1;padding:24px 32px;overflow-y:auto;font-size:15px;line-height:1.8;outline:none;min-height:400px';
    wysiwygContent.addEventListener('input', function() { autoSaveDraft(); });
    wysiwygPane.appendChild(wysiwygContent);

    // Source pane (hidden by default)
    var sourcePane = document.createElement('div');
    sourcePane.id = 'editorSourcePane';
    sourcePane.style.cssText = 'flex:1;display:none;flex-direction:column;border-left:1px solid #e5e5ea';

    var sourceHeader = document.createElement('div');
    sourceHeader.style.cssText = 'padding:8px 16px;font-size:12px;color:#8e8e93;background:#f8f8f8;border-bottom:1px solid #e5e5ea';
    sourceHeader.textContent = 'Markdown 源码';
    sourcePane.appendChild(sourceHeader);

    var textarea = document.createElement('textarea');
    textarea.id = 'editorTextarea';
    textarea.value = currentContent;
    textarea.style.cssText = 'flex:1;border:none;outline:none;resize:none;padding:20px 24px;font-family:"SF Mono","JetBrains Mono","Fira Code",monospace;font-size:14px;line-height:1.7;background:#fafafa;color:#1a1a1a;tab-size:2';
    textarea.spellcheck = false;
    sourcePane.appendChild(textarea);

    editorWrap.appendChild(wysiwygPane);
    editorWrap.appendChild(sourcePane);

    // Keyboard shortcut on WYSIWYG
    wysiwygContent.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (saveInProgress) return;
        saveInProgress = true;
        syncWysiwygToMarkdown();
        saveToGitHub().catch(function(e) {
          showToast('保存出错: ' + e.message);
        }).finally(function() {
          saveInProgress = false;
        });
      }
    });

    // Ensure new lines use <p> not <div>
    document.execCommand('defaultParagraphSeparator', false, 'p');

    // Handle paste in WYSIWYG (strip HTML for images)
    wysiwygContent.addEventListener('paste', function(e) {
      var items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          e.preventDefault();
          uploadImage(items[i].getAsFile());
          return;
        }
      }
    });

    wysiwygContent.addEventListener('dragover', function(e) { e.preventDefault(); });
    wysiwygContent.addEventListener('drop', function(e) {
      e.preventDefault();
      var files = e.dataTransfer.files;
      for (var i = 0; i < files.length; i++) {
        if (files[i].type && files[i].type.startsWith('image/')) {
          uploadImage(files[i]);
          return;
        }
      }
    });

    // Status bar
    var statusBar = document.createElement('div');
    statusBar.id = 'editorStatusBar';
    statusBar.style.cssText = 'padding:8px 16px;font-size:12px;color:#8e8e93;background:#f8f8f8;border-top:1px solid #e5e5ea;display:flex;justify-content:space-between';
    statusBar.innerHTML = '<span>直接在内容上点击编辑</span><span id="editorSaveStatus">草稿自动保存</span>';

    // Assemble
    container.appendChild(toolbar);
    container.appendChild(editorWrap);
    container.appendChild(statusBar);
  }

  function syncWysiwygToMarkdown() {
    var preview = document.getElementById('editorPreview');
    if (!preview) return;
    var html = preview.innerHTML;
    if (window.htmlToMarkdown) {
      currentContent = htmlToMarkdown(html);
    } else {
      // Fallback: extract text content
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      currentContent = tmp.textContent || tmp.innerText || '';
    }
    var ta = document.getElementById('editorTextarea');
    if (ta) ta.value = currentContent;
  }

  function updateStatusBar() {
    var sb = document.getElementById('editorStatusBar');
    if (!sb) return;
    var preview = document.getElementById('editorPreview');
    var text = preview ? (preview.textContent || '').length : 0;
    sb.innerHTML = '<span>直接在内容上点击编辑</span><span id="editorSaveStatus">草稿自动保存</span>';
  }

  function autoSaveDraft() {
    try {
      var preview = document.getElementById('editorPreview');
      if (!preview) return;
      localStorage.setItem('draft_' + currentPath, preview.innerHTML);
      var status = document.getElementById('editorSaveStatus');
      if (status) { status.textContent = '草稿已保存'; status.style.color = '#34c759'; }
    } catch (e) { /* ignore */ }
  }

  function executeCmd(cmd) {
    var preview = document.getElementById('editorPreview');
    if (!preview) return;

    switch (cmd) {
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'strike':
        document.execCommand('strikeThrough');
        break;
      case 'h1':
        document.execCommand('formatBlock', false, 'h1');
        break;
      case 'h2':
        document.execCommand('formatBlock', false, 'h2');
        break;
      case 'h3':
        document.execCommand('formatBlock', false, 'h3');
        break;
      case 'ul':
        document.execCommand('insertUnorderedList');
        break;
      case 'ol':
        document.execCommand('insertOrderedList');
        break;
      case 'task':
        document.execCommand('insertHTML', false, '<div><input type="checkbox"> 任务</div>');
        break;
      case 'code':
        document.execCommand('insertHTML', false, '<pre><code>代码</code></pre>');
        break;
      case 'quote':
        document.execCommand('insertHTML', false, '<blockquote><p>引用内容</p></blockquote>');
        break;
      case 'hr':
        document.execCommand('insertHorizontalRule');
        break;
      case 'link':
        var url = prompt('输入链接地址:', 'https://');
        if (url) document.execCommand('createLink', false, url);
        break;
      case 'image':
        var imgUrl = prompt('输入图片地址:', '');
        if (imgUrl) document.execCommand('insertImage', false, imgUrl);
        break;
      case 'table':
        document.execCommand('insertHTML', false, '<table border="1"><tr><td>内容</td><td>内容</td></tr><tr><td>内容</td><td>内容</td></tr></table>');
        break;
      case 'save':
        syncWysiwygToMarkdown();
        saveToGitHub();
        break;
      case 'new':
        createNewNote();
        break;
      case 'toggleSource':
        showSource = !showSource;
        var sp = document.getElementById('editorSourcePane');
        if (sp) {
          sp.style.display = showSource ? 'flex' : 'none';
          if (showSource) {
            syncWysiwygToMarkdown();
            var ta = document.getElementById('editorTextarea');
            if (ta) ta.value = currentContent;
          }
        }
        break;
    }
    autoSaveDraft();
    preview.focus();
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

      // PUT new content — proper UTF-8 base64
      function utf8ToB64(str) {
        var encoder = new TextEncoder();
        var bytes = encoder.encode(str);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      }
      var content = utf8ToB64(currentContent);
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
        var newSha = (await putResp.json()).content.sha;
        Cache.setFile(path, { sha: newSha, title: extractTitle(currentContent), content: currentContent });
        Search.buildIndex();
        showToast('✓ 保存成功');
        reenableSaveBtn();
        setTimeout(function() { showEditorSaved(path); }, 1200);
      } else {
        var err = await putResp.text();
        var errMsg = '保存失败';
        try { var errJson = JSON.parse(err); errMsg += ': ' + (errJson.message || err.substring(0, 120)); } catch(e2) { errMsg += ': ' + err.substring(0, 120); }
        if (status) { status.textContent = '✗ 保存失败'; status.style.color = '#ff3b30'; }
        showToast(errMsg);
        reenableSaveBtn();
      }
    } catch (e) {
      if (status) { status.textContent = '✗ 保存失败'; status.style.color = '#ff3b30'; }
      showToast('保存出错: ' + e.message);
      reenableSaveBtn();
    }
  }

  function reenableSaveBtn() {
    var sb = document.getElementById('editorSaveBtn');
    if (sb) { sb.textContent = '💾 保存'; sb.disabled = false; }
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
    var actions = document.getElementById('editorActions');
    if (actions) actions.remove();
    showBrowsingView();
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
      folder = pathParts.slice(0, -1).join('/') + '/';
    }
    var fullPath = folder + name;

    var token = getToken();
    if (!token) { showTokenDialog(); return; }

    try {
      var headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
      var url = 'https://api.github.com/repos/' + window.__NOTE_OWNER + '/' + window.__NOTE_REPO + '/contents/notes/' + fullPath;

      var contentText = '# ' + name.replace(/\.md$/, '') + '\n\n';
      var body = {
        message: 'create: ' + fullPath,
        content: btoa(unescape(encodeURIComponent(contentText))),
        branch: window.__NOTE_BRANCH || 'master'
      };

      var resp = await fetch(url, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
      if (resp.ok) {
        var result = await resp.json();
        var newSha = result.content.sha;

        // Add to cache immediately
        Cache.setFile(fullPath, { sha: newSha, title: name.replace(/\.md$/, ''), content: contentText });
        Search.buildIndex();

        showToast('已创建: ' + name);

        // Refresh tree (skip content download by fetching tree only)
        await fetchAndSyncNotes();

        // Open the new note
        setTimeout(function() { onNoteSelect(fullPath); }, 300);
      } else {
        showToast('创建失败');
      }
    } catch (e) {
      showToast('创建出错: ' + e.message);
    }
  }

  // ─── Rename Note ───

  async function renameNote(oldPath) {
    var oldName = oldPath.split('/').pop().replace(/\.md$/, '');
    var newName = prompt('重命名为（不含 .md）：', oldName);
    if (!newName || newName === oldName) return;
    if (!newName.endsWith('.md')) newName += '.md';

    var parts = oldPath.split('/');
    parts.pop();
    var folder = parts.length > 0 ? parts.join('/') + '/' : '';
    var newPath = folder + newName;

    var token = getToken();
    if (!token) { showTokenDialog(); return; }

    try {
      var headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
      var baseUrl = 'https://api.github.com/repos/' + window.__NOTE_OWNER + '/' + window.__NOTE_REPO;

      // 1. Get old file content + SHA
      var getResp = await fetch(baseUrl + '/contents/notes/' + oldPath, { headers: headers });
      if (!getResp.ok) { showToast('获取文件信息失败'); return; }
      var oldData = await getResp.json();

      // 2. Create new file with same content
      var putBody = {
        message: 'rename: ' + oldPath + ' → ' + newPath,
        content: oldData.content,
        branch: window.__NOTE_BRANCH || 'master'
      };
      var putResp = await fetch(baseUrl + '/contents/notes/' + newPath, { method: 'PUT', headers: headers, body: JSON.stringify(putBody) });
      if (!putResp.ok) { showToast('创建新文件失败'); return; }

      // 3. Delete old file
      var delBody = {
        message: 'delete: ' + oldPath,
        sha: oldData.sha,
        branch: window.__NOTE_BRANCH || 'master'
      };
      await fetch(baseUrl + '/contents/notes/' + oldPath, { method: 'DELETE', headers: headers, body: JSON.stringify(delBody) });

      // 4. Update cache
      var cached = Cache.getFile(oldPath);
      if (cached) {
        Cache.setFile(newPath, cached);
        var cache = Cache.get();
        if (cache && cache.files) delete cache.files[oldPath];
        Cache.set(cache);
      }

      showToast('已重命名: ' + newName);
      await fetchAndSyncNotes();
      setTimeout(function() { onNoteSelect(newPath); }, 300);
    } catch (e) {
      showToast('重命名失败: ' + e.message);
    }
  }

  // ─── Delete Note ───

  async function deleteNote(path) {
    if (!confirm('确定删除 "' + path + '" 吗？此操作不可撤销。')) return;

    var token = getToken();
    if (!token) { showTokenDialog(); return; }

    try {
      var headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };
      var baseUrl = 'https://api.github.com/repos/' + window.__NOTE_OWNER + '/' + window.__NOTE_REPO;

      var getResp = await fetch(baseUrl + '/contents/notes/' + path, { headers: headers });
      if (!getResp.ok) { showToast('获取文件信息失败'); return; }
      var data = await getResp.json();

      var delBody = {
        message: 'delete: ' + path,
        sha: data.sha,
        branch: window.__NOTE_BRANCH || 'master'
      };
      var delResp = await fetch(baseUrl + '/contents/notes/' + path, { method: 'DELETE', headers: headers, body: JSON.stringify(delBody) });

      if (delResp.ok) {
        // Remove from cache
        var cache = Cache.get();
        if (cache && cache.files) delete cache.files[path];
        Cache.set(cache);
        Search.buildIndex();

        showToast('已删除');
        await fetchAndSyncNotes();
        showBrowsingView();
      } else {
        showToast('删除失败');
      }
    } catch (e) {
      showToast('删除失败: ' + e.message);
    }
  }

  // ─── Add Context Menu to Tree ───

  function addContextMenu() {
    var tree = document.getElementById('fileTree');
    if (!tree) return;

    tree.addEventListener('contextmenu', function(e) {
      var row = e.target.closest('.tree-row');
      if (!row) return;
      var treeNode = row.closest('.tree-node');
      if (!treeNode || treeNode.dataset.type !== 'file') return;

      e.preventDefault();
      var path = row.dataset.path;
      if (!path) return;

      var token = getToken();
      if (!token) { showTokenDialog(); return; }

      // Remove existing context menu
      var old = document.getElementById('treeContextMenu');
      if (old) old.remove();

      var menu = document.createElement('div');
      menu.id = 'treeContextMenu';
      menu.style.cssText = 'position:fixed;z-index:200;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.12);padding:4px;min-width:140px;font-size:14px';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';

      var items = [
        { label: '✏️ 重命名', action: function() { renameNote(path); } },
        { label: '🗑️ 删除', action: function() { deleteNote(path); }, color: '#ff3b30' },
      ];

      for (var item of items) {
        var div = document.createElement('div');
        div.textContent = item.label;
        div.style.cssText = 'padding:8px 14px;cursor:pointer;border-radius:6px;transition:background.1s' + (item.color ? ';color:' + item.color : '');
        div.onmouseover = function() { this.style.background = '#f0f0f0'; };
        div.onmouseout = function() { this.style.background = 'transparent'; };
        div.onclick = function(action) { return function() { action(); menu.remove(); }; }(item.action);
        menu.appendChild(div);
      }

      document.body.appendChild(menu);

      // Click outside to close
      setTimeout(function() {
        document.addEventListener('click', function closeMenu() {
          var m = document.getElementById('treeContextMenu');
          if (m) m.remove();
          document.removeEventListener('click', closeMenu);
        });
      }, 10);
    });
  }

  window.createNewNote = createNewNote;
  window.renameNote = renameNote;
  window.deleteNote = deleteNote;

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
  function init() {
    addSidebarActions();
    addContextMenu();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Editor = { enter: enter, exit: exit, createNewNote: createNewNote };
})();
