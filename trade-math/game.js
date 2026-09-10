/**
 * game.js — StockRL: Lógica principal do jogo
 * ISSUE-05: Geração de dados sintéticos, cálculo de EQM e lucro
 * ISSUE-07: Controle da UI (sliders, navegação, integração com chart)
 * ISSUE-08: Tela de resultado
 * ISSUE-09: Boas-vindas e leaderboard preview
 * ISSUE-10: Leaderboard completo com polling
 * ISSUE-11: Integração com backend Flask
 */

// ─── Configuração ──────────────────────────────────────────────────────────

const CONFIG = {
  BACKEND_URL:     "http://localhost:5000",
  HISTORY_POINTS:  20,    // pontos históricos mostrados ao jogador
  FUTURE_POINTS:   10,    // pontos futuros revelados pelo oráculo
  CAPITAL_BASE:    10000, // capital inicial em R$
  EQM_REF:         2500,  // EQM de referência para calibração do lucro
  MIN_LUCRO:       100,   // lucro mínimo em R$
  CONFIRM_DELAY_S: 5,     // segundos antes de habilitar o botão confirmar
  POLL_INTERVAL_S: 5,     // intervalo de polling do leaderboard em segundos
};

// ─── Estado global ─────────────────────────────────────────────────────────

let state = {
  playerName:     "",
  beta0:          0,
  beta1:          1,
  historicalData: [],  // [{t, y}] — pontos históricos
  futureData:     [],  // [{t, y}] — pontos futuros do oráculo
  eqmHistorico:   0,
  eqmFinal:       0,
  lucroFinal:     0,
  confirmEnabled: false,
  pollTimer:      null,
  confirmTimer:   null,
};

// ─── Utilitários ───────────────────────────────────────────────────────────

/** Gerador pseudo-aleatório simples (seeded) para reprodutibilidade */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Box-Muller transform para ruído gaussiano */
function gaussianNoise(rand, sigma) {
  const u1 = rand();
  const u2 = rand();
  return sigma * Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

// ─── ISSUE-05: Matemática ──────────────────────────────────────────────────

/**
 * Gera dados sintéticos de preço com tendência linear + ruído gaussiano.
 * Modelo oráculo: preço(t) = alpha*t + beta_oracle + epsilon, epsilon ~ N(0, sigma²)
 */
function generateSyntheticData() {
  const seed  = Date.now() & 0xffff;
  const rand  = seededRandom(seed);

  const alpha  = (rand() * 4 - 1);          // tendência [-1, 3] por passo
  const beta_o = 80 + rand() * 40;           // nível base [80, 120]
  const sigma  = 5 + rand() * 10;            // volatilidade [5, 15]

  const total = CONFIG.HISTORY_POINTS + CONFIG.FUTURE_POINTS;
  const all   = [];

  for (let t = 1; t <= total; t++) {
    const y = alpha * t + beta_o + gaussianNoise(rand, sigma);
    all.push({ t, y: parseFloat(y.toFixed(2)) });
  }

  state.historicalData = all.slice(0, CONFIG.HISTORY_POINTS);
  state.futureData     = all.slice(CONFIG.HISTORY_POINTS);

  // Chuta inicial razoável com base nos dados históricos
  const firstY = state.historicalData[0].y;
  const lastY  = state.historicalData[state.historicalData.length - 1].y;
  const approxB1 = (lastY - firstY) / (CONFIG.HISTORY_POINTS - 1);
  const approxB0 = firstY - approxB1 * 1;

  state.beta1 = parseFloat(approxB1.toFixed(1));
  state.beta0 = parseFloat(approxB0.toFixed(0));
}

/**
 * Gera os valores previstos pelo modelo do jogador para um array de t's.
 * ŷ(t) = β₀ + β₁·t
 */
function predictLine(beta0, beta1, tValues) {
  return tValues.map(t => beta0 + beta1 * t);
}

/**
 * Calcula o EQM entre valores reais e previstos.
 * EQM = (1/n) · Σ(yᵢ - ŷᵢ)²
 */
function calcEQM(yReal, yPred) {
  if (yReal.length === 0) return 0;
  const sum = yReal.reduce((acc, y, i) => acc + Math.pow(y - yPred[i], 2), 0);
  return sum / yReal.length;
}

/**
 * Converte EQM em lucro virtual.
 * lucro = max(MIN_LUCRO, CAPITAL_BASE / (1 + EQM / EQM_REF))
 */
function calcLucro(eqm) {
  const raw = CONFIG.CAPITAL_BASE / (1 + eqm / CONFIG.EQM_REF);
  return Math.max(CONFIG.MIN_LUCRO, parseFloat(raw.toFixed(2)));
}

/** Formata número como moeda brasileira */
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ─── Navegação entre telas ─────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  // Sempre volta ao topo ao trocar de tela.
  // Sem isso, no celular o jogador rola até o botão "APOSTAR" no rodapé e,
  // ao confirmar, a tela de resultado abre rolada no fim (botão "JOGAR DE NOVO"),
  // dando a impressão de que os resultados foram pulados.
  window.scrollTo({ top: 0, behavior: 'auto' });

  // Animação de entrada
  if (typeof anime !== 'undefined') {
    anime({
      targets: `#${id}`,
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 350,
      easing: 'easeOutCubic',
    });
  }
}

