// ══════════════════════════════════════════════
// app.js — 共享核心逻辑（无状态版本）
// ══════════════════════════════════════════════

// ── 工具函数 ──────────────────────────────────
const sym = { USD: '$', HKD: 'HK$', CNY: '¥', SGD: 'S$' };

function fmt(n, c = 'USD') {
  if (!n && n !== 0) return '--';
  const s = sym[c] || '$';
  if (Math.abs(n) >= 1e6) return s + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1000) return s + (n / 1000).toFixed(1) + 'K';
  return s + Math.round(n).toLocaleString();
}
function pct(a, b) { return b ? ((a / b) * 100).toFixed(1) + '%' : '0%'; }
function cl(n, a, b) { return Math.min(b, Math.max(a, n)); }
function g(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
function v(id) { return document.getElementById(id)?.value || ''; }
function el(id) { return document.getElementById(id); }

function timeAgo(iso) {
  if (!iso) return '--';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + '分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '小时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + '天前';
  return new Date(iso).toLocaleDateString('zh-CN');
}

function formatDate(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// ── Toast 通知 ────────────────────────────────
function toast(msg, type = 'success') {
  let wrap = el('toast');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toast'; document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = 'toast-item ' + type;
  t.innerHTML = (type === 'success' ? '✓' : '✕') + ' ' + msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── 财务评分引擎 ──────────────────────────────
function calcScores(d) {
  const sc = {};
  sc.emergency = cl(d.emergencyCoverage * 20, 0, 20);
  sc.savings = cl(d.savingsRate * 100 > 20 ? 20 : d.savingsRate * 100, 0, 20);
  sc.debt = cl(d.debtRatio < 0.15 ? 20 : d.debtRatio < 0.3 ? 15 : d.debtRatio < 0.5 ? 8 : 2, 0, 20);
  sc.passive = cl(d.passiveRatio * 40, 0, 20);
  const nz = [d.cash, d.savingsPlan, d.trust, d.property, d.stocks, d.gold].filter(x => x > 0).length;
  sc.diversify = cl(nz * 3.5, 0, 20);
  sc.total = Math.round(Object.values(sc).reduce((a, b) => a + b, 0));
  sc.label = sc.total >= 80 ? '优秀' : sc.total >= 60 ? '良好' : sc.total >= 40 ? '需改善' : '需紧急优化';
  sc.color = sc.total >= 80 ? 'var(--green)' : sc.total >= 60 ? 'var(--gold)' : 'var(--red)';
  return sc;
}

// ── 衍生数据计算 ──────────────────────────────
function deriveData(raw) {
  const d = { ...raw };
  d.totalAssets = (d.cash || 0) + (d.savingsPlan || 0) + (d.trust || 0) + (d.property || 0) + (d.stocks || 0) + (d.gold || 0) + (d.other || 0);
  d.totalIncome = (d.activeIncome || 0) + (d.passiveIncome || 0);
  d.totalExp = (d.essentialExp || 0) + (d.flexExp || 0) + (d.premiumExp || 0) + (d.debtExp || 0);
  d.monthlySurplus = d.totalIncome - d.totalExp;
  d.annualSurplus = d.monthlySurplus * 12;
  d.debtRatio = d.totalIncome > 0 ? (d.debtExp || 0) / d.totalIncome : 0;
  d.savingsRate = d.totalIncome > 0 ? (d.monthlySurplus + (d.premiumExp || 0)) / d.totalIncome : 0;
  d.emergencyTarget = (d.essentialExp || 0) * (d.emergencyMonths || 6);
  d.emergencyCoverage = d.emergencyTarget > 0 ? (d.cash || 0) / d.emergencyTarget : 2;
  d.yearsToRetire = Math.max(0, (d.retireAge || 60) - (d.age || 45));
  d.passiveRatio = d.totalIncome > 0 ? (d.passiveIncome || 0) / d.totalIncome : 0;
  d.retireGap = Math.max(0, (d.retireNeed || 0) - (d.passiveIncome || 0));
  d.retireCapNeeded = d.retireGap * 12 / 0.04;
  d.eduMonthly = (d.eduYears || 0) > 0 ? (d.eduGoal || 0) / ((d.eduYears || 8) * 12) : 0;
  // 退休资产预估
  const yr = d.yearsToRetire;
  d.retireEst = {
    savingsPlan: (d.savingsPlan || 0) * Math.pow(1.05, yr),
    stocks: (d.stocks || 0) * Math.pow(1.07, yr),
    gold: (d.gold || 0) * Math.pow(1.04, yr),
    newSavings: (d.monthlySurplus * 0.5 + (d.premiumExp || 0)) * 12 * yr,
    trust: d.trust || 0,
  };
  d.retireEst.total = Object.values(d.retireEst).reduce((a, b) => a + b, 0);
  d.retireEst.monthly4pct = d.retireEst.total * 0.04 / 12;
  d.scores = calcScores(d);
  return d;
}

// ── Score Canvas ──────────────────────────────
function drawScoreCanvas(canvasId, score) {
  const cv = el(canvasId);
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 110, 110);
  ctx.beginPath(); ctx.arc(55, 55, 46, -Math.PI / 2, 3 * Math.PI / 2);
  ctx.strokeStyle = '#232a3a'; ctx.lineWidth = 9; ctx.stroke();
  const ang = (score / 100) * 2 * Math.PI - Math.PI / 2;
  const gr = ctx.createLinearGradient(0, 0, 110, 110);
  gr.addColorStop(0, score > 70 ? '#c9a84c' : '#e05555');
  gr.addColorStop(1, score > 70 ? '#f0d080' : '#ff8080');
  ctx.beginPath(); ctx.arc(55, 55, 46, -Math.PI / 2, ang);
  ctx.strokeStyle = gr; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke();
}

// ── 主要建议生成器 ────────────────────────────
function genAdvices(d) {
  const c = d.currency || 'USD';
  const advs = [];
  if (d.emergencyCoverage < 0.5) advs.push({ t: 'urgent', h: '⚠️ 紧急预备金严重不足', b: `当前流动现金 <strong>${fmt(d.cash, c)}</strong>，仅覆盖约 <strong>${(d.emergencyCoverage * (d.emergencyMonths || 6)).toFixed(1)} 个月</strong>生活费。建议立即补充至 <strong>${fmt(d.emergencyTarget, c)}</strong>，存入高流动性账户。这是一切规划的地基。` });
  else if (d.emergencyCoverage < 1) advs.push({ t: 'warn', h: '⚡ 紧急预备金略显不足', b: `建议将流动现金提升至 <strong>${fmt(d.emergencyTarget, c)}</strong>，当前覆盖 <strong>${(d.emergencyCoverage * 100).toFixed(0)}%</strong>，优先从月度结余补仓。` });
  if (d.debtRatio > 0.4) advs.push({ t: 'urgent', h: '⚠️ 债务负担过重', b: `月度债务还款占总收入 <strong>${(d.debtRatio * 100).toFixed(1)}%</strong>，超出警戒线（40%）。建议优先偿还高息债务，降低杠杆风险。` });
  else if (d.debtRatio > 0.25) advs.push({ t: 'warn', h: '⚡ 债务比率偏高', b: `当前债务比率 ${(d.debtRatio * 100).toFixed(1)}%，建议12-24个月内有计划降至25%以内。` });
  if (d.monthlySurplus < 0) advs.push({ t: 'urgent', h: '🔴 月度现金流为负', b: `每月支出超收入 <strong>${fmt(Math.abs(d.monthlySurplus), c)}</strong>，需立即审查弹性支出（${fmt(d.flexExp, c)}/月）。` });
  else if (d.savingsRate < 0.15) advs.push({ t: 'warn', h: '⚡ 储蓄率偏低', b: `综合储蓄率约 <strong>${(d.savingsRate * 100).toFixed(1)}%</strong>，低于建议值20%。建议建立强制储蓄习惯，先储蓄再消费。` });
  if (d.retireGap > 0 && d.yearsToRetire > 0) { const mn = d.retireCapNeeded / (d.yearsToRetire * 12); advs.push({ t: 'warn', h: '📋 退休收入存在缺口', b: `退休后被动收入缺口约 <strong>${fmt(d.retireGap, c)}/月</strong>，需额外积累 <strong>${fmt(d.retireCapNeeded, c)}</strong>。每月至少需额外投入 <strong>${fmt(mn, c)}</strong>。` }); }
  if (d.passiveRatio < 0.2 && d.totalIncome > 0) advs.push({ t: 'warn', h: '💡 被动收入占比偏低', b: `被动收入仅占 <strong>${(d.passiveRatio * 100).toFixed(1)}%</strong>。建议通过储蓄险红利、股息ETF、信托分配逐步提升至40%+。` });
  else if (d.passiveRatio >= 0.5) advs.push({ t: 'good', h: '✅ 被动收入结构良好', b: `被动收入占总收入 <strong>${(d.passiveRatio * 100).toFixed(1)}%</strong>，财务韧性强，接近财务自由状态。` });
  if ((d.legacyWish === 'trust' || d.legacyWish === 'full') && d.trust === 0 && d.totalAssets > 500000) advs.push({ t: 'warn', h: '🏛️ 信托规划时机已成熟', b: `总资产 <strong>${fmt(d.totalAssets, c)}</strong>，尚未设立信托。建议尽早完成架构设计，资产越早进入信托保护效果越好。` });
  if (d.property > d.totalAssets * 0.6) advs.push({ t: 'warn', h: '⚡ 资产过度集中于房产', b: `房产占总资产 <strong>${pct(d.property, d.totalAssets)}</strong>，建议新增储蓄配置流动资产（保险、ETF、黄金）。` });
  if (advs.length === 0) advs.push({ t: 'good', h: '✅ 财务状况整体良好', b: '各项财务指标处于健康区间。维持现有规划节奏，每年做一次资产再平衡。' });
  return advs;
}

function renderAdvices(containerId, advs) {
  el(containerId).innerHTML = advs.map(a => `
    <div class="ab ${a.t}">
      <div class="ah"><span class="dot ${a.t === 'urgent' ? 'r' : a.t === 'warn' ? 'y' : 'g'}"></span>${a.h}</div>
      <div class="abody">${a.b}</div>
    </div>`).join('');
}

// ── 页面激活导航 ─────────────────────────────
function initNav(page) {
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });
}
