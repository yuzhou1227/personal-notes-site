(function() {
  var currentPath = '';
  var currentContent = '';
  var quillInstance = null;
  var STORAGE_KEY_PREFIX = 'quill_draft_';

  function enter(path) {
    currentPath = path;
    var cached = Cache.getFile(path);
    currentContent = cached ? cached.content : '';

    var eb = document.getElementById('editBtn');
    if (eb) eb.style.display = 'none';

    renderEditor();
  }

  function renderEditor() {
    var container = document.getElementById('articleContent');
    container.innerHTML = '';

    var toolbarContainer = document.createElement('div');
    toolbarContainer.id = 'editorToolbar';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = '💾 保存';
    saveBtn.onclick = function() { doSave(); };
    toolbarContainer.appendChild(saveBtn);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '✕ 关闭';
    closeBtn.onclick = function() { exit(); showBrowsingView(); };
    toolbarContainer.appendChild(closeBtn);

    var themeBtn = document.createElement('button');
    themeBtn.className = 'theme-btn';
    themeBtn.textContent = '🌓';
    themeBtn.title = '切换主题';
    themeBtn.addEventListener('click', function() {
      if (window.Theme) window.Theme.toggle();
    });
    toolbarContainer.appendChild(themeBtn);

    var statusSpan = document.createElement('span');
    statusSpan.id = 'editorSaveStatus';
    statusSpan.textContent = '草稿自动保存';
    toolbarContainer.appendChild(statusSpan);

    container.appendChild(toolbarContainer);

    var editorEl = document.createElement('div');
    editorEl.id = 'quillEditor';
    container.appendChild(editorEl);

    var imageHandler = function() {
      uploadImage();
    };

    var toolbarOptions = [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
      ['blockquote', 'code-block'],
      [{ align: [] }],
      ['link'],
      ['image'],
      ['clean']
    ];

    quillInstance = new Quill('#quillEditor', {
      modules: {
        toolbar: {
          container: toolbarOptions,
          handlers: {
            image: imageHandler
          }
        }
      },
      placeholder: '开始写笔记...',
      theme: 'snow'
    });

    // Override Quill's default image handler
    var toolbar = quillInstance.getModule('toolbar');
    if (toolbar) {
      var imageBtn = toolbar.container.querySelector('.ql-image');
      if (imageBtn) {
        imageBtn.onclick = function(e) {
          e.preventDefault();
          uploadImage();
        };
      }
    }

    // Set initial content
    if (currentContent) {
      var tempHtml = renderMarkdown(currentContent);
      quillInstance.root.innerHTML = tempHtml;
    }

    // Restore draft
    var draft = localStorage.getItem(STORAGE_KEY_PREFIX + currentPath);
    if (draft) {
      try { quillInstance.root.innerHTML = draft; } catch(e) {}
      statusSpan.textContent = '草稿已恢复';
    }

    // Auto-save draft
    var autoSaveTimer = null;
    quillInstance.on('text-change', function() {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(function() {
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + currentPath, quillInstance.root.innerHTML);
          statusSpan.textContent = '草稿已保存';
          statusSpan.style.color = '#34c759';
          setTimeout(function() { statusSpan.style.color = ''; }, 2000);
        } catch(e) {}
      }, 3000);
    });

    // Ctrl+S
    editorEl.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    });

    setTimeout(function() { quillInstance.focus(); }, 100);
  }

  function getMarkdownFromQuill() {
    if (!quillInstance) return '';
    var html = quillInstance.root.innerHTML;
    if (window.turndown) {
      var turndownService = new turndown();
      return turndownService.turndown(html);
    }
    return html;
  }

  function doSave() {
    if (!quillInstance) return;
    var md = getMarkdownFromQuill();
    currentContent = md;
    saveToGitHub(md);
  }

  async function saveToGitHub(md) {
    var token = getToken();
    if (!token) { showTokenDialog(); return; }

    var status = document.getElementById('editorSaveStatus');
    if (status) { status.textContent = '正在保存...'; status.style.color = 'var(--accent)'; }

    try {
      var path = currentPath;
      var baseUrl = 'https://api.github.com/repos/' + window.__NOTE_OWNER + '/' + window.__NOTE_REPO;
      var headers = { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' };

      var getResp = await fetch(baseUrl + '/contents/notes/' + path, { headers: headers });
      var sha = '';
      if (getResp.ok) { sha = (await getResp.json()).sha; }

      var encoder = new TextEncoder();
      var bytes = encoder.encode(md);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      var content = btoa(binary);

      var body = {
        message: 'update: ' + path,
        content: content,
        branch: window.__NOTE_BRANCH || 'master'
      };
      if (sha) body.sha = sha;

      var putResp = await fetch(baseUrl + '/contents/notes/' + path, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (putResp.ok) {
        var newSha = (await putResp.json()).content.sha;
        Cache.setFile(path, { sha: newSha, title: extractTitle(md), content: md });
        Search.buildIndex();
        if (status) { status.textContent = '✓ 已保存'; status.style.color = '#34c759'; }
        showToast('✓ 保存成功');
        localStorage.removeItem(STORAGE_KEY_PREFIX + path);
        setTimeout(function() { exit(); loadAndShowNote(path); }, 500);
      } else {
        var errText = await putResp.text();
        try { var errJson = JSON.parse(errText); errText = errJson.message; } catch(e2) {}
        if (status) { status.textContent = '✗ 保存失败'; status.style.color = '#ff3b30'; }
        showToast('保存失败: ' + errText.substring(0, 100));
      }
    } catch(e) {
      if (status) { status.textContent = '✗ 保存出错'; status.style.color = '#ff3b30'; }
      showToast('保存出错: ' + e.message);
    }
  }

  function uploadImage(callback) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function() {
      var file = input.files[0];
      if (!file) return;
      var token = getToken();
      if (!token) { showTokenDialog(); return; }

      var reader = new FileReader();
      reader.onload = async function(e) {
        var base64 = e.target.result.split(',')[1];
        var ext = file.name ? file.name.split('.').pop() : 'png';
        var imageName = 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6) + '.' + ext;
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
            var imgUrl = '../' + imagePath;
            if (quillInstance) {
              var range = quillInstance.getSelection(true);
              quillInstance.insertEmbed(range.index, 'image', imgUrl);
            }
            showToast('图片已上传');
          } else {
            showToast('图片上传失败');
          }
        } catch(err) {
          showToast('上传出错: ' + err.message);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function exit() {
    if (quillInstance) {
      quillInstance = null;
    }
    var container = document.getElementById('quillEditor');
    if (container) { container.innerHTML = ''; }
    var eb = document.getElementById('editBtn');
    if (eb) eb.style.display = 'block';
    try { localStorage.removeItem(STORAGE_KEY_PREFIX + currentPath); } catch(e) {}
    currentPath = '';
    currentContent = '';
  }

  window.Editor = { enter: enter, exit: exit };

  function addSidebarActions() {
    var sidebar = document.getElementById('sidebar');
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 12px 8px;font-size:12px;color:#8e8e93';
    header.innerHTML = '<span>笔记列表</span>' +
      '<span style="cursor:pointer;font-size:16px;display:flex;gap:4px">' +
        '<span id="sidebarNewNote" title="新建笔记" style="cursor:pointer;padding:2px 6px;border-radius:4px;transition:background.1s">➕</span>' +
      '</span>';
    var fileTree = document.getElementById('fileTree');
    sidebar.insertBefore(header, fileTree);

    document.getElementById('sidebarNewNote').onmouseover = function() { this.style.background = '#f0f0f0'; };
    document.getElementById('sidebarNewNote').onmouseout = function() { this.style.background = 'transparent'; };
    document.getElementById('sidebarNewNote').onclick = function() {
      if (!getToken()) { showTokenDialog(); return; }
      createNewNote();
    };
  }

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
      var encoder = new TextEncoder();
      var bytes = encoder.encode(contentText);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

      var body = {
        message: 'create: ' + fullPath,
        content: btoa(binary),
        branch: window.__NOTE_BRANCH || 'master'
      };

      var resp = await fetch(url, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
      if (resp.ok) {
        var result = await resp.json();
        var newSha = result.content.sha;
        Cache.setFile(fullPath, { sha: newSha, title: name.replace(/\.md$/, ''), content: contentText });
        Search.buildIndex();
        showToast('已创建: ' + name);
        await fetchAndSyncNotes();
        setTimeout(function() { onNoteSelect(fullPath); }, 300);
      } else {
        showToast('创建失败');
      }
    } catch (e) {
      showToast('创建出错: ' + e.message);
    }
  }

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

      var getResp = await fetch(baseUrl + '/contents/notes/' + oldPath, { headers: headers });
      if (!getResp.ok) { showToast('获取文件信息失败'); return; }
      var oldData = await getResp.json();

      var putBody = {
        message: 'rename: ' + oldPath + ' → ' + newPath,
        content: oldData.content,
        branch: window.__NOTE_BRANCH || 'master'
      };
      var putResp = await fetch(baseUrl + '/contents/notes/' + newPath, { method: 'PUT', headers: headers, body: JSON.stringify(putBody) });
      if (!putResp.ok) { showToast('创建新文件失败'); return; }

      var delBody = {
        message: 'delete: ' + oldPath,
        sha: oldData.sha,
        branch: window.__NOTE_BRANCH || 'master'
      };
      await fetch(baseUrl + '/contents/notes/' + oldPath, { method: 'DELETE', headers: headers, body: JSON.stringify(delBody) });

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

      setTimeout(function() {
        document.addEventListener('click', function closeMenu() {
          var m = document.getElementById('treeContextMenu');
          if (m) m.remove();
          document.removeEventListener('click', closeMenu);
        });
      }, 10);
    });
  }

  function init() {
    addSidebarActions();
    addContextMenu();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.createNewNote = createNewNote;
  window.renameNote = renameNote;
  window.deleteNote = deleteNote;
})();
