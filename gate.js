/* 巴菲特持仓分析 · 口令门禁
 * 静态站点无法读取微信关注状态，故采用「扫码关注 → 公众号自动回复 → 专属链接/口令解锁」。
 * 两种解锁方式：
 *   1) 公众号自动回复里放带 key 参数的专属链接，点进来自动解锁（推荐）
 *   2) 手动输入口令
 * 解锁后用 localStorage 记住，rememberDays 天后过期。
 */
(function () {
  'use strict';

  var CFG = window.GATE_CONFIG || {};
  var PASSWORD = CFG.password || 'buffett2026';
  var DAYS = Number(CFG.rememberDays) || 30;
  var KEY = 'bh_gate_unlock_at';

  function isUnlocked() {
    try {
      var t = Number(localStorage.getItem(KEY));
      if (!t || isNaN(t)) return false;
      if (Date.now() - t > DAYS * 86400000) {
        localStorage.removeItem(KEY);
        return false;
      }
      return true;
    } catch (e) { return false; }
  }

  // 专属链接解锁：URL 里带 ?key=<口令> 或 #<口令>，命中则自动解锁并清掉地址里的口令
  var urlKey = (function () {
    var q = null;
    try {
      var m = location.search.match(/[?&]key=([^&]+)/);
      if (m) q = decodeURIComponent(m[1]);
      if (!q && location.hash && location.hash.length > 1) q = decodeURIComponent(location.hash.slice(1));
    } catch (e) {}
    return q;
  })();

  function clearUrlKey() {
    try {
      var parts = location.search.replace(/^\?/, '').split('&').filter(function (p) {
        return p && p.indexOf('key=') !== 0;
      });
      var clean = location.pathname + (parts.length ? '?' + parts.join('&') : '');
      history.replaceState(null, '', clean);
    } catch (e) {}
  }

  function unlock() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    var gate = document.getElementById('gate');
    var app = document.getElementById('app');
    var wrap = document.getElementById('appWrap');
    if (gate) gate.style.display = 'none';
    if (app) app.style.display = '';
    if (wrap) wrap.style.visibility = 'visible';
    // 通知主应用可以加载数据 / 初始化图表
    document.dispatchEvent(new CustomEvent('gate:unlocked'));
    // 遮罩隐藏后再 resize 一次，避免 ECharts 在 display:none 时算成 0 宽
    setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
    }, 60);
  }

  function init() {
    // 填充配置文案
    var acc = document.getElementById('gateAccount');
    var kw = document.getElementById('gateKeyword');
    var qr = document.getElementById('gateQr');
    if (acc) {
      var name = (CFG.accountName || '').trim();
      if (name) { acc.textContent = '「' + name + '」'; }
      else { acc.style.display = 'none'; }
    }
    if (kw) kw.textContent = CFG.keyword || '口令';
    if (qr && CFG.qr) qr.src = CFG.qr;
    var days = document.getElementById('gateDays');
    if (days) days.textContent = DAYS;

    if (urlKey && urlKey === PASSWORD) { clearUrlKey(); unlock(); return; }
    if (isUnlocked()) { unlock(); return; }

    var input = document.getElementById('gatePass');
    var btn = document.getElementById('gateBtn');
    var err = document.getElementById('gateErr');

    function submit() {
      var val = (input.value || '').trim();
      if (!val) { showErr('请输入访问口令'); return; }
      if (val === PASSWORD) {
        err.textContent = '';
        unlock();
      } else {
        showErr('口令不正确，请确认已关注公众号并回复「' + (CFG.keyword || '关键词') + '」获取');
        input.select();
      }
    }
    function showErr(msg) { if (err) err.textContent = msg; }

    if (btn) btn.addEventListener('click', submit);
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); submit(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
