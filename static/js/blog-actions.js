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

  function share(button) {
    var url = button.getAttribute("data-share-url") || window.location.href;
    var title = button.getAttribute("data-share-title") || document.title;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        var label = button.querySelector("span:last-child");
        if (!label) return;
        var previous = label.textContent;
        label.textContent = "Copied";
        window.setTimeout(function () {
          label.textContent = previous;
        }, 1400);
      });
    }
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