// ─── ISSUE-07: Gameplay ────────────────────────────────────────────────────

function initGameplay() {
  generateSyntheticData();

  // Sliders
  const s0 = document.getElementById('slider-b0');
  const s1 = document.getElementById('slider-b1');
  s0.value = state.beta0;
  s1.value = state.beta1;
  updateSliderDisplay();

  // Gráfico
  initChart('mainChart');
  redrawGame();

  // Countdown para habilitar o botão confirmar
  state.confirmEnabled = false;
  const btnConfirm  = document.getElementById('btn-confirm');
  const confirmHint = document.getElementById('confirm-hint');
  btnConfirm.disabled = true;
  btnConfirm.classList.remove('btn-pulse');

  let countdown = CONFIG.CONFIRM_DELAY_S;
  confirmHint.textContent = `Ajuste as barras e estude o mercado! (${countdown}s)`;

  if (state.confirmTimer) clearInterval(state.confirmTimer);
  state.confirmTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(state.confirmTimer);
      state.confirmEnabled = true;
      btnConfirm.disabled = false;
      btnConfirm.classList.add('btn-pulse');
      confirmHint.textContent = '🎯 Pronto para apostar?';
    } else {
      confirmHint.textContent = `Ajuste as barras e estude o mercado! (${countdown}s)`;
    }
  }, 1000);
}

function updateSliderDisplay() {
  const b0 = parseFloat(document.getElementById('slider-b0').value);
  const b1 = parseFloat(document.getElementById('slider-b1').value);

  state.beta0 = b0;
  state.beta1 = b1;

  document.getElementById('val-b0').textContent = b0.toFixed(0);
  document.getElementById('val-b1').textContent = b1.toFixed(1);

  const sign  = b1 >= 0 ? '+' : '−';
  const b0str = b0 >= 0 ? b0.toFixed(0) : `(${Math.abs(b0).toFixed(0)})`;
  const b1abs = Math.abs(b1).toFixed(1);
  document.getElementById('equation-display').textContent =
    `Prev = ${b0str} ${sign} ${b1abs} × t`;

  // EQM sobre dados históricos
  const tHist = state.historicalData.map(p => p.t);
  const yHist = state.historicalData.map(p => p.y);
  const yPred = predictLine(b0, b1, tHist);
  state.eqmHistorico = calcEQM(yHist, yPred);
  document.getElementById('eqm-live').textContent = state.eqmHistorico.toFixed(2);

  redrawGame();
}

function onConfirm() {
  if (!state.confirmEnabled) return;
  clearInterval(state.confirmTimer);

  // Calcula EQM final sobre pontos futuros
  const tFut  = state.futureData.map(p => p.t);
  const yFut  = state.futureData.map(p => p.y);
  const yPred = predictLine(state.beta0, state.beta1, tFut);

  state.eqmFinal   = calcEQM(yFut, yPred);
  state.lucroFinal = calcLucro(state.eqmFinal);

  showResultScreen();
}

