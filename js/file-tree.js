// js/file-tree.js — Directory tree UI component

(function() {
  let currentContainer = null;
  let currentOnSelect = null;

  function render(containerId, treeData, onSelect) {
    currentContainer = containerId;
    currentOnSelect = onSelect;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = buildTreeHtml(treeData, '');
    attachEvents(container);
  }

  function buildTreeHtml(nodes, parentPath) {
    let html = '';
    for (const node of nodes) {
      const path = parentPath ? parentPath + '/' + node.name : node.name;
      if (node.type === 'dir') {
        html += `<div class="tree-node" data-path="${path}" data-type="dir">
          <div class="tree-row dir-row" data-path="${path}">
            <span class="tree-arrow">▶</span>
            <span class="tree-icon">📁</span>
            <span class="tree-label">${escapeHtml(node.name)}</span>
          </div>
          <div class="tree-children" data-parent="${path}">
            ${node.children ? buildTreeHtml(node.children, path) : ''}
          </div>
        </div>`;
      } else if (node.type === 'file') {
        html += `<div class="tree-node" data-path="${path}" data-type="file">
          <div class="tree-row file-row" data-path="${path}">
            <span class="tree-arrow"></span>
            <span class="tree-icon">📄</span>
            <span class="tree-label">${escapeHtml(node.name.replace(/\.md$/i, ''))}</span>
          </div>
        </div>`;
      }
    }
    return html;
  }

  function attachEvents(container) {
    container.addEventListener('click', function(e) {
      const row = e.target.closest('.tree-row');
      if (!row) return;
      const treeNode = row.closest('.tree-node');
      if (!treeNode) return;
      const path = row.dataset.path;
      const type = treeNode.dataset.type;
      if (!path) return;

      if (type === 'dir') {
        const arrow = row.querySelector('.tree-arrow');
        const children = container.querySelector(`.tree-children[data-parent="${path}"]`);
        if (children) {
          children.classList.toggle('open');
          if (arrow) arrow.classList.toggle('open');
        }
        return;
      }

      if (type === 'file') {
        highlight(path);
        if (currentOnSelect) currentOnSelect(path);
      }
    });
  }

  function highlight(path) {
    const container = document.getElementById(currentContainer);
    if (!container) return;
    container.querySelectorAll('.tree-row.active').forEach(el => el.classList.remove('active'));
    const target = container.querySelector(`.tree-row[data-path="${CSS.escape(path)}"]`);
    if (target) target.classList.add('active');
  }

  function expandTo(path) {
    const container = document.getElementById(currentContainer);
    if (!container || !path) return;
    const parts = path.split('/');
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? currentPath + '/' + parts[i] : parts[i];
      const children = container.querySelector(`.tree-children[data-parent="${CSS.escape(currentPath)}"]`);
      const arrow = container.querySelector(`.tree-row[data-path="${CSS.escape(currentPath)}"] .tree-arrow`);
      if (children) children.classList.add('open');
      if (arrow) arrow.classList.add('open');
    }
  }

  function destroy() {
    const container = document.getElementById(currentContainer);
    if (container) container.innerHTML = '';
    currentContainer = null;
    currentOnSelect = null;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  window.FileTree = { render, highlight, expandTo, destroy, escapeHtml };
})();
