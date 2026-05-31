(function () {
  function storageKey(postId, action) {
    return "tensorcat-blog:" + action + ":" + postId;
  }

  function getLiked(postId) {
    return window.localStorage.getItem(storageKey(postId, "liked")) === "true";
  }

  function setLiked(postId, value) {
    window.localStorage.setItem(storageKey(postId, "liked"), value ? "true" : "false");
  }

  function getBookmarked(postId) {
    return window.localStorage.getItem(storageKey(postId, "bookmarked")) === "true";
  }

  function setBookmarked(postId, value) {
    window.localStorage.setItem(storageKey(postId, "bookmarked"), value ? "true" : "false");
  }

  function syncPost(postId) {
    var likeButtons = document.querySelectorAll('[data-blog-action="like"][data-post-id="' + postId + '"]');
    var bookmarkButtons = document.querySelectorAll('[data-blog-action="bookmark"][data-post-id="' + postId + '"]');
    var liked = getLiked(postId);
    var bookmarked = getBookmarked(postId);

    likeButtons.forEach(function (button) {
      var baseCount = Number(button.getAttribute("data-initial-count") || "0");
      var count = button.querySelector("[data-like-count]");
      button.classList.toggle("is-active", liked);
      button.setAttribute("aria-pressed", liked ? "true" : "false");
      if (count) count.textContent = String(baseCount + (liked ? 1 : 0));
    });

    bookmarkButtons.forEach(function (button) {
      button.classList.toggle("is-active", bookmarked);
      button.setAttribute("aria-pressed", bookmarked ? "true" : "false");
    });
  }

  function syncAll() {
    var posts = {};
    document.querySelectorAll("[data-post-id]").forEach(function (element) {
      var postId = element.getAttribute("data-post-id");
      if (postId) posts[postId] = true;
    });
    Object.keys(posts).forEach(syncPost);
  }

  function ensureShareToast() {
    var toast = document.querySelector("[data-share-toast]");
    if (toast) return toast;

    toast = document.createElement("div");
    toast.className = "blog-share-toast";
    toast.setAttribute("data-share-toast", "");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = '<div class="blog-share-toast-title">Share link copied</div><div class="blog-share-toast-url"></div>';
    document.body.appendChild(toast);
    return toast;
  }

  function showShareToast(url, copied) {
    var toast = ensureShareToast();
    var titleNode = toast.querySelector(".blog-share-toast-title");
    var urlNode = toast.querySelector(".blog-share-toast-url");
    if (titleNode) titleNode.textContent = copied === false ? "Copy unavailable" : "Share link copied";
    if (urlNode) urlNode.textContent = url;

    window.clearTimeout(showShareToast.timer);
    toast.classList.remove("is-visible");
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        toast.classList.add("is-visible");
      });
    });

    showShareToast.timer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2300);
  }

  function copyTextWithTextarea(text) {
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      try {
        if (document.execCommand("copy")) {
          resolve();
        } else {
          reject(new Error("Copy command failed"));
        }
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(textarea);
      }
    });
  }

  function copyText(text) {
    var browserNavigator = window.navigator;
    if (browserNavigator && browserNavigator.clipboard && browserNavigator.clipboard.writeText) {
      return browserNavigator.clipboard.writeText(text).catch(function () {
        return copyTextWithTextarea(text);
      });
    }

    return copyTextWithTextarea(text);
  }

  function share(button) {
    var url = button.getAttribute("data-share-url") || window.location.href;
    copyText(url).then(function () {
      showShareToast(url, true);
    }).catch(function () {
      showShareToast(url, false);
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-blog-action]");
    if (!button) return;
    var action = button.getAttribute("data-blog-action");
    var postId = button.getAttribute("data-post-id");
    if (action === "like" && postId) {
      setLiked(postId, !getLiked(postId));
      syncPost(postId);
    }
    if (action === "bookmark" && postId) {
      setBookmarked(postId, !getBookmarked(postId));
      syncPost(postId);
    }
    if (action === "share") {
      share(button);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncAll);
  } else {
    syncAll();
  }
})();