// ─── ISSUE-08: Resultado ───────────────────────────────────────────────────

async function showResultScreen() {
  showScreen('screen-result');

  // Redesenha gráfico no canvas de resultado
  initChart('resultChart');
  drawHistoricalPoints(state.historicalData);
  drawPlayerLine(state.beta0, state.beta1, state.historicalData, state.futureData);

  // Revela pontos do oráculo animados
  await revealOraclePoints(state.futureData);

  // Anima cards de resultado
  animateResultCards();

  // Envia score ao backend e revela posição no ranking
  await submitScore(state.playerName, state.eqmFinal, state.lucroFinal);

  const board = await fetchLeaderboard();
  const rankEl = document.getElementById('rc-rank-value');
  const subEl  = document.getElementById('rc-rank-sub');
  if (board) {
    const myEntry = board.find(e => e.name.toLowerCase() === state.playerName.toLowerCase());
    if (myEntry) {
      const rank = myEntry.rank;
      rankEl.textContent = `#${rank}`;
      if (rank === 1)        subEl.textContent = '🥇 CAMPEÃO! Ninguém te bateu!';
      else if (rank <= 3)    subEl.textContent = `🏅 Top ${rank} — Que resultado incrível!`;
      else                   subEl.textContent = `de ${board.length} jogadores`;
    } else {
      subEl.textContent = 'Resultado salvo!';
    }
  } else {
    // Backend offline: ranking indisponível, não deixa o card travado em "Buscando…"
    rankEl.textContent = '—';
    subEl.textContent  = 'Ranking indisponível (offline)';
  }
}

function animateResultCards() {
  // Preenche valores
  document.getElementById('rc-eqm-value').textContent   = state.eqmFinal.toFixed(2);
  document.getElementById('rc-lucro-value').textContent = formatBRL(state.lucroFinal);

  // Anima entrada dos cards
  if (typeof anime !== 'undefined') {
    anime({
      targets: '.result-card',
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      delay: anime.stagger(150, { start: 200 }),
      easing: 'easeOutCubic',
    });

    // Contador animado do lucro
    const lucroEl = document.getElementById('rc-lucro-value');
    anime({
      targets: { value: 0 },
      value: state.lucroFinal,
      round: 1,
      duration: 1200,
      delay: 400,
      easing: 'easeOutExpo',
      update: function (anim) {
        lucroEl.textContent = formatBRL(anim.animations[0].currentValue);
      },
    });
  } else {
    document.querySelectorAll('.result-card').forEach(c => {
      c.style.opacity = 1;
      c.style.transform = 'none';
    });
  }
}

// ─── ISSUE-09: Boas-vindas ─────────────────────────────────────────────────

function onStart() {
  const nameInput = document.getElementById('input-name');
  const errorEl   = document.getElementById('name-error');
  const name      = nameInput.value.trim();

  if (name.length < 2) {
    errorEl.textContent = 'Por favor, use pelo menos 2 caracteres.';
    nameInput.focus();
    return;
  }

  errorEl.textContent = '';
  state.playerName    = name;

  document.getElementById('player-display').textContent = name;
  showScreen('screen-game');
  initGameplay();
}

// ─── ISSUE-10: Leaderboard ─────────────────────────────────────────────────

