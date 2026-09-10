/**
 * chart.js — StockRL: Renderização do gráfico com Canvas API
 * ISSUE-06: Gráfico interativo
 * ISSUE-08: Animação de revelação dos pontos do oráculo
 */

let canvas = null;
let ctx    = null;
let chartMeta = {};

// ─── Paleta ─────────────────────────────────────────────────────────────────

const COLORS = {
  bg:         '#060610',
  grid:       'rgba(30,30,58,0.8)',
  axis:       '#334155',
  axisLabel:  '#94a3b8',
  historical: '#10b981',
  playerLine: 'rgba(245,158,11,0.9)',
  playerFill: 'rgba(245,158,11,0.05)',
  oracle:     '#a78bfa',
  oracleGlow: 'rgba(167,139,250,0.4)',
};

// ─── Setup ──────────────────────────────────────────────────────────────────

function initChart(canvasId) {
  canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // DPR para telas retina
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  computeChartMeta();
}

function computeChartMeta() {
  if (!canvas) return;
  const dpr    = window.devicePixelRatio || 1;
  const W      = canvas.width  / dpr;
  const H      = canvas.height / dpr;

  const PAD = { top: 24, right: 24, bottom: 40, left: 52 };

  const allData = [...(state.historicalData || []), ...(state.futureData || [])];
  const ys = allData.map(p => p.y);
  const ts = allData.map(p => p.t);

  const yMin = Math.min(...ys) - 10;
  const yMax = Math.max(...ys) + 10;
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  chartMeta = { W, H, PAD, yMin, yMax, tMin, tMax, plotW, plotH };
}

// ─── Coordenadas ────────────────────────────────────────────────────────────

function toX(t) {
  const { PAD, plotW, tMin, tMax } = chartMeta;
  return PAD.left + ((t - tMin) / (tMax - tMin)) * plotW;
}

function toY(y) {
  const { PAD, plotH, yMin, yMax } = chartMeta;
  return PAD.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
}

// ─── Fundo e Grade ───────────────────────────────────────────────────────────

function drawBackground() {
  const { W, H, PAD, plotW, plotH } = chartMeta;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Grade horizontal
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth   = 0.5;
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = PAD.top + (plotH / ySteps) * i;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();

    // Label eixo Y
    const yVal = chartMeta.yMax - ((chartMeta.yMax - chartMeta.yMin) / ySteps) * i;
    ctx.fillStyle   = COLORS.axisLabel;
    ctx.font        = '10px Outfit, system-ui';
    ctx.textAlign   = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(yVal.toFixed(0), PAD.left - 6, y);
  }

  // Eixos
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  // Label eixo X (tempo)
  const tSteps = Math.min(10, state.historicalData.length);
  for (let i = 0; i <= tSteps; i++) {
    const t = chartMeta.tMin + Math.round(((chartMeta.tMax - chartMeta.tMin) / tSteps) * i);
    const x = toX(t);
    ctx.fillStyle    = COLORS.axisLabel;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`t${t}`, x, PAD.top + plotH + 6);
  }

  // Label "Futuro"
  if (state.futureData && state.futureData.length > 0) {
    const xSplit = toX(state.historicalData[state.historicalData.length - 1].t + 0.5);
    ctx.strokeStyle = 'rgba(124,58,237,0.3)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xSplit, PAD.top);
    ctx.lineTo(xSplit, PAD.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle    = 'rgba(167,139,250,0.5)';
    ctx.font         = '9px Inter, system-ui';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('◀ histórico | futuro ▶', xSplit + 4, PAD.top + 4);
  }
}

// ─── Pontos históricos ───────────────────────────────────────────────────────

function drawHistoricalPoints(data) {
  if (!data || data.length === 0) return;

  ctx.fillStyle   = COLORS.historical;
  ctx.strokeStyle = 'rgba(0,245,255,0.3)';
  ctx.lineWidth   = 1.5;

  // Linha conectando pontos históricos
  ctx.beginPath();
  data.forEach((p, i) => {
    const x = toX(p.t);
    const y = toY(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Círculos
  data.forEach(p => {
    const x = toX(p.t);
    const y = toY(p.y);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Linha de regressão do jogador ───────────────────────────────────────────

function drawPlayerLine(beta0, beta1, historical, future) {
  const allData = [...(historical || []), ...(future || [])];
  if (allData.length === 0) return;

  const tValues = allData.map(p => p.t);
  const tMin    = Math.min(...tValues);
  const tMax    = Math.max(...tValues);

  const pts = [tMin, tMax].map(t => ({
    x: toX(t),
    y: toY(beta0 + beta1 * t),
  }));

  // Área sob a linha (fill sutil)
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[1].x, toY(chartMeta.yMin));
  ctx.lineTo(pts[0].x, toY(chartMeta.yMin));
  ctx.closePath();
  ctx.fillStyle = COLORS.playerFill;
  ctx.fill();

  // Linha principal
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.strokeStyle = COLORS.playerLine;
  ctx.lineWidth   = 2;
  ctx.shadowColor = COLORS.historical;
  ctx.shadowBlur  = 8;
  ctx.stroke();
  ctx.shadowBlur  = 0;
}

// ─── Redraw completo (gameplay) ───────────────────────────────────────────────

function redrawGame() {
  if (!canvas || !ctx) return;
  computeChartMeta();
  drawBackground();
  drawHistoricalPoints(state.historicalData);
  drawPlayerLine(state.beta0, state.beta1, state.historicalData, []);
}

// ─── Revelação animada dos pontos do oráculo ─────────────────────────────────

async function revealOraclePoints(futureData) {
  return new Promise(resolve => {
    let idx = 0;
    const revealed = [];

    const interval = setInterval(() => {
      if (idx >= futureData.length) {
        clearInterval(interval);
        resolve();
        return;
      }

      revealed.push(futureData[idx]);
      idx++;

      // Redesenha
      computeChartMeta();
      drawBackground();
      drawHistoricalPoints(state.historicalData);
      drawPlayerLine(state.beta0, state.beta1, state.historicalData, state.futureData);
      drawRevealedOracle(revealed);
    }, 220);
  });
}

function drawRevealedOracle(revealed) {
  if (!revealed || revealed.length === 0) return;

  ctx.fillStyle = COLORS.oracle;

  revealed.forEach((p) => {
    const x = toX(p.t);
    const y = toY(p.y);

    // Glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
    gradient.addColorStop(0, COLORS.oracleGlow);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();

    // Ponto principal
    ctx.fillStyle = COLORS.oracle;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Linha de erro (jogador vs oráculo)
    const predY = state.beta0 + state.beta1 * p.t;
    const yPred = toY(predY);

    ctx.strokeStyle = 'rgba(255,68,102,0.4)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, yPred);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}
