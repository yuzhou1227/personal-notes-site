(function() {
  var navEl = null;
  var headings = [];
  var observer = null;

  function build() {
    destroy();
    var article = document.getElementById('articleContent');
    if (!article) return;

    var hTags = article.querySelectorAll('h1, h2, h3');
    if (hTags.length < 2) return;

    headings = [];
    hTags.forEach(function(h, i) {
      var id = 'outline-h-' + i;
      h.id = h.id || id;
      headings.push({
        id: h.id,
        text: h.textContent.trim(),
        level: parseInt(h.tagName[1], 10),
        el: h
      });
    });

    navEl = document.createElement('nav');
    navEl.id = 'outlineNav';
    navEl.innerHTML = '<div id="outlineHeader"><span id="outlineToggle">📋</span> 目录</div><ul id="outlineList"></ul>';

    var list = navEl.querySelector('#outlineList');
    headings.forEach(function(h) {
      var li = document.createElement('li');
      li.className = 'outline-item level-' + h.level;
      li.textContent = h.text;
      li.dataset.target = h.id;
      li.addEventListener('click', function() {
        var target = document.getElementById(h.id);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        list.querySelectorAll('.outline-item.active').forEach(function(a) { a.classList.remove('active'); });
        li.classList.add('active');
      });
      list.appendChild(li);
    });

    article.parentElement.appendChild(navEl);

    if (window.IntersectionObserver) {
      observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var id = entry.target.id;
            list.querySelectorAll('.outline-item.active').forEach(function(a) { a.classList.remove('active'); });
            var match = list.querySelector('.outline-item[data-target="' + id + '"]');
            if (match) match.classList.add('active');
          }
        });
      }, { rootMargin: '-80px 0px -60% 0px' });

      headings.forEach(function(h) {
        observer.observe(h.el);
      });
    }

    var toggle = navEl.querySelector('#outlineToggle');
    toggle.addEventListener('click', function() {
      navEl.classList.toggle('collapsed');
      sessionStorage.setItem('outline_collapsed', navEl.classList.contains('collapsed'));
    });

    if (sessionStorage.getItem('outline_collapsed') === 'true') {
      navEl.classList.add('collapsed');
    }
  }

  function destroy() {
    if (observer) { observer.disconnect(); observer = null; }
    if (navEl) { navEl.remove(); navEl = null; }
    headings = [];
  }

  window.Outline = { build: build, destroy: destroy };
})();