async function fetchLeaderboard() {
  try {
    const res  = await fetch(`${CONFIG.BACKEND_URL}/leaderboard`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data.leaderboard || [];
  } catch {
    return null; // backend offline
  }
}

function renderMiniBoard(board) {
  const container = document.getElementById('mini-board');
  if (!board || board.length === 0) {
    container.innerHTML = '<div class="mini-board-empty">Seja o primeiro a jogar! 🚀</div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = board.slice(0, 3).map((entry, i) => `
    <div class="mini-board-row">
      <div class="mb-medal">${medals[i] || entry.rank}</div>
      <div class="mb-name">${escapeHtml(entry.name)}</div>
      <div class="mb-lucro">${formatBRL(entry.lucro)}</div>
    </div>
  `).join('');
}

function renderFullLeaderboard(board) {
  const podiumEl = document.getElementById('lb-podium');
  const tbody    = document.getElementById('lb-tbody');
  const restEl   = document.getElementById('lb-rest');

  if (!board || board.length === 0) {
    podiumEl.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="4" class="lb-empty">Nenhum resultado ainda. Jogue e seja o primeiro! 🚀</td></tr>`;
    return;
  }

  // Pódio: top 3 em ordem visual (2º | 1º | 3º)
  const podiumSlots = [
    { entry: board[1], cls: 'rank-2', medal: '🥈' },
    { entry: board[0], cls: 'rank-1', medal: '🥇' },
    { entry: board[2], cls: 'rank-3', medal: '🥉' },
  ];

  podiumEl.innerHTML = podiumSlots
    .filter(s => s.entry)
    .map(s => {
      const isCurrent = s.entry.name.toLowerCase() === state.playerName.toLowerCase();
      const youTag = isCurrent ? ' <span class="you-tag">você</span>' : '';
      return `
        <div class="podium-card ${s.cls}${isCurrent ? ' is-you' : ''}">
          <div class="podium-medal">${s.medal}</div>
          <div class="podium-name">${escapeHtml(s.entry.name)}${youTag}</div>
          <div class="podium-lucro">${formatBRL(s.entry.lucro)}</div>
          <div class="podium-eqm">Erro: ${s.entry.eqm.toFixed(2)}</div>
        </div>
      `;
    }).join('');

  // Tabela: 4º em diante
  const rest = board.slice(3);
  if (rest.length === 0) {
    restEl.style.display = 'none';
  } else {
    restEl.style.display = 'block';
    tbody.innerHTML = rest.map(entry => {
      const isCurrent = entry.name.toLowerCase() === state.playerName.toLowerCase();
      return `
        <tr class="${isCurrent ? 'current-player' : ''}">
          <td class="lb-rank-cell">
            <div class="lb-rank-badge">${entry.rank}</div>
          </td>
          <td class="lb-name">${escapeHtml(entry.name)}</td>
          <td class="lb-eqm">${entry.eqm.toFixed(2)}</td>
          <td class="lb-lucro">${formatBRL(entry.lucro)}</td>
        </tr>
      `;
    }).join('');
  }

  if (typeof anime !== 'undefined') {
    anime({
      targets: '#lb-podium .podium-card',
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 500,
      delay: anime.stagger(100),
      easing: 'easeOutCubic',
    });
    if (rest.length > 0) {
      anime({
        targets: '#lb-tbody tr',
        opacity: [0, 1],
        translateX: [-16, 0],
        duration: 300,
        delay: anime.stagger(50, { start: 500 }),
        easing: 'easeOutCubic',
      });
    }
  }
}

async function showLeaderboardScreen() {
  showScreen('screen-leaderboard');

  const board = await fetchLeaderboard();
  renderFullLeaderboard(board);

  // Polling
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    const updated = await fetchLeaderboard();
    if (updated) renderFullLeaderboard(updated);
  }, CONFIG.POLL_INTERVAL_S * 1000);
}

// ─── ISSUE-11: Integração backend ─────────────────────────────────────────

async function submitScore(name, eqm, lucro) {
  try {
    await fetch(`${CONFIG.BACKEND_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, eqm, lucro }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Backend offline — continua sem salvar (graceful degradation)
    console.warn('[StockRL] Backend offline — score não salvo.');
  }
}

// ─── Reiniciar ─────────────────────────────────────────────────────────────

function restartGame() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  showScreen('screen-game');
  initGameplay();
}

// ─── Utilitário XSS ───────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ──────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  showScreen('screen-welcome');

  // Permite pressionar Enter no input de nome
  document.getElementById('input-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') onStart();
  });

  // Sliders
  document.getElementById('slider-b0').addEventListener('input', updateSliderDisplay);
  document.getElementById('slider-b1').addEventListener('input', updateSliderDisplay);

  // Carrega mini board da tela de boas-vindas
  const board = await fetchLeaderboard();
  renderMiniBoard(board);
});
