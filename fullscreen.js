(function () {
  "use strict";

  /* =========================================================
   * 全屏助手 - roche-fullscreen
   * 让 web 端 Roche（浏览器里运行）自动/手动全屏。
   * - 自动：页面打开后第一次任意交互（点击/触摸/按键）即进入全屏
   *   （浏览器强制要求全屏必须在用户手势中调用，无法启动即全屏）
   * - 手动：右下角悬浮毛玻璃圆形按钮，点击全屏 / 再点退出。
   *
   * 限制说明：
   *   - 安卓 Chrome / PC 浏览器：完全支持。
   *   - iOS Safari：requestFullscreen 对普通网页不生效
   *     （苹果限制），点击会给出提示；iOS 请用
   *     "添加到主屏幕"实现全屏。
   * ========================================================= */

  var UID = "rf";
  var STYLE_ID = "roche-fullscreen-style";
  var BTN_ID = "roche-fullscreen-btn";

  // Feather icons: maximize / minimize（精致，无 emoji）
  var ICON_ENTER =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
  var ICON_EXIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';

  function injectStyle() {
    try {
      if (document.getElementById(STYLE_ID)) return;
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent =
        "#" + BTN_ID + "{" +
          "position:fixed;right:18px;bottom:18px;z-index:2147483647;" +
          "width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;" +
          "display:flex;align-items:center;justify-content:center;" +
          "background:rgba(255,255,255,.72);" +
          "-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);" +
          "box-shadow:0 4px 20px rgba(0,0,0,.14),inset 0 0 0 1px rgba(255,255,255,.5);" +
          "color:#2b2f36;transition:transform .15s ease,box-shadow .15s ease;" +
          "}" +
        "#" + BTN_ID + ":hover{transform:scale(1.08);box-shadow:0 6px 26px rgba(0,0,0,.2),inset 0 0 0 1px rgba(255,255,255,.6);}" +
        "#" + BTN_ID + ":active{transform:scale(.96);}" +
        "#" + BTN_ID + " svg{width:24px;height:24px;display:block;pointer-events:none;}" +
        "#" + BTN_ID + ".rf-on{background:rgba(18,20,26,.78);color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.16);}";
      document.head.appendChild(style);
    } catch (e) { /* 忽略 */ }
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function enterFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) return Promise.resolve(el.requestFullscreen());
    if (el.webkitRequestFullscreen) return Promise.resolve(el.webkitRequestFullscreen());
    return Promise.reject(new Error("unsupported"));
  }

  function exitFullscreen() {
    if (document.exitFullscreen) return Promise.resolve(document.exitFullscreen());
    if (document.webkitExitFullscreen) return Promise.resolve(document.webkitExitFullscreen());
    return Promise.reject(new Error("unsupported"));
  }

  var btn = null;
  var tipTimer = null;
  var autoListeners = [];

  function cleanupAutoListeners() {
    for (var i = 0; i < autoListeners.length; i++) {
      var e = autoListeners[i];
      document.removeEventListener(e[0], e[1], true);
    }
    autoListeners = [];
  }

  // 浏览器安全限制：requestFullscreen 必须在用户手势中调用（启动时自动调用会被拒绝）。
  // 因此做成：页面打开后第一次任意交互（点击/触摸/按键）自动进入全屏，几乎无感。
  function autoFullscreenOnce() {
    if (typeof document === "undefined") return;
    var fired = false;
    var tryFs = function () {
      if (fired) return;
      fired = true;
      cleanupAutoListeners();
      if (isFullscreen()) return;
      enterFullscreen().catch(function () { /* iOS/不支持：静默，用户可用悬浮按钮 */ });
    };
    var events = ["click", "touchstart", "keydown"];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      document.addEventListener(ev, tryFs, true);
      autoListeners.push([ev, tryFs]);
    }
  }

  function showTip(text) {
    var tip = document.getElementById(UID + "-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = UID + "-tip";
      tip.style.cssText =
        "position:fixed;right:18px;bottom:84px;z-index:2147483647;" +
        "max-width:240px;padding:10px 14px;border-radius:12px;" +
        "font-size:13px;line-height:1.5;color:#fff;" +
        "background:rgba(18,20,26,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);" +
        "box-shadow:0 4px 18px rgba(0,0,0,.2);transition:opacity .25s ease;";
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.opacity = "1";
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.style.opacity = "0"; }, 2600);
  }

  function render() {
    if (typeof document === "undefined") return;
    injectStyle();
    if (document.getElementById(BTN_ID)) return; // 防重复

    btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.setAttribute("aria-label", "切换全屏");
    btn.innerHTML = ICON_ENTER;

    btn.addEventListener("click", function () {
      if (isFullscreen()) {
        exitFullscreen().catch(function () { /* 忽略 */ });
      } else {
        enterFullscreen().catch(function () {
          showTip("当前浏览器不支持一键全屏，可尝试浏览器自带全屏，或 iOS 用「添加到主屏幕」");
        });
      }
    });

    var onFsChange = function () {
      if (!btn) return;
      var on = isFullscreen();
      btn.classList.toggle("rf-on", on);
      btn.innerHTML = on ? ICON_EXIT : ICON_ENTER;
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    btn.__rfOnFsChange = onFsChange;

    (document.body || document.documentElement).appendChild(btn);
    autoFullscreenOnce();
  }

  function cleanup() {
    try {
      cleanupAutoListeners();
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
      var tip = document.getElementById(UID + "-tip");
      if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
      if (btn && btn.__rfOnFsChange) {
        document.removeEventListener("fullscreenchange", btn.__rfOnFsChange);
        document.removeEventListener("webkitfullscreenchange", btn.__rfOnFsChange);
      }
      var style = document.getElementById(STYLE_ID);
      if (style && style.parentNode) style.parentNode.removeChild(style);
    } catch (e) { /* 忽略 */ }
    btn = null;
  }

  // ===== 生命周期 =====
  function mount(container, roche) { render(); }
  function unmount(container, roche) { cleanup(); }

  // ===== 导出（兼容 window / module） =====
  var api = { mount: mount, unmount: unmount };
  if (typeof window !== "undefined") {
    window.RocheFullscreen = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
