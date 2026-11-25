/* 巴菲特持仓分析 · 前端渲染 */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var charts = [];

  function fmtB(v) { return '$' + (v / 1e9).toFixed(1) + 'B'; }
  function fmtB2(v) { return '$' + (v / 1e9).toFixed(2) + 'B'; }
  function fmtInt(n) {
    return (n || 0).toLocaleString('en-US');
  }
  function pct(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return (n > 0 ? '+' : '') + Number(n).toFixed(2) + '%';
  }
  function cls(n) {
    if (n === null || n === undefined || isNaN(n)) return 'flat';
    if (n > 0) return 'up';
    if (n < 0) return 'down';
    return 'flat';
  }
  function sign(v) { return v > 0 ? '+' : ''; }
  function money0(v) { return (v > 0 ? '+$' : '-$') + Math.abs(v / 1e9).toFixed(2) + 'B'; }
  function dateCN(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function makeChart(id, option) {
    var el = document.getElementById(id);
    if (!el || typeof echarts === 'undefined') return;
    var c = echarts.init(el);
    c.setOption(option);
    charts.push(c);
  }

  // 主色板（克制：深蓝系 + 灰度，涨红跌绿单列）
  var PALETTE = ['#1f3a5f', '#2c5282', '#3f6ca5', '#6b8fc0', '#93acd1', '#b6c7de', '#d3ddea', '#8ea0b8', '#5b7191', '#40587a'];

  function render(d) {
    var H = d.holdings || [];
    var S = d.summary || {};
    var top = H.slice(0, 10);
    var total = S.totalCurrent || 1;

    // 头部标签
    $('#metaRow').innerHTML = [
      '<span class="tag">报告期 ' + esc(d.reportDate || '—') + '</span>',
      '<span class="tag">申报日 ' + esc(d.filingDate || '—') + '</span>',
      '<span class="tag live"><span class="dot"></span>数据更新 ' + dateCN(d.updatedAt) + '</span>',
      '<span class="tag">行情时点 ' + esc(d.quoteTime || '见下表') + '</span>'
    ].join('');

    var dayCls = cls(S.dayChangePct);
    var tldrHtml =
      '<div class="tldr">' +
        '<h2>核心概览 · TL;DR</h2>' +
        '<div class="tldr-grid">' +
          '<div class="kpi"><div class="label">组合当前市值</div><div class="value">' + fmtB(S.totalCurrent) + '</div><div class="note">按最新价 × 持股数</div></div>' +
          '<div class="kpi"><div class="label">13F 报告期市值</div><div class="value">' + fmtB(S.totalReport) + '</div><div class="note">' + esc(d.reportDate || '—') + ' 披露值</div></div>' +
          '<div class="kpi"><div class="label">当日组合变动</div><div class="value ' + dayCls + '">' + money0(S.totalDayChange) + '</div><div class="note ' + dayCls + '">' + pct(S.dayChangePct) + ' 估算</div></div>' +
          '<div class="kpi"><div class="label">持仓标的</div><div class="value">' + (S.count || H.length) + '</div><div class="note">发行人（已合并股类）</div></div>' +
          '<div class="kpi"><div class="label">第一大持仓</div><div class="value">' + (top[0] ? top[0].name : '—') + '</div><div class="note">' + (top[0] ? ((top[0].currentValue / total) * 100).toFixed(1) + '% 占比' : '—') + '</div></div>' +
        '</div>' +
      '</div>';

    // 行业聚合
    var sectorMap = {};
    H.forEach(function (h) { sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.currentValue; });
    var sectorArr = Object.keys(sectorMap).map(function (k) { return { name: k, value: sectorMap[k] }; }).sort(function (a, b) { return b.value - a.value; });

    // 集中度
    function cr(n) {
      var s = 0;
      for (var i = 0; i < Math.min(n, H.length); i++) s += H[i].currentValue;
      return (s / total * 100).toFixed(1);
    }

    // 当日涨跌榜（有报价的）
    var movers = H.filter(function (h) { return h.changePct !== null && h.changePct !== undefined; })
      .slice().sort(function (a, b) { return Math.abs(b.changePct) - Math.abs(a.changePct); }).slice(0, 10);

    var body =
      '<div class="grid">' +
        '<div class="card">' +
          '<h3>TOP 10 持仓市值</h3>' +
          '<div class="cap">按最新价估值 · 单位十亿美元</div>' +
          '<div id="chartTop" class="chart"></div>' +
          '<div class="src">来源：SEC EDGAR 13F（报告期 ' + esc(d.reportDate || '—') + '）持股数 × Nasdaq 最新价 ' + esc(d.quoteTime || '') + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<h3>行业配置分布</h3>' +
          '<div class="cap">按当前市值占比</div>' +
          '<div id="chartSector" class="chart"></div>' +
          '<div class="src">行业为手动归类，仅供结构参考</div>' +
        '</div>' +

        '<div class="card full">' +
          '<h3>持仓集中度</h3>' +
          '<div class="cap">前 N 大持仓占总市值比例 · 衡量组合集中程度</div>' +
          '<div class="conc">' +
            '<div class="box"><div class="n">' + cr(3) + '%</div><div class="t">CR3 前三</div></div>' +
            '<div class="box"><div class="n">' + cr(5) + '%</div><div class="t">CR5 前五</div></div>' +
            '<div class="box"><div class="n">' + cr(10) + '%</div><div class="t">CR10 前十</div></div>' +
            '<div class="box"><div class="n">' + H.filter(function (h) { return h.currentValue / total > 0.05; }).length + '</div><div class="t">占比＞5% 标的</div></div>' +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<h3>当日涨跌幅 TOP 10</h3>' +
          '<div class="cap">红涨绿跌 · 按绝对涨跌幅排序</div>' +
          '<div id="chartMovers" class="chart chart-sm"></div>' +
          '<div class="src">来源：Nasdaq 官方报价接口，涨跌幅为个股当日变动（非组合贡献）</div>' +
        '</div>' +
        '<div class="card">' +
          '<h3>组合市值构成</h3>' +
          '<div class="cap">全部 ' + H.length + ' 个发行人占比（TOP 8 + 其他）</div>' +
          '<div id="chartPie" class="chart chart-sm"></div>' +
        '</div>' +

        '<div class="card full">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">' +
            '<div><h3>全部持仓明细</h3><div class="cap" style="margin:0">点击表头可排序 · 市值按最新价估算</div></div>' +
            '<div class="toggle"><button id="btnTable" class="on">表格</button><button id="btnChart">图表</button></div>' +
          '</div>' +
          '<div id="tableWrap" class="table-wrap">' + buildTable(H, total) + '</div>' +
          '<div id="chartWrap" class="table-wrap" style="display:none"><div id="chartAll" class="chart" style="height:520px"></div></div>' +
        '</div>' +
      '</div>';

    $('#app').innerHTML = tldrHtml + body;

    $('#sourceInfo').innerHTML =
      '<strong>数据来源与时点</strong><br>' +
      '· 持仓股数与报告期市值：' + esc(d.source && d.source.holdings || 'SEC EDGAR 13F') + '，报告期 ' + esc(d.reportDate || '—') + '，申报日 ' + esc(d.filingDate || '—') + '。13F 为季度披露，持仓可能有最多 45 天滞后。<br>' +
      '· 最新价与当日涨跌：' + esc(d.source && d.source.prices || 'Nasdaq') + '，行情时点 ' + esc(d.quoteTime || '见各标的') + '。<br>' +
      '· 当前市值 = 13F 披露持股数 × 最新价，为估算值，不等同于实际市值；合并股类（如谷歌 A/C、莱纳 A/B）用主股类价格近似。';

    // ---- ECharts ----
    var topNames = top.map(function (h) { return h.name; }).reverse();
    var topVals = top.map(function (h) { return +(h.currentValue / 1e9).toFixed(2); }).reverse();
    makeChart('chartTop', {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: ${c}B' },
      grid: { left: 76, right: 24, top: 8, bottom: 24 },
      xAxis: { type: 'value', name: '十亿美元', axisLabel: { color: '#5b6474' }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'category', data: topNames, axisLabel: { color: '#1a2130', fontSize: 12 } },
      series: [{
        type: 'bar', data: topVals, barWidth: '58%',
        itemStyle: { color: '#1f3a5f', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: '${c}B', fontSize: 11, color: '#5b6474' }
      }]
    });

    makeChart('chartSector', {
      tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
      legend: { orient: 'vertical', right: 4, top: 'center', textStyle: { fontSize: 11, color: '#5b6474' } },
      series: [{
        type: 'pie', radius: ['42%', '70%'], center: ['36%', '50%'],
        data: sectorArr.map(function (s, i) { return { name: s.name, value: +(s.value / 1e9).toFixed(2), itemStyle: { color: PALETTE[i % PALETTE.length] } }; }),
        label: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 2 }
      }]
    });

    var mvNames = movers.map(function (h) { return h.ticker || h.name; }).reverse();
    var mvVals = movers.map(function (h) { return Number(h.changePct.toFixed(2)); }).reverse();
    makeChart('chartMovers', {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c}%' },
      grid: { left: 56, right: 30, top: 8, bottom: 24 },
      xAxis: { type: 'value', name: '%', axisLabel: { color: '#5b6474' }, splitLine: { lineStyle: { color: '#eef1f6' } } },
      yAxis: { type: 'category', data: mvNames, axisLabel: { color: '#1a2130', fontSize: 11 } },
      series: [{
        type: 'bar', barWidth: '58%',
        data: mvVals.map(function (v) { return { value: v, itemStyle: { color: v >= 0 ? '#c0392b' : '#1e8449', borderRadius: v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } }; }),
        label: { show: true, position: 'right', formatter: function (p) { return sign(p.value) + p.value + '%'; }, fontSize: 11, color: '#5b6474' }
      }]
    });

    var pieTop = H.slice(0, 8).map(function (h) { return { name: h.name, value: +(h.currentValue / 1e9).toFixed(2) }; });
    var other = H.slice(8).reduce(function (s, h) { return s + h.currentValue; }, 0);
    if (other > 0) pieTop.push({ name: '其他', value: +(other / 1e9).toFixed(2) });
    makeChart('chartPie', {
      tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
      legend: { type: 'scroll', orient: 'vertical', right: 2, top: 'middle', textStyle: { fontSize: 10, color: '#5b6474' } },
      series: [{
        type: 'pie', radius: ['40%', '68%'], center: ['34%', '50%'],
        data: pieTop.map(function (p, i) { return { name: p.name, value: p.value, itemStyle: { color: i === pieTop.length - 1 && p.name === '其他' ? '#b6c7de' : PALETTE[i % PALETTE.length] } }; }),
        label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 2 }
      }]
    });

    // 图/表切换
    var allChartReady = false;
    $('#btnTable').addEventListener('click', function () {
      $('#tableWrap').style.display = '';
      $('#chartWrap').style.display = 'none';
      this.classList.add('on'); $('#btnChart').classList.remove('on');
    });
    $('#btnChart').addEventListener('click', function () {
      $('#tableWrap').style.display = 'none';
      $('#chartWrap').style.display = '';
      this.classList.add('on'); $('#btnTable').classList.remove('on');
      if (!allChartReady) {
        var names = H.map(function (h) { return h.name; }).reverse();
        var vals = H.map(function (h) { return +(h.currentValue / 1e9).toFixed(2); }).reverse();
        makeChart('chartAll', {
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: ${c}B' },
          grid: { left: 130, right: 40, top: 8, bottom: 24 },
          xAxis: { type: 'value', name: '十亿美元', splitLine: { lineStyle: { color: '#eef1f6' } } },
          yAxis: { type: 'category', data: names, axisLabel: { fontSize: 10, color: '#1a2130' } },
          series: [{ type: 'bar', data: vals, barWidth: '70%', itemStyle: { color: '#2c5282', borderRadius: [0, 3, 3, 0] } }]
        });
        allChartReady = true;
      }
    });

    // 表格排序
    $('#tableWrap').addEventListener('click', function (e) {
      var th = e.target.closest('th[data-sort]');
      if (!th) return;
      var key = th.getAttribute('data-sort');
      var asc = th.getAttribute('data-asc') !== '1';
      th.setAttribute('data-asc', asc ? '1' : '0');
      var sorted = H.slice().sort(function (a, b) {
        var x = a[key], y = b[key];
        if (x === null || x === undefined) x = -Infinity;
        if (y === null || y === undefined) y = -Infinity;
        if (typeof x === 'string') return asc ? x.localeCompare(y) : y.localeCompare(x);
        return asc ? x - y : y - x;
      });
      $('#tableWrap').innerHTML = buildTable(sorted, total);
    });

    window.addEventListener('resize', function () { charts.forEach(function (c) { c.resize(); }); });
  }

  function buildTable(H, total) {
    var rows = H.map(function (h, i) {
      var w = (h.currentValue / total * 100).toFixed(1);
      var chg = pct(h.changePct);
      return '<tr>' +
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td class="cname">' + esc(h.name) + '</td>' +
        '<td><span class="ticker">' + esc(h.ticker || '—') + '</span></td>' +
        '<td><span class="sector-pill">' + esc(h.sector) + '</span></td>' +
        '<td>' + fmtInt(h.shares) + '</td>' +
        '<td>' + (h.price !== null && h.price !== undefined ? '$' + Number(h.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—') + '</td>' +
        '<td class="' + cls(h.changePct) + '">' + chg + '</td>' +
        '<td>' + fmtB2(h.currentValue) + '</td>' +
        '<td class="hl">' + w + '%</td>' +
        '</tr>';
    }).join('');
    return '<table><thead><tr>' +
      '<th>#</th>' +
      '<th data-sort="name">公司</th>' +
      '<th data-sort="ticker">代码</th>' +
      '<th data-sort="sector">行业</th>' +
      '<th data-sort="shares">持股数</th>' +
      '<th data-sort="price">最新价</th>' +
      '<th data-sort="changePct">当日涨跌</th>' +
      '<th data-sort="currentValue">当前市值</th>' +
      '<th data-sort="currentValue">占比</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function load() {
    // GitHub Pages / 静态托管：直接读相对路径的静态 JSON（天然适配子路径 /buffett-holdings/）
    // Node 服务环境：优先 API（可触发后台刷新），失败再退回静态 JSON
    var isStatic = /github\.io/i.test(location.hostname) || /\/\.github\.io\//.test(location.pathname);
    var tryApi = !isStatic;
    var p = tryApi
      ? fetch('api/holdings', { cache: 'no-store' }).then(function (r) {
          if (!r.ok) throw new Error('api ' + r.status); return r.json();
        })
      : Promise.reject(new Error('static host'));

    p.catch(function () {
      return fetch('data/holdings.json', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('json ' + r.status); return r.json();
      });
    })
      .then(function (d) { render(d); })
      .catch(function (e) {
        $('#app').innerHTML = '<div class="err">数据加载失败：' + esc(e.message) + '<br>请通过已发布链接访问。</div>';
      });
  }

  // 门禁：未解锁时不加载数据；解锁事件触发后再加载，避免 ECharts 在隐藏容器内算成 0 宽
  var gateEl = document.getElementById('gate');
  if (gateEl) {
    // gate.js 在 app.js 之前执行：若此前已解锁，事件已派发过，这里直接补加载
    if (gateEl.style.display === 'none') {
      load();
    } else {
      document.addEventListener('gate:unlocked', function () { load(); });
    }
  } else {
    load();
  }
})();
