/* 巴菲特持仓分析 · 门禁配置
 * 只需改这里，无需动其他文件。改完重新推送即可生效。
 */
window.GATE_CONFIG = {
  password: 'buffett2026',   // 访问口令：关注公众号后回复关键词，由你把口令告诉读者
  keyword: '持仓',           // 提示读者在公众号回复的关键词
  accountName: '酒里加盐',     // 公众号名称；留空则只显示二维码，不写名称
  qr: 'qrcode.jpg',          // 二维码图片路径（放在 public 目录下）
  rememberDays: 30           // 解锁后记住多少天，过期需重新输入
};
