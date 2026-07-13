(function () {
  var pagefind = null;
  var selectedIndex = -1;
  var resultItems = [];
  var timer;

  function getElements() {
    return {
      container: document.getElementById("search-container"),
      dialog: document.getElementById("search-dialog"),
      input: document.getElementById("search-input"),
      results: document.getElementById("search-results"),
      btn: document.getElementById("search-btn"),
    };
  }

  async function loadPagefind() {
    if (pagefind) return pagefind;
    try {
      var pf = window.__pagefind__;
      if (!pf) {
        var mod = await import("/pagefind/pagefind.js");
        pagefind = mod;
      } else {
        pagefind = pf;
      }
      if (pagefind && pagefind.options) {
        await pagefind.options({ baseUrl: "/" });
      }
      return pagefind;
    } catch (e) {
      return null;
    }
  }

  function showDialog() {
    var els = getElements();
    if (!els.dialog || !els.input) return;
    els.dialog.showModal();
    els.input.focus();
  }

  function closeDialog() {
    var els = getElements();
    if (!els.dialog) return;
    els.dialog.close();
    if (els.input) els.input.value = "";
    if (els.results) els.results.innerHTML = '<p class="search-hint">输入关键词开始搜索</p>';
    selectedIndex = -1;
    resultItems = [];
  }

  async function doSearch(query) {
    var els = getElements();
    if (!els.results) return;

    if (!query.trim()) {
      els.results.innerHTML = '<p class="search-hint">输入关键词开始搜索</p>';
      resultItems = [];
      return;
    }

    els.results.innerHTML = '<p class="search-loading">搜索中...</p>';

    var pf = await loadPagefind();
    if (!pf) {
      els.results.innerHTML = '<p class="search-error">搜索索引不可用。请完成生产构建后再试。</p>';
      return;
    }

    try {
      var search = await pf.search(query.trim(), {});
      if (!search || !search.results || search.results.length === 0) {
        els.results.innerHTML = '<p class="search-empty">未找到相关文章</p>';
        resultItems = [];
        return;
      }

      var items = search.results.slice(0, 10);
      resultItems = items;
      selectedIndex = -1;

      var html = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var data = await item.data();
        var tagsHtml = "";
        if (data.meta && data.meta.tags) {
          tagsHtml = '<div class="search-result-tags">' + data.meta.tags + "</div>";
        }
        html.push(
          '<a href="' +
            data.url +
            '" class="search-result-item" data-index="' +
            i +
            '">' +
            '<div class="search-result-title">' +
            ((data.meta && data.meta.title) || data.url) +
            "</div>" +
            '<div class="search-result-excerpt">' +
            (data.excerpt || "") +
            "</div>" +
            tagsHtml +
            "</a>",
        );
      }

      els.results.innerHTML = html.join("");
      updateSelection(0);
    } catch (e) {
      els.results.innerHTML = '<p class="search-error">搜索时出错</p>';
      resultItems = [];
    }
  }

  function updateSelection(index) {
    var els = getElements();
    if (!els.results) return;

    var items = els.results.querySelectorAll(".search-result-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove("selected");
    }
    var next = els.results.querySelector('.search-result-item[data-index="' + index + '"]');
    if (next) {
      next.classList.add("selected");
      selectedIndex = index;
    }
  }

  function setupSearchPage() {
    var pageInput = document.getElementById("search-page-input");
    var pageResults = document.getElementById("search-page-results");
    if (!pageInput || !pageResults) return;

    var pageTimer;
    pageInput.addEventListener("input", function () {
      clearTimeout(pageTimer);
      pageTimer = setTimeout(async function () {
        var query = pageInput.value.trim();
        if (!query) {
          pageResults.innerHTML = '<p class="search-page-empty">输入关键词开始搜索</p>';
          return;
        }

        pageResults.innerHTML = '<p class="search-page-empty">搜索中...</p>';

        var pf = await loadPagefind();
        if (!pf) {
          pageResults.innerHTML =
            '<p class="search-page-empty">搜索索引不可用。请完成生产构建后再搜索。</p>';
          return;
        }

        try {
          var search = await pf.search(query, {});
          if (!search || !search.results || search.results.length === 0) {
            pageResults.innerHTML = '<p class="search-page-empty">未找到相关文章</p>';
            return;
          }

          var html = [];
          var items = search.results.slice(0, 15);
          for (var i = 0; i < items.length; i++) {
            var data = await items[i].data();
            html.push(
              '<a href="' +
                data.url +
                '" class="search-page-item">' +
                '<div class="search-page-item-title">' +
                ((data.meta && data.meta.title) || data.url) +
                "</div>" +
                '<div class="search-page-item-excerpt">' +
                (data.excerpt || "") +
                "</div>" +
                "</a>",
            );
          }
          pageResults.innerHTML = html.join("");
        } catch (e) {
          pageResults.innerHTML = '<p class="search-page-empty">搜索时出错</p>';
        }
      }, 300);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
        e.preventDefault();
        pageInput.focus();
      }
    });
  }

  // Initialize dialog-based search
  document.addEventListener("DOMContentLoaded", function () {
    var els = getElements();

    // Dialog search
    if (els.dialog && els.input && els.results) {
      // Expose open method
      if (els.container) els.container.openSearch = showDialog;

      if (els.btn) {
        els.btn.addEventListener("click", function () {
          showDialog();
        });
      }

      els.input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (resultItems.length > 0) {
            updateSelection(Math.min(selectedIndex + 1, resultItems.length - 1));
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (resultItems.length > 0) {
            updateSelection(Math.max(selectedIndex - 1, 0));
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (selectedIndex >= 0) {
            var item = els.results.querySelector(
              '.search-result-item[data-index="' + selectedIndex + '"]',
            );
            if (item) item.click();
          }
        } else if (e.key === "Escape") {
          closeDialog();
        }
      });

      els.input.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          doSearch(els.input.value);
        }, 200);
      });

      els.dialog.addEventListener("click", function (e) {
        if (e.target === els.dialog) closeDialog();
      });
    }

    // Dedicated search page
    setupSearchPage();

    // Keyboard shortcuts
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        showDialog();
      }
    });
  });
})();
