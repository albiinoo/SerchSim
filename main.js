// ===================== STATE =====================
let currentAlgo = 'bfs';
let currentView = '2d';
let currentTool = 'wall';
let gridZoom = 1;
let gridRows = 15, gridCols = 20;
let grid = [];
let startPos = null, goalPos = null;
let isRunning = false, isPaused = false;
let isTurboMode = false;     // ← Turbo Mode: Web Worker tanpa delay
let simulationTimer = null;
let stepCount = 0, visitedCount = 0;
let speedMs = 80;
let currentHeuristic = 'manhattan';
let currentWeight = 1.0;
let isMouseDown = false;
let consoleVisible = true;
let logHistory = [];

// 3D state
let scene3d, camera3d, renderer3d, cells3d = [], animFrame3d;
let camAngle = Math.PI / 4;
let camPitch = Math.PI / 6;
let camZoom = 1;
let camPanX = 0, camPanY = 0;
let isDragging3D = false;
let lastMouseX = 0, lastMouseY = 0;


// Graph state
let graphNodes = [], graphEdges = [], graphCanvas, graphCtx;

const ALGO_INFO = {
  garislintang: { title: 'Garis Lintang', desc: 'Custom algorithm by Panji. Memprioritaskan jalur yang mendekati garis lurus antara start dan goal. f(n) = D_goal + k * T', type: 'informed' },
  bfs: { title: 'Breadth First Search (BFS)', desc: 'Menelusuri node per level dari kiri ke kanan menggunakan struktur data Queue (FIFO). Menjamin jalur terpendek pada graf tanpa bobot.', type: 'uninformed' },
  dfs: { title: 'Depth First Search (DFS)', desc: 'Menelusuri sedalam mungkin di setiap cabang sebelum mundur. Menggunakan struktur data Stack (LIFO). Efisien dalam memori.', type: 'uninformed' },
  dls: { title: 'Depth Limited Search (DLS)', desc: 'DFS dengan batas kedalaman L. Mencegah eksplorasi tak terbatas pada graf siklik.', type: 'uninformed' },
  ids: { title: 'Iterative Deepening Search (IDS)', desc: 'Menggabungkan kelebihan BFS (optimal) dan DFS (hemat memori) dengan meningkatkan batas kedalaman secara bertahap.', type: 'uninformed' },
  ucs: { title: 'Uniform Cost Search (UCS)', desc: 'Ekspansi node berdasarkan biaya jalur g(n). Setara Dijkstra. Menjamin jalur optimal pada graf berbobot.', type: 'uninformed' },
  bidirectional: { title: 'Bidirectional BFS', desc: 'BFS dari dua arah (start dan goal) secara bersamaan. Mengurangi kompleksitas dari O(b^d) ke O(b^(d/2)).', type: 'uninformed' },
  greedy: { title: 'Greedy Best First Search', desc: 'Selalu mengekspansi node dengan heuristik h(n) terkecil. Cepat tapi tidak menjamin jalur optimal.', type: 'informed' },
  astar: { title: 'A* Search', desc: 'Menggabungkan g(n) + h(n). Optimal dan complete jika h(n) admissible. Algoritma paling populer untuk pathfinding.', type: 'informed' },
  idastar: { title: 'IDA* Search', desc: 'Iterative Deepening A*. Hemat memori dengan threshold f(n). Setiap iterasi meningkatkan batas f.', type: 'informed' },
  weighted_astar: { title: 'Weighted A* (wA*)', desc: 'A* dengan f = g + w·h (w > 1). Lebih cepat dari A* standar, mengorbankan optimalitas untuk kecepatan.', type: 'informed' },
  beam: { title: 'Beam Search', desc: 'Heuristik dengan beam width B. Hanya menyimpan B node terbaik di setiap level. Trade-off antara memori dan kualitas.', type: 'informed' },
  hillclimbing: { title: 'Hill Climbing', desc: 'Local search yang selalu bergerak ke tetangga dengan nilai lebih baik. Dapat terjebak di local optimum.', type: 'local' },
  steepest: { title: 'Steepest Ascent Hill Climbing', desc: 'Evaluasi semua tetangga, pilih yang terbaik. Lebih baik dari HC sederhana namun masih bisa terjebak.', type: 'local' },
  simulated_annealing: { title: 'Simulated Annealing (SA)', desc: 'Menerima solusi buruk dengan probabilitas e^(-ΔE/T). Suhu T menurun seiring waktu. Menghindari local optimum.', type: 'local' },
  tabu: { title: 'Tabu Search', desc: 'Hill climbing dengan daftar tabu yang mencegah kunjungan berulang. Memori jangka pendek untuk menghindari siklus.', type: 'local' },
  genetic: { title: 'Genetic Algorithm (GA)', desc: 'Algoritma evolusioner dengan populasi, seleksi, crossover, dan mutasi. Mencari solusi optimal secara global.', type: 'local' },
  minimax: { title: 'Minimax Search', desc: 'Pohon permainan dua pemain (MAX dan MIN). Mengasumsikan lawan bermain optimal. Dasar AI permainan.', type: 'adversarial' },
  alphabeta: { title: 'Alpha-Beta Pruning', desc: 'Optimasi Minimax dengan memangkas cabang yang tidak memengaruhi keputusan. Mengurangi kompleksitas dari O(b^m) ke O(b^(m/2)).', type: 'adversarial' },
  mcts: { title: 'Monte Carlo Tree Search (MCTS)', desc: 'Selection → Expansion → Simulation → Backpropagation. Menggunakan UCB1 untuk keseimbangan eksplorasi dan eksploitasi.', type: 'adversarial' },
  backtracking: { title: 'Backtracking Search', desc: 'Pencarian sistematis dengan mundur saat menemui jalan buntu. Dasar untuk CSP (Constraint Satisfaction Problem).', type: 'constraint' },
  ants: { title: 'Ant Colony Optimization (ACO)', desc: 'Inspired oleh perilaku semut. Feromon menuntun pencarian. Solusi membaik secara kolektif dari waktu ke waktu.', type: 'constraint' },
  jps: { title: 'Jump Point Search (JPS)', desc: 'Optimasi A* untuk grid seragam. Lompati node redundan. Jauh lebih cepat dari A* biasa pada grid besar.', type: 'informed' }
};

// ===================== GRID INIT =====================
function initGrid(rows, cols) {
  gridRows = rows; gridCols = cols;
  grid = Array.from({ length: rows }, () => Array(cols).fill('unvisited'));
  startPos = { r: Math.floor(rows / 2), c: 2 };
  goalPos = { r: Math.floor(rows / 2), c: cols - 3 };
  grid[startPos.r][startPos.c] = 'start';
  grid[goalPos.r][goalPos.c] = 'goal';
  renderGrid();
  if (currentView === '3d') init3D();
  consoleLog('info', `Grid diinisialisasi: ${rows}×${cols} | Start:(${startPos.r},${startPos.c}) Goal:(${goalPos.r},${goalPos.c})`);
}

function renderGrid() {
  const container = document.getElementById('gridContainer');
  container.style.gridTemplateColumns = `repeat(${gridCols}, 28px)`;
  container.innerHTML = '';
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cell = document.createElement('div');
      cell.className = `cell ${grid[r][c]}`;
      cell.dataset.r = r; cell.dataset.c = c;
      if (grid[r][c] === 'start') cell.innerHTML = `<span style="font-size:10px">S</span>`;
      else if (grid[r][c] === 'goal') cell.innerHTML = `<span style="font-size:10px">G</span>`;
      cell.addEventListener('mousedown', (e) => { isMouseDown = true; paintCell(r, c); });
      cell.addEventListener('mouseenter', () => { if (isMouseDown) paintCell(r, c); });
      cell.addEventListener('mouseup', () => { isMouseDown = false; });
      container.appendChild(cell);
    }
  }
  if (currentView === 'graph') initGraphView();
}

document.addEventListener('mouseup', () => { isMouseDown = false; });

function paintCell(r, c) {
  if (isRunning && !isPaused) return;
  const current = grid[r][c];
  if (currentTool === 'wall') {
    if (current === 'start' || current === 'goal') return;
    grid[r][c] = current === 'wall' ? 'unvisited' : 'wall';
  } else if (currentTool === 'start') {
    if (current === 'goal') return;
    if (startPos) {
      const oldStart = startPos;
      grid[oldStart.r][oldStart.c] = 'unvisited';
      updateCellUI(oldStart.r, oldStart.c);
    }
    startPos = { r, c };
    grid[r][c] = 'start';
  } else if (currentTool === 'goal') {
    if (current === 'start') return;
    if (goalPos) {
      const oldGoal = goalPos;
      grid[oldGoal.r][oldGoal.c] = 'unvisited';
      updateCellUI(oldGoal.r, oldGoal.c);
    }
    goalPos = { r, c };
    grid[r][c] = 'goal';
  }
  updateCellUI(r, c);
  if (currentView === 'graph') initGraphView();

  // Notifikasi worker agar grid-nya sinkron
  if (algoWorker) algoWorker.postMessage({ type: 'gridUpdate', cells: [{ r, c, state: grid[r][c] }], startPos, goalPos });
}

function updateCellUI(r, c) {
  const container = document.getElementById('gridContainer');
  const idx = r * gridCols + c;
  const cell = container.children[idx];
  if (!cell) return;
  cell.className = `cell ${grid[r][c]}`;
  cell.innerHTML = '';
  if (grid[r][c] === 'start') cell.innerHTML = `<span style="font-size:10px">S</span>`;
  else if (grid[r][c] === 'goal') cell.innerHTML = `<span style="font-size:10px">G</span>`;
  // Update 3D if active
  if (currentView === '3d') update3DCell(r, c);
}

function setTool(tool, btn) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setGridSize(r, c, btn) {
  if (isRunning) return;
  document.querySelectorAll('.grid-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  stopSimulation();
  initGrid(r, c);
  consoleLog('system', `Grid diubah ke ${r}×${c}`);
}

function clearGrid() {
  stopSimulation();
  grid = Array.from({ length: gridRows }, () => Array(gridCols).fill('unvisited'));
  if (startPos) grid[startPos.r][startPos.c] = 'start';
  if (goalPos) grid[goalPos.r][goalPos.c] = 'goal';
  renderGrid();
  resetStats();
  consoleLog('system', 'Grid dibersihkan');
}

function generateMaze() {
  stopSimulation();
  clearGrid();
  // Recursive division maze
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') {
        grid[r][c] = Math.random() < 0.3 ? 'wall' : 'unvisited';
      }
    }
  }
  // ensure start/goal area clear
  const clearAround = (pos) => {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = pos.r + dr, nc = pos.c + dc;
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols)
          if (grid[nr][nc] === 'wall') grid[nr][nc] = 'unvisited';
      }
  };
  clearAround(startPos); clearAround(goalPos);
  renderGrid();
  consoleLog('system', 'Maze acak dibuat (density 30%)');
}

// ===================== VIEW TOGGLE =====================
function setView(view, btn) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('grid2d').style.display = 'none';
  document.getElementById('grid3d').style.display = 'none';
  document.getElementById('graphView').style.display = 'none';
  if (view === '2d') {
    document.getElementById('grid2d').style.display = 'flex';
    cancelAnimationFrame(animFrame3d);
  } else if (view === '3d') {
    document.getElementById('grid3d').style.display = 'block';
    init3D();
  } else if (view === 'graph') {
    document.getElementById('graphView').style.display = 'block';
    initGraphView();
  }
  consoleLog('system', `Tampilan: ${view.toUpperCase()}`);
}

// ===================== 3D VIEW =====================
function init3D() {
  const canvas = document.getElementById('threeCanvas');
  const wrap = document.getElementById('grid3d');
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext('2d');

  // Events
  canvas.onmousedown = (e) => {
    isDragging3D = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.classList.add('dragging');
  };
  window.onmousemove = (e) => {
    if (!isDragging3D || currentView !== '3d') return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    if (e.buttons === 1) {
      camAngle -= dx * 0.01;
      camPitch -= dy * 0.01;
      camPitch = Math.max(0, Math.min(Math.PI / 2 - 0.1, camPitch));
    } else if (e.buttons === 2) {
      camPanX += dx;
      camPanY += dy;
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  };
  window.onmouseup = () => {
    isDragging3D = false;
    canvas.classList.remove('dragging');
  };
  canvas.oncontextmenu = e => e.preventDefault();
  canvas.onwheel = (e) => {
    if (currentView !== '3d') return;
    e.preventDefault();
    camZoom *= (1 - e.deltaY * 0.001);
    camZoom = Math.max(0.2, Math.min(5, camZoom));
  };

  cancelAnimationFrame(animFrame3d);
  render3D(ctx, canvas.width, canvas.height);
}

function render3D(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);

  const project = (c, r, h) => {
    const ox = (c - gridCols / 2) * 20;
    const oy = (r - gridRows / 2) * 20;
    const oz = h * 20;

    const rx = ox * Math.cos(camAngle) - oy * Math.sin(camAngle);
    const ry = ox * Math.sin(camAngle) + oy * Math.cos(camAngle);

    const fz = oz * Math.cos(camPitch) - ry * Math.sin(camPitch);
    const fy = ry * Math.cos(camPitch) + oz * Math.sin(camPitch);

    return {
      x: W / 2 + camPanX + rx * camZoom,
      y: H / 2 + camPanY - fy * camZoom,
      depth: fz + ry
    };
  };

  let renderList = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const state = grid[r][c];
      const isWall = state === 'wall';
      const hLevel = isWall ? 1 : (state === 'current' ? 0.6 : state === 'visited' ? 0.3 : state === 'queued' ? 0.4 : state === 'path' ? 0.7 : state === 'start' || state === 'goal' ? 0.8 : 0.1);

      const p = project(c, r, 0);
      renderList.push({ r, c, state, hLevel, depth: p.depth });
    }
  }

  renderList.sort((a, b) => b.depth - a.depth);

  renderList.forEach(cell => {
    const { r, c, state, hLevel } = cell;
    const col = get3DColor(state);
    const isLight = document.body.classList.contains('theme-light');
    const strokeCol = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';

    const v = [];
    for (let dz of [0, hLevel]) {
      for (let dy of [-0.45, 0.45]) {
        for (let dx of [-0.45, 0.45]) {
          v.push(project(c + dx, r + dy, dz));
        }
      }
    }

    if (hLevel > 0.1) {
      const faces = [
        { p: [v[4], v[5], v[1], v[0]], shade: isLight ? -20 : -35 }, // Back
        { p: [v[5], v[7], v[3], v[1]], shade: isLight ? -10 : -25 }, // Right
        { p: [v[7], v[6], v[2], v[3]], shade: isLight ? -5  : -15 }, // Front
        { p: [v[6], v[4], v[0], v[2]], shade: isLight ? -15 : -30 }, // Left
        { p: [v[4], v[5], v[7], v[6]], shade: 0 }                    // Top
      ];

      // Sort faces by average depth (Painter's Algorithm for the single block)
      faces.forEach(f => {
        f.depth = (f.p[0].depth + f.p[1].depth + f.p[2].depth + f.p[3].depth) / 4;
      });
      faces.sort((a, b) => b.depth - a.depth);

      // Draw faces back-to-front
      faces.forEach(f => {
        ctx.beginPath();
        ctx.moveTo(f.p[0].x, f.p[0].y);
        ctx.lineTo(f.p[1].x, f.p[1].y);
        ctx.lineTo(f.p[2].x, f.p[2].y);
        ctx.lineTo(f.p[3].x, f.p[3].y);
        ctx.closePath();
        ctx.fillStyle = f.shade === 0 ? col : shadeColor(col, f.shade);
        ctx.fill();
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
    } else {
      // For flat cells, just draw the top face
      ctx.beginPath();
      ctx.moveTo(v[4].x, v[4].y); ctx.lineTo(v[5].x, v[5].y);
      ctx.lineTo(v[7].x, v[7].y); ctx.lineTo(v[6].x, v[6].y);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = strokeCol; ctx.lineWidth = 0.8; ctx.stroke();
    }

    if (state === 'start' || state === 'goal') {
      const topCenter = project(c, r, hLevel + 0.2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(state === 'start' ? 'S' : 'G', topCenter.x, topCenter.y);
    }
  });

  if (currentView === '3d') animFrame3d = requestAnimationFrame(() => render3D(ctx, W, H));
}


function get3DColor(state) {
  const isLight = document.body.classList.contains('theme-light');
  const isWarm = document.body.classList.contains('theme-warm');

  if (isLight) {
    const colors = {
      unvisited: '#dde6f0', wall: '#4338ca', start: '#16a34a',
      goal: '#7c3aed', visited: '#6ee7b7', current: '#0284c7',
      queued: '#fde68a', path: '#ea580c'
    };
    return colors[state] || '#dde6f0';
  } else if (isWarm) {
    const colors = {
      unvisited: '#22160a', wall: '#7c2d12', start: '#4ade80',
      goal: '#fb923c', visited: '#10b981', current: '#fde68a',
      queued: '#fbbf24', path: '#86efac'
    };
    return colors[state] || '#22160a';
  } else {
    // Dark (default)
    const colors = {
      unvisited: '#0b1220', wall: '#3730a3', start: '#22d47c',
      goal: '#c084fc', visited: '#065f46', current: '#38bdf8',
      queued: '#92400e', path: '#fb923c'
    };
    return colors[state] || '#0b1220';
  }
}

function shadeColor(color, percent) {
  const num = parseInt(color.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
}

function update3DCell(r, c) { /* 3D re-renders via RAF */ }

// ===================== GRAPH VIEW =====================
function initGraphView() {
  graphCanvas = document.getElementById('graphCanvas');
  const wrap = document.getElementById('graphView');
  graphCanvas.width = wrap.clientWidth;
  graphCanvas.height = wrap.clientHeight;
  graphCtx = graphCanvas.getContext('2d');

  // Build a sample graph from the grid (sparse)
  graphNodes = [];
  graphEdges = [];
  const step = 3;
  for (let r = 0; r < gridRows; r += step) {
    for (let c = 0; c < gridCols; c += step) {
      if (grid[r][c] !== 'wall') {
        const x = 60 + c * (graphCanvas.width - 120) / gridCols;
        const y = 60 + r * (graphCanvas.height - 120) / gridRows;
        let state = grid[r][c];
        graphNodes.push({ r, c, x, y, state, label: `${String.fromCharCode(65 + graphNodes.length % 26)}` });
      }
    }
  }
  // Add edges between nearby nodes
  for (let i = 0; i < graphNodes.length; i++) {
    for (let j = i + 1; j < graphNodes.length; j++) {
      const dr = Math.abs(graphNodes[i].r - graphNodes[j].r);
      const dc = Math.abs(graphNodes[i].c - graphNodes[j].c);
      if (dr <= step + 1 && dc <= step + 1 && dr + dc <= step * 2) {
        const w = Math.round(Math.sqrt(dr * dr + dc * dc) * 10) / 10;
        graphEdges.push({ from: i, to: j, w });
      }
    }
  }
  drawGraph();
}

function drawGraph() {
  if (!graphCtx) return;
  const W = graphCanvas.width, H = graphCanvas.height;
  const style = getComputedStyle(document.body);
  const isLight = document.body.classList.contains('theme-light');
  graphCtx.clearRect(0, 0, W, H);

  // Background
  graphCtx.fillStyle = style.getPropertyValue('--bg').trim();
  graphCtx.fillRect(0, 0, W, H);

  // Draw edges
  graphEdges.forEach(e => {
    const a = graphNodes[e.from], b = graphNodes[e.to];
    graphCtx.beginPath();
    graphCtx.moveTo(a.x, a.y);
    graphCtx.lineTo(b.x, b.y);
    graphCtx.strokeStyle = style.getPropertyValue('--border').trim();
    graphCtx.lineWidth = 1.5;
    graphCtx.stroke();
    // Weight label
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    graphCtx.fillStyle = style.getPropertyValue('--text3').trim();
    graphCtx.font = '9px JetBrains Mono';
    graphCtx.textAlign = 'center';
    graphCtx.fillText(e.w, mx, my - 3);
  });

  // Draw nodes
  graphNodes.forEach(n => {
    graphCtx.beginPath();
    graphCtx.arc(n.x, n.y, 14, 0, Math.PI * 2);
    graphCtx.fillStyle = get3DColor(n.state);
    graphCtx.fill();
    // Glow for special nodes
    if (n.state === 'current' || n.state === 'start' || n.state === 'goal') {
      graphCtx.shadowBlur = 12;
      graphCtx.shadowColor = get3DColor(n.state);
      graphCtx.fill();
      graphCtx.shadowBlur = 0;
    }
    graphCtx.strokeStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
    graphCtx.lineWidth = 1;
    graphCtx.stroke();
    // Label
    graphCtx.fillStyle = isLight ? '#000' : '#fff';
    graphCtx.font = 'bold 10px JetBrains Mono';
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'middle';
    graphCtx.fillText(n.label, n.x, n.y);
  });
}

// ===================== ALGO SELECT =====================
function selectAlgo(el, algo) {
  // In compare mode: just update sidebar highlight, don't change simulation algo
  if (compareMode) {
    document.querySelectorAll('.algo-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    const info = ALGO_INFO[algo];
    document.getElementById('algoTitle').textContent = info.title;
    document.getElementById('algoDesc').textContent  = info.desc;
    return;
  }
  if (isRunning) return;
  currentAlgo = algo;
  document.querySelectorAll('.algo-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  const info = ALGO_INFO[algo];
  document.getElementById('algoTitle').textContent = info.title;
  document.getElementById('algoDesc').textContent = info.desc;

  // Show/hide algo-specific controls
  document.getElementById('weightSel').style.display = (algo === 'weighted_astar') ? 'block' : 'none';
  document.getElementById('beamWidthSel').style.display = (algo === 'beam') ? 'block' : 'none';
  document.getElementById('depthLimitSel').style.display = (algo === 'dls') ? 'block' : 'none';

  resetStats();
  consoleLog('system', `Algoritma dipilih: ${info.title}`);
  consoleLog('info', `Tipe: ${info.type} | ${info.desc.substring(0, 80)}...`);
}

// ===================== WEB WORKER =====================
let algoWorker = null;

function getOrCreateWorker() {
  if (algoWorker) return algoWorker;
  algoWorker = new Worker('algo-worker.js');
  algoWorker.onmessage = handleWorkerMessage;
  algoWorker.onerror = (e) => {
    consoleLog('error', `Worker error: ${e.message}`);
    isRunning = false; isPaused = false;
    updateUIControls();
  };
  return algoWorker;
}

// Kill current worker and spawn a fresh one.
// Called before every new simulation run so there is zero stale state.
function _respawnWorker() {
  if (algoWorker) {
    algoWorker.onmessage = null;
    algoWorker.onerror   = null;
    algoWorker.terminate();
    algoWorker = null;
  }
  return getOrCreateWorker();
}

function handleWorkerMessage(e) {
  const { cells, stepCount: sc, visitedCount: vc,
          logs, info, queue, path, done } = e.data;

  // Batch DOM update — defer to rAF agar tidak blocking
  requestAnimationFrame(() => {
    // 1. Update sel yang berubah
    if (cells && cells.length) {
      cells.forEach(({ r, c, state }) => {
        if (grid[r][c] === 'start' || grid[r][c] === 'goal') return;
        grid[r][c] = state;
        updateCellUI(r, c);
      });
      if (currentView === 'graph') {
        graphNodes.forEach(n => { n.state = grid[n.r][n.c]; });
        drawGraph();
      }
    }

    // 2. Stats
    if (sc !== undefined) {
      stepCount = sc;
      document.getElementById('statSteps').textContent = sc;
      document.getElementById('infoStep').textContent  = sc;
    }
    if (vc !== undefined) {
      visitedCount = vc;
      document.getElementById('statVisited').textContent = vc;
    }

    // 3. Info panel (current node, g/h/f)
    if (info) {
      document.getElementById('infoCurrent').textContent = `(${info.r},${info.c})`;
      document.getElementById('infoHn').textContent = info.h;
      document.getElementById('infoGn').textContent = info.g;
      document.getElementById('infoFn').textContent = Math.round((info.g + info.h) * 10) / 10;
    }

    // 4. Queue display
    if (queue !== undefined && queue !== null) {
      const qd = document.getElementById('queueDisplay');
      document.getElementById('statQueue').textContent = queue.length;
      qd.innerHTML = queue.slice(0, 12).map(k =>
        `<div class="queue-node">${k}</div>`
      ).join('') + (queue.length > 12 ? `<div style="font-size:9px;color:var(--text3);padding:4px">+${queue.length - 12}</div>` : '');
    }

    // 5. Logs (batched untuk performa)
    if (logs && logs.length) {
      logs.forEach(({ type, msg }) => consoleLog(type, msg));
    }

    // 6. Path display ketika selesai
    if (path) {
      document.getElementById('statPath').textContent = path.length;
      const pathDisplay = document.getElementById('pathDisplay');
      pathDisplay.innerHTML = path.map((k, i) =>
        `<span class="path-node">${k}</span>${i < path.length - 1 ? '<span class="path-arrow">→</span>' : ''}`
      ).join('');
    }

    // 7. Selesai / gagal
    if (done) {
      isRunning = false; isPaused = false;
      if (isTurboMode) _setTurboUI(false); // restore turbo button
      if (done.found) {
        document.getElementById('infoStatus').textContent = 'Selesai ✓';
        document.getElementById('infoStatus').style.color = 'var(--accent4)';
        document.getElementById('infoStatus').style.background = 'rgba(52,211,153,0.12)';
        document.getElementById('infoStatus').style.borderColor = 'rgba(52,211,153,0.4)';
        consoleLog('success', `✓ Simulasi selesai — path ditemukan (${done.pathLen} node, ${done.steps} langkah, ${done.visited} dikunjungi)`);
      } else {
        document.getElementById('infoStatus').textContent = 'Gagal ✗';
        document.getElementById('infoStatus').style.color = 'var(--accent5)';
        document.getElementById('infoStatus').style.background = 'rgba(248,113,113,0.12)';
        document.getElementById('infoStatus').style.borderColor = 'rgba(248,113,113,0.4)';
        document.getElementById('statPath').textContent = '∞';
        consoleLog('warn', `⚠ Simulasi selesai — tidak ada jalur (${done.steps} langkah, ${done.visited} dikunjungi)`);
      }
      updateUIControls();
    }
  });
}

function sendGridToWorker() {
  const weightVal    = parseFloat(document.getElementById('weightSel')?.value ?? '1') || 1.0;
  const beamVal      = parseInt(document.getElementById('beamWidthSel')?.value ?? '3') || 3;
  const depthVal     = parseInt(document.getElementById('depthLimitSel')?.value ?? '10') || 10;
  if (currentAlgo === 'weighted_astar') {
    consoleLog('info', `Weighted A* — bobot w=${weightVal}`);
  }
  getOrCreateWorker().postMessage({
    type:       'init',
    grid:       grid.map(row => [...row]),
    rows:       gridRows,
    cols:       gridCols,
    algo:       currentAlgo,
    heuristic:  currentHeuristic,
    weight:     weightVal,
    beamWidth:  beamVal,
    depthLimit: depthVal,
    startPos,
    goalPos,
  });
}

function resetGridState() {
  if (isRunning) return; // Jangan reset jika sedang berjalan
  
  // Bersihkan jejak visual dari grid tapi biarkan dinding, start, goal
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (['visited', 'current', 'queued', 'path'].includes(grid[r][c])) {
        grid[r][c] = 'unvisited';
        updateCellUI(r, c);
      }
    }
  }
  
  if (currentView === 'graph') {
    graphNodes.forEach(n => { n.state = grid[n.r][n.c]; });
    drawGraph();
  }

  // Matikan dan buat ulang worker agar statusnya bersih
  if (algoWorker) {
    algoWorker.onmessage = null;
    algoWorker.onerror   = null;
    algoWorker.terminate();
    algoWorker = null;
  }
  
  resetStats();
  document.getElementById('infoStatus').textContent = 'Siap';
  document.getElementById('infoStatus').style.color = 'var(--text3)';
  consoleLog('system', '- Grid direset, siap untuk simulasi berikutnya -');
}

// ===================== SIMULATION ENGINE =====================
function startSimulation() {
  if (!startPos || !goalPos) { consoleLog('error', 'Start/Goal belum ditentukan!'); return; }
  if (isRunning && !isPaused) return;

  // Resume dari jeda
  if (isPaused) {
    isPaused = false;
    document.getElementById('infoStatus').textContent = 'Berjalan';
    document.getElementById('infoStatus').style.color = 'var(--accent4)';
    const speedVal = parseInt(document.getElementById('speedSlider').value);
    const w = getOrCreateWorker();
    w.postMessage({ type: 'speed', value: speedVal });
    if (isTurboMode) w.postMessage({ type: 'turbo', enabled: true });
    w.postMessage({ type: 'resume' });
    updateUIControls();
    return;
  }

  // Otomatis reset visualisasi jika masih ada sisa dari simulasi sebelumnya
  resetGridState();

  isRunning = true; isPaused = false;
  stepCount = 0; visitedCount = 0;
  resetStats();

  document.getElementById('infoStatus').textContent = isTurboMode ? '⚡ Turbo' : '▶ Berjalan';
  document.getElementById('infoStatus').style.color = isTurboMode ? 'var(--accent3)' : 'var(--accent4)';
  document.getElementById('infoStatus').style.background = isTurboMode ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.1)';
  document.getElementById('infoStatus').style.borderColor = isTurboMode ? 'rgba(251,191,36,0.35)' : 'rgba(52,211,153,0.3)';

  const modeLabel = isTurboMode ? ' [⚡ TURBO]' : ' [Generator]';
  consoleLog('system', `=== Memulai ${ALGO_INFO[currentAlgo].title}${modeLabel} ===`);
  consoleLog('info', `Start: (${startPos.r},${startPos.c}) | Goal: (${goalPos.r},${goalPos.c})`);
  consoleLog('info', `Grid: ${gridRows}×${gridCols} | Heuristik: ${currentHeuristic}`);

  // Always spawn a fresh worker so no stale generator state carries over
  const w = _respawnWorker();
  sendGridToWorker();
  const speedVal = parseInt(document.getElementById('speedSlider').value);
  w.postMessage({ type: 'speed', value: speedVal });
  if (isTurboMode) w.postMessage({ type: 'turbo', enabled: true });
  w.postMessage({ type: 'start' });

  updateUIControls();
}

// Algorithm state
let algoState = {};

function initAlgorithm() {
  const s = startPos, g = goalPos;
  const key = (r, c) => `${r},${c}`;
  algoState = { visited: new Set(), parent: {}, gScore: {}, fScore: {}, queue: [], found: false, path: [] };
  algoState.gScore[key(s.r, s.c)] = 0;

  switch (currentAlgo) {
    case 'garislintang':
      algoState.pq = [{ r: s.r, c: s.c, g: 0, f: heuristic(s, g) }];
      algoState.gScore = { [key(s.r, s.c)]: 0 };
      break;
    case 'bfs':
      algoState.queue = [{ r: s.r, c: s.c }];
      algoState.visited.add(key(s.r, s.c));
      break;
    case 'dfs':
      algoState.stack = [{ r: s.r, c: s.c }];
      break;
    case 'dls':
      algoState.stack = [{ r: s.r, c: s.c, depth: 0 }];
      algoState.depthLimit = parseInt(document.getElementById('depthLimitSel').value) || 10;
      break;
    case 'ids':
      algoState.maxDepth = 0; algoState.currentDepth = 0;
      algoState.stack = [{ r: s.r, c: s.c, depth: 0 }];
      algoState.iterVisited = new Set();
      algoState.actualPath = [];
      break;
    case 'ucs':
      algoState.pq = [{ r: s.r, c: s.c, cost: 0 }];
      algoState.costMap = { [key(s.r, s.c)]: 0 };
      break;
    case 'bidirectional':
      algoState.queueF = [{ r: s.r, c: s.c }];
      algoState.queueB = [{ r: g.r, c: g.c }];
      algoState.visitedF = new Set([key(s.r, s.c)]);
      algoState.visitedB = new Set([key(g.r, g.c)]);
      algoState.parentF = {}; algoState.parentB = {};
      algoState.parentF[key(s.r, s.c)] = null;
      algoState.parentB[key(g.r, g.c)] = null;
      algoState.direction = 'forward';
      algoState._biInitDone = true;
      break;
    case 'greedy':
      algoState.pq = [{ r: s.r, c: s.c, h: heuristic(s, g) }];
      break;
    case 'astar':
    case 'weighted_astar':
      algoState.pq = [{ r: s.r, c: s.c, g: 0, f: heuristic(s, g) }];
      algoState.gScore = { [key(s.r, s.c)]: 0 };
      break;
    case 'idastar':
      algoState.threshold = heuristic(s, g);
      algoState.stack = [{ r: s.r, c: s.c, g: 0 }];
      algoState.nextThreshold = Infinity;
      algoState.iterVisited = new Set();
      algoState.actualPath = [];
      break;
    case 'beam':
      algoState.beam = [{ r: s.r, c: s.c, h: heuristic(s, g) }];
      algoState.visited.add(key(s.r, s.c));
      algoState.beamWidth = parseInt(document.getElementById('beamWidthSel').value) || 3;
      break;
    case 'hillclimbing':
    case 'steepest':
      algoState.current = { r: s.r, c: s.c };
      algoState.visited.add(key(s.r, s.c));
      break;
    case 'simulated_annealing':
      algoState.current = { r: s.r, c: s.c };
      algoState.temp = 200; algoState.cooling = 0.995;
      algoState.visited.add(key(s.r, s.c));
      algoState.bestDist = heuristic(s, g);
      algoState.bestPos = { r: s.r, c: s.c };
      algoState.actualPath = [key(s.r, s.c)];
      break;
    case 'tabu':
      algoState.current = { r: s.r, c: s.c };
      algoState.tabuList = [key(s.r, s.c)]; algoState.tabuMax = 15;
      algoState.actualPath = [key(s.r, s.c)];
      break;
    case 'genetic':
      algoState.population = generatePopulation(s, g, 20);
      algoState.generation = 0;
      algoState.bestEver = null;
      break;
    case 'minimax':
      algoState.current = { r: s.r, c: s.c };
      algoState.visited.add(key(s.r, s.c));
      algoState.depth = 4;
      break;
    case 'alphabeta':
      algoState.current = { r: s.r, c: s.c };
      algoState.visited.add(key(s.r, s.c));
      algoState.depth = 4;
      algoState.totalPruned = 0;
      break;
    case 'mcts':
      algoState.root = { r: s.r, c: s.c, parentNode: null, children: [], visits: 0, wins: 0 };
      algoState.iteration = 0;
      algoState.maxIterations = 300;
      break;
    case 'backtracking':
      algoState.stack = [{ r: s.r, c: s.c }];
      break;
    case 'ants':
      algoState.pheromone = {};
      algoState.ants = Array.from({ length: 8 }, () => ({ r: s.r, c: s.c, path: [key(s.r, s.c)], visited: new Set([key(s.r, s.c)]), done: false }));
      algoState.bestPath = null; algoState.iteration = 0;
      algoState.totalIterations = 0;
      break;
    case 'jps':
      algoState.pq = [{ r: s.r, c: s.c, g: 0, f: heuristic(s, g) }];
      algoState.gScore = { [key(s.r, s.c)]: 0 };
      break;
  }
}

function generatePopulation(s, g, size) {
  const pop = [];
  const key = (r, c) => `${r},${c}`;
  for (let i = 0; i < size; i++) {
    const path = [{ r: s.r, c: s.c }];
    let cur = { r: s.r, c: s.c };
    const vis = new Set([key(cur.r, cur.c)]);
    for (let j = 0; j < 40; j++) {
      let nbrs = getNeighbors(cur.r, cur.c).filter(n => grid[n.r][n.c] !== 'wall' && !vis.has(key(n.r, n.c)));
      if (!nbrs.length) break;
      const next = nbrs[Math.floor(Math.random() * nbrs.length)];
      path.push(next); cur = next;
      vis.add(key(next.r, next.c));
      if (cur.r === g.r && cur.c === g.c) break;
    }
    // fitness: path length + penalty for not reaching goal
    pop.push({ path, fitness: path.length + heuristic(cur, g) * 5 });
  }
  return pop;
}

// runNextStep: no-op — logika dipindah ke algo-worker.js (background thread)
function runNextStep() { /* worker mengurus tick */ }

// stepAlgorithm: dipindah ke algo-worker.js (background thread)
// Stub ini hanya dipakai oleh stepThroughSimulation (mode langkah manual)
function stepAlgorithm() {
  if (algoWorker && isRunning) {
    algoWorker.postMessage({ type: 'step' });
  }
  return false;
}

function getNeighbors(r, c, diagonal = false) {
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  if (diagonal) dirs.push(...[[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  const res = [];
  dirs.forEach(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && grid[nr][nc] !== 'wall')
      res.push({ r: nr, c: nc });
  });
  return res;
}

function heuristic(a, b) {
  const dr = Math.abs(a.r - b.r), dc = Math.abs(a.c - b.c);
  switch (currentHeuristic) {
    case 'manhattan': return dr + dc;
    case 'euclidean': return Math.sqrt(dr * dr + dc * dc);
    case 'chebyshev': return Math.max(dr, dc);
    case 'octile': return Math.max(dr, dc) + (Math.sqrt(2) - 1) * Math.min(dr, dc);
    default: return dr + dc;
  }
}

function markCurrent(r, c) {
  if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') { grid[r][c] = 'current'; updateCellUI(r, c); }
  document.getElementById('infoCurrent').textContent = `(${r},${c})`;
  const h = Math.round(heuristic({ r, c }, goalPos) * 10) / 10;
  const g = algoState.gScore ? (algoState.gScore[`${r},${c}`] || 0) : 0;
  document.getElementById('infoHn').textContent = h;
  document.getElementById('infoGn').textContent = g;
  document.getElementById('infoFn').textContent = Math.round((g + h) * 10) / 10;
}

function markVisited(r, c) {
  visitedCount++;
  if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') { grid[r][c] = 'visited'; updateCellUI(r, c); }
  document.getElementById('statVisited').textContent = visitedCount;
}

function markQueued(r, c) {
  if (grid[r][c] !== 'start' && grid[r][c] !== 'goal' && grid[r][c] !== 'visited') { grid[r][c] = 'queued'; updateCellUI(r, c); }
}

function foundGoal(parent, key, gr, gc) {
  const path = [];
  let cur = key(gr, gc);
  while (cur) { path.unshift(cur); cur = parent[cur]; }
  path.forEach(k => {
    const [r, c] = k.split(',').map(Number);
    if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') { grid[r][c] = 'path'; updateCellUI(r, c); }
  });
  document.getElementById('statPath').textContent = path.length;
  document.getElementById('infoStatus').textContent = 'Selesai ✓';
  document.getElementById('infoStatus').style.color = 'var(--accent4)';
  const pathDisplay = document.getElementById('pathDisplay');
  pathDisplay.innerHTML = path.map((k, i) => `<span class="path-node">${k}</span>${i < path.length - 1 ? '<span class="path-arrow">→</span>' : ''}`).join('');
  consoleLog('success', `✓ Path ditemukan! Panjang: ${path.length} node, ${stepCount} langkah, ${visitedCount} dikunjungi`);
  consoleLog('path', `Path: ${path.join(' → ')}`);
  isRunning = false;
  if (currentView === 'graph') { initGraphView(); }
  updateUIControls();
  return true;
}

function noPath() {
  document.getElementById('infoStatus').textContent = 'Gagal ✗';
  document.getElementById('infoStatus').style.color = 'var(--accent5)';
  document.getElementById('statPath').textContent = '∞';
  consoleLog('error', `✗ Tidak ada jalur ditemukan setelah ${stepCount} langkah`);
  isRunning = false;
  updateUIControls();
  return true;
}

function updateQueueDisplay(items) {
  const qd = document.getElementById('queueDisplay');
  document.getElementById('statQueue').textContent = items.length;
  qd.innerHTML = items.slice(0, 12).map(item => {
    const k = typeof item === 'string' ? item : `${item.r},${item.c}`;
    return `<div class="queue-node">${k.split(',').map(Number).map((v, i) => i === 0 ? v : ',' + v).join('')}</div>`;
  }).join('') + (items.length > 12 ? `<div style="font-size:9px;color:var(--text3);padding:4px">+${items.length - 12}</div>` : '');
}

function stepGarisLintang(s, g, key) {
  const as = algoState;
  if (!as.pq.length) return noPath();
  as.pq.sort((a, b) => a.f - b.f);
  const cur = as.pq.shift();
  const { r, c, g: gv } = cur;
  const k = key(r, c);
  if (as.visited.has(k)) return false;
  as.visited.add(k);
  markCurrent(r, c); markVisited(r, c);

  consoleLog('step', `GarisLintang → (${r},${c}) f=${Math.round(cur.f * 10) / 10}`);
  if (r === g.r && c === g.c) return foundGoal(as.parent, key, r, c);

  getNeighbors(r, c).forEach(n => {
    const nk = key(n.r, n.c);
    const ng = gv + 1;
    if (as.gScore[nk] === undefined || ng < as.gScore[nk]) {
      as.gScore[nk] = ng; as.parent[nk] = key(r, c);

      // Calculate f = D_goal + k * T
      const k_val = 2.5; // penalti
      const d_goal = Math.sqrt(Math.pow(n.r - g.r, 2) + Math.pow(n.c - g.c, 2));
      const dx = g.c - s.c;
      const dy = g.r - s.r;
      let cross = 0;
      if (dx === 0 && dy === 0) {
        cross = Math.sqrt(Math.pow(n.r - s.r, 2) + Math.pow(n.c - s.c, 2));
      } else {
        cross = Math.abs(dx * (s.r - n.r) - (s.c - n.c) * dy) / Math.sqrt(dx * dx + dy * dy);
      }
      const f = d_goal + k_val * cross;

      as.pq.push({ ...n, g: ng, f: f });
      markQueued(n.r, n.c);
    }
  });
  updateQueueDisplay(as.pq);
  return false;
}

// ===================== ALGORITHMS =====================
function stepBFS(s, g, key) {
  const { queue, visited, parent } = algoState;
  if (!queue.length) return noPath();
  const { r, c } = queue.shift();
  markCurrent(r, c);
  consoleLog('step', `BFS → Ekspansi (${r},${c}) | Antrian: ${queue.length}`);
  if (r === g.r && c === g.c) return foundGoal(parent, key, r, c);
  markVisited(r, c);
  const nbrs = getNeighbors(r, c);
  nbrs.forEach(n => {
    const k = key(n.r, n.c);
    if (!visited.has(k)) { visited.add(k); parent[k] = key(r, c); queue.push(n); markQueued(n.r, n.c); }
  });
  updateQueueDisplay(queue);
  return false;
}

function stepDFS(s, g, key) {
  const { stack, visited, parent } = algoState;
  if (!stack.length) return noPath();
  const { r, c } = stack.pop();
  const k = key(r, c);
  if (visited.has(k)) return false;
  visited.add(k);
  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `DFS → Ekspansi (${r},${c}) | Stack: ${stack.length}`);
  if (r === g.r && c === g.c) return foundGoal(parent, key, r, c);
  const nbrs = getNeighbors(r, c).reverse();
  nbrs.forEach(n => {
    const nk = key(n.r, n.c);
    if (!visited.has(nk)) { parent[nk] = key(r, c); stack.push(n); markQueued(n.r, n.c); }
  });
  updateQueueDisplay(stack);
  return false;
}

function stepDLS(s, g, key) {
  const { stack, visited, parent, depthLimit } = algoState;
  if (!stack.length) return noPath();
  const { r, c, depth } = stack.pop();
  const k = key(r, c);
  if (visited.has(k)) return false;
  visited.add(k);
  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `DLS[d=${depth}/${depthLimit}] → (${r},${c})`);
  if (r === g.r && c === g.c) return foundGoal(parent, key, r, c);
  if (depth < depthLimit) {
    getNeighbors(r, c).reverse().forEach(n => {
      const nk = key(n.r, n.c);
      if (!visited.has(nk)) { parent[nk] = key(r, c); stack.push({ ...n, depth: depth + 1 }); markQueued(n.r, n.c); }
    });
  }
  updateQueueDisplay(stack);
  return false;
}

function stepIDS(s, g, key) {
  const as = algoState;
  if (!as.stack.length) {
    as.maxDepth++;
    consoleLog('warn', `IDS → Iterasi baru, max depth: ${as.maxDepth}`);
    as.stack = [{ r: s.r, c: s.c, depth: 0 }];
    as.iterVisited = new Set();
    as.actualPath = [];
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (grid[r][c] === 'visited' || grid[r][c] === 'queued') { grid[r][c] = 'unvisited'; updateCellUI(r, c); }
    if (as.maxDepth > gridRows * gridCols) return noPath();
    return false;
  }
  
  const cur = as.stack.pop();
  if (cur.isBacktrack) {
    as.iterVisited.delete(key(cur.r, cur.c));
    as.actualPath.pop();
    return false;
  }
  
  const { r, c, depth } = cur;
  const k = key(r, c);
  
  if (as.iterVisited.has(k)) return false;
  as.iterVisited.add(k);
  as.actualPath = as.actualPath || [];
  as.actualPath.push(k);
  as.stack.push({ isBacktrack: true, r, c });
  
  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `IDS[d=${depth}] → (${r},${c})`);
  
  if (r === g.r && c === g.c) {
    const parentMap = {};
    for (let i = 1; i < as.actualPath.length; i++) parentMap[as.actualPath[i]] = as.actualPath[i-1];
    return foundGoal(parentMap, key, r, c);
  }
  
  if (depth < as.maxDepth) {
    getNeighbors(r, c).reverse().forEach(n => {
      const nk = key(n.r, n.c);
      if (!as.iterVisited.has(nk)) { as.stack.push({ ...n, depth: depth + 1 }); markQueued(n.r, n.c); }
    });
  }
  updateQueueDisplay(as.stack.filter(x => !x.isBacktrack));
  return false;
}

function stepUCS(s, g, key) {
  const { pq, costMap, parent } = algoState;
  if (!pq.length) return noPath();
  pq.sort((a, b) => a.cost - b.cost);
  const { r, c, cost } = pq.shift();
  const k = key(r, c);
  if (algoState.visited.has(k)) return false;
  algoState.visited.add(k);
  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `UCS → (${r},${c}) cost=${cost}`);
  if (r === g.r && c === g.c) return foundGoal(parent, key, r, c);
  getNeighbors(r, c).forEach(n => {
    const nk = key(n.r, n.c);
    const newCost = cost + 1;
    if (costMap[nk] === undefined || newCost < costMap[nk]) { costMap[nk] = newCost; parent[nk] = key(r, c); pq.push({ ...n, cost: newCost }); markQueued(n.r, n.c); }
  });
  updateQueueDisplay(pq);
  return false;
}

function stepBiDir(s, g, key) {
  const as = algoState;
  const isForward = as.direction === 'forward';
  const q = isForward ? as.queueF : as.queueB;
  const vis = isForward ? as.visitedF : as.visitedB;
  const visOther = isForward ? as.visitedB : as.visitedF;
  const par = isForward ? as.parentF : as.parentB;

  // Init sentinel values if not set
  if (!as._biInitDone) {
    as.parentF[key(s.r, s.c)] = null;
    as.parentB[key(g.r, g.c)] = null;
    as._biInitDone = true;
  }

  if (!q.length) {
    if ((isForward ? as.queueB : as.queueF).length) { as.direction = isForward ? 'backward' : 'forward'; return false; }
    return noPath();
  }
  const { r, c } = q.shift();
  const k = key(r, c);
  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `Bi-BFS [${isForward ? '→' : '←'}] → (${r},${c})`);
  if (visOther.has(k)) {
    consoleLog('success', `Pertemuan di (${r},${c})!`);
    // Build path: trace from meetPoint to start via parentF
    const pathToMeet = [];
    let curF = k;
    while (curF !== null && curF !== undefined) {
      pathToMeet.unshift(curF);
      curF = as.parentF[curF];
    }
    // trace from meetPoint to goal via parentB
    const pathFromMeet = [];
    let curB = as.parentB[k];
    while (curB !== null && curB !== undefined) {
      pathFromMeet.push(curB);
      curB = as.parentB[curB];
    }
    const fullPath = [...pathToMeet, ...pathFromMeet];

    // Draw full path
    fullPath.forEach(pk => {
      const [pr, pc] = pk.split(',').map(Number);
      if (grid[pr][pc] !== 'start' && grid[pr][pc] !== 'goal') { grid[pr][pc] = 'path'; updateCellUI(pr, pc); }
    });
    document.getElementById('statPath').textContent = fullPath.length;
    document.getElementById('infoStatus').textContent = 'Selesai ✓';
    document.getElementById('infoStatus').style.color = 'var(--accent4)';
    const pathDisplay = document.getElementById('pathDisplay');
    pathDisplay.innerHTML = fullPath.map((pk, i) => `<span class="path-node">${pk}</span>${i < fullPath.length - 1 ? '<span class="path-arrow">→</span>' : ''}`).join('');
    consoleLog('success', `✓ Bi-BFS path ditemukan! Panjang: ${fullPath.length} node`);
    consoleLog('path', `Path: ${fullPath.join(' → ')}`);
    isRunning = false;
    updateUIControls();
    return true;
  }
  getNeighbors(r, c).forEach(n => {
    const nk = key(n.r, n.c);
    if (!vis.has(nk)) { vis.add(nk); par[nk] = key(r, c); q.push(n); markQueued(n.r, n.c); }
  });
  as.direction = isForward ? 'backward' : 'forward';
  updateQueueDisplay([...as.queueF, ...as.queueB]);
  return false;
}

function stepGreedy(s, g, key) {
  const { pq, visited, parent } = algoState;
  if (!pq.length) return noPath();
  pq.sort((a, b) => a.h - b.h);
  const { r, c } = pq.shift();
  const k = key(r, c);
  if (visited.has(k)) return false;
  visited.add(k);
  markCurrent(r, c); markVisited(r, c);
  const h = Math.round(heuristic({ r, c }, g) * 10) / 10;
  consoleLog('step', `Greedy → (${r},${c}) h=${h}`);
  if (r === g.r && c === g.c) return foundGoal(parent, key, r, c);
  getNeighbors(r, c).forEach(n => {
    const nk = key(n.r, n.c);
    if (!visited.has(nk)) { parent[nk] = key(r, c); pq.push({ ...n, h: heuristic(n, g) }); markQueued(n.r, n.c); }
  });
  updateQueueDisplay(pq);
  return false;
}

function stepAStar(s, g, key, weighted) {
  const as = algoState;
  const w = weighted ? parseFloat(document.getElementById('weightSel').value) : 1.0;
  if (!as.pq.length) return noPath();
  as.pq.sort((a, b) => a.f - b.f);
  const { r, c, g: gv } = as.pq.shift();
  const k = key(r, c);
  if (as.visited.has(k)) return false;
  as.visited.add(k);
  markCurrent(r, c); markVisited(r, c);
  const h = Math.round(heuristic({ r, c }, g) * 10) / 10;
  const f = Math.round((gv + w * h) * 10) / 10;
  consoleLog('step', `${weighted ? 'wA*' : 'A*'} → (${r},${c}) g=${gv} h=${h} f=${f}`);
  if (r === g.r && c === g.c) return foundGoal(as.parent, key, r, c);
  getNeighbors(r, c).forEach(n => {
    const nk = key(n.r, n.c);
    const ng = gv + 1;
    if (as.gScore[nk] === undefined || ng < as.gScore[nk]) {
      as.gScore[nk] = ng; as.parent[nk] = key(r, c);
      as.pq.push({ ...n, g: ng, f: ng + w * heuristic(n, g) });
      markQueued(n.r, n.c);
    }
  });
  updateQueueDisplay(as.pq);
  return false;
}

function stepIDAStar(s, g, key) {
  const as = algoState;
  if (!as.stack.length) {
    if (as.nextThreshold === Infinity) return noPath();
    as.threshold = as.nextThreshold;
    as.nextThreshold = Infinity;
    as.stack = [{ r: s.r, c: s.c, g: 0 }];
    as.iterVisited = new Set();
    as.actualPath = [];
    consoleLog('warn', `IDA* → threshold = ${Math.round(as.threshold * 10) / 10}`);
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) if (grid[r][c] === 'visited' || grid[r][c] === 'queued') { grid[r][c] = 'unvisited'; updateCellUI(r, c); }
    return false;
  }
  const cur = as.stack.pop();
  if (cur.isBacktrack) {
    as.iterVisited.delete(key(cur.r, cur.c));
    as.actualPath.pop();
    return false;
  }
  const { r, c, g: gv } = cur;
  const k = key(r, c);
  const f = gv + heuristic({ r, c }, g);
  if (f > as.threshold) { as.nextThreshold = Math.min(as.nextThreshold, f); return false; }
  
  if (as.iterVisited.has(k)) return false;
  as.iterVisited.add(k);
  as.actualPath = as.actualPath || [];
  as.actualPath.push(k);
  as.stack.push({ isBacktrack: true, r, c });

  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `IDA* → (${r},${c}) g=${gv} f=${Math.round(f * 10) / 10} thresh=${Math.round(as.threshold * 10) / 10}`);
  if (r === g.r && c === g.c) {
    const parentMap = {};
    for (let i = 1; i < as.actualPath.length; i++) parentMap[as.actualPath[i]] = as.actualPath[i-1];
    return foundGoal(parentMap, key, r, c);
  }
  getNeighbors(r, c).reverse().forEach(n => {
    const nk = key(n.r, n.c);
    if (!as.iterVisited.has(nk)) { as.stack.push({ ...n, g: gv + 1 }); markQueued(n.r, n.c); }
  });
  updateQueueDisplay(as.stack.filter(x => !x.isBacktrack));
  return false;
}

function stepBeam(s, g, key) {
  const as = algoState;
  if (!as.beam.length) return noPath();
  const cur = as.beam.shift();
  const { r, c } = cur;
  const k = key(r, c);
  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `Beam[W=${as.beamWidth}] → (${r},${c}) h=${Math.round(cur.h * 10) / 10}`);
  if (r === g.r && c === g.c) return foundGoal(as.parent, key, r, c);
  let candidates = [];
  getNeighbors(r, c).forEach(n => {
    const nk = key(n.r, n.c);
    if (!as.visited.has(nk)) { as.parent[nk] = key(r, c); candidates.push({ ...n, h: heuristic(n, g) }); }
  });
  if (!candidates.length && !as.beam.length) return noPath();
  candidates.sort((a, b) => a.h - b.h);
  candidates = candidates.slice(0, as.beamWidth);
  candidates.forEach(n => { as.visited.add(key(n.r, n.c)); as.beam.push(n); markQueued(n.r, n.c); });
  updateQueueDisplay(as.beam);
  return false;
}

function stepHC(s, g, key, steepest) {
  const as = algoState;
  const { r, c } = as.current;
  markCurrent(r, c); markVisited(r, c);
  if (r === g.r && c === g.c) return foundGoal(as.parent, key, r, c);
  const nbrs = getNeighbors(r, c).filter(n => !as.visited.has(key(n.r, n.c)));
  if (!nbrs.length) return noPath();
  const curH = heuristic({ r, c }, g);
  if (steepest) {
    nbrs.sort((a, b) => heuristic(a, g) - heuristic(b, g));
    const best = nbrs[0];
    if (heuristic(best, g) >= curH) return noPath();
    as.parent[key(best.r, best.c)] = key(r, c);
    as.visited.add(key(best.r, best.c));
    as.current = best;
    markQueued(best.r, best.c);
    consoleLog('step', `Steepest HC → (${best.r},${best.c}) h=${Math.round(heuristic(best, g) * 10) / 10}`);
  } else {
    const better = nbrs.find(n => heuristic(n, g) < curH);
    if (!better) return noPath();
    as.parent[key(better.r, better.c)] = key(r, c);
    as.visited.add(key(better.r, better.c));
    as.current = better;
    markQueued(better.r, better.c);
    consoleLog('step', `HC → (${better.r},${better.c}) h=${Math.round(heuristic(better, g) * 10) / 10}`);
  }
  return false;
}

function stepSA(s, g, key) {
  const as = algoState;
  const { r, c } = as.current;
  markCurrent(r, c); markVisited(r, c);
  as.temp *= as.cooling;
  if (as.temp < 0.001) return noPath();
  if (r === g.r && c === g.c) {
    const parentMap = {};
    for (let i = 1; i < as.actualPath.length; i++) parentMap[as.actualPath[i]] = as.actualPath[i-1];
    return foundGoal(parentMap, key, r, c);
  }
  const nbrs = getNeighbors(r, c);
  if (!nbrs.length) return noPath();
  const next = nbrs[Math.floor(Math.random() * nbrs.length)];
  const curDist = heuristic({ r, c }, g);
  const nextDist = heuristic(next, g);
  const dE = curDist - nextDist;
  const accept = dE > 0 || Math.random() < Math.exp(dE / (as.temp * 0.1));
  if (accept) {
    as.actualPath.push(key(next.r, next.c));
    as.current = next;
    markQueued(next.r, next.c);
    // Track best position found
    if (nextDist < as.bestDist) {
      as.bestDist = nextDist;
      as.bestPos = { r: next.r, c: next.c };
    }
  }
  consoleLog('step', `SA T=${as.temp.toFixed(2)} → (${next.r},${next.c}) ΔE=${dE.toFixed(2)} ${accept ? '✓' : '✗'}`);
  return false;
}

function stepTabu(s, g, key) {
  const as = algoState;
  const { r, c } = as.current;
  markCurrent(r, c); markVisited(r, c);
  if (r === g.r && c === g.c) {
    const parentMap = {};
    for (let i = 1; i < as.actualPath.length; i++) parentMap[as.actualPath[i]] = as.actualPath[i-1];
    return foundGoal(parentMap, key, r, c);
  }
  const nbrs = getNeighbors(r, c).filter(n => !as.tabuList.includes(key(n.r, n.c)));
  if (!nbrs.length) return noPath();
  nbrs.sort((a, b) => heuristic(a, g) - heuristic(b, g));
  const best = nbrs[0];
  const bk = key(best.r, best.c);
  as.actualPath.push(bk);
  as.tabuList.push(bk);
  if (as.tabuList.length > as.tabuMax) as.tabuList.shift();
  as.current = best;
  markQueued(best.r, best.c);
  consoleLog('step', `Tabu → (${best.r},${best.c}) | Tabu size: ${as.tabuList.length}`);
  return false;
}

function stepGenetic(s, g, key) {
  const as = algoState;
  as.generation++;
  as.population.sort((a, b) => a.fitness - b.fitness);
  const best = as.population[0];
  
  if (!as.bestEver || best.fitness < as.bestEver.fitness) {
    as.bestEver = { path: [...best.path], fitness: best.fitness };
  }
  
  const displayBest = as.bestEver;
  const last = displayBest.path[displayBest.path.length - 1];
  
  // Visuals
  visitedCount = as.generation * 20 * Math.floor(gridRows * gridCols * 0.05); // rough estimate
  document.getElementById('statVisited').textContent = visitedCount;
  for (let r=0; r<gridRows; r++) for (let c=0; c<gridCols; c++) if (grid[r][c] === 'visited' || grid[r][c] === 'current' || grid[r][c] === 'queued') { grid[r][c] = 'unvisited'; updateCellUI(r, c); }
  
  if (grid[last.r][last.c] !== 'start' && grid[last.r][last.c] !== 'goal') { grid[last.r][last.c] = 'current'; updateCellUI(last.r, last.c); }
  displayBest.path.forEach(p => {
    if (grid[p.r][p.c] !== 'start' && grid[p.r][p.c] !== 'goal') { grid[p.r][p.c] = 'visited'; updateCellUI(p.r, p.c); }
  });
  consoleLog('step', `GA Gen ${as.generation} | Best fitness: ${displayBest.fitness.toFixed(2)}`);
  
  if (last.r === g.r && last.c === g.c) {
    const parentMap = {};
    for (let i = 1; i < displayBest.path.length; i++) {
      parentMap[key(displayBest.path[i].r, displayBest.path[i].c)] = key(displayBest.path[i-1].r, displayBest.path[i-1].c);
    }
    return foundGoal(parentMap, key, last.r, last.c);
  }
  
  if (as.generation >= 200) return noPath();
  
  // Crossover & Mutation
  const newPop = [as.bestEver]; // Elitism
  while (newPop.length < 20) {
    const p1 = as.population[Math.floor(Math.random() * 5)]; // Select from top 5
    const p2 = as.population[Math.floor(Math.random() * 5)];
    let childPath = [];
    
    // One-point crossover if paths have common nodes (other than start)
    const p2Set = new Set(p2.path.map(p => key(p.r, p.c)));
    let crossIdx = -1;
    for (let i = p1.path.length - 1; i > 0; i--) {
      if (p2Set.has(key(p1.path[i].r, p1.path[i].c))) { crossIdx = i; break; }
    }
    
    if (crossIdx !== -1 && Math.random() < 0.7) { // 70% crossover rate
      const crossNode = p1.path[crossIdx];
      const p2Idx = p2.path.findIndex(p => p.r === crossNode.r && p.c === crossNode.c);
      childPath = [...p1.path.slice(0, crossIdx), ...p2.path.slice(p2Idx)];
    } else {
      childPath = [...p1.path];
    }
    
    // Mutation
    if (Math.random() < 0.3) {
      const mutIdx = Math.floor(Math.random() * childPath.length);
      childPath = childPath.slice(0, mutIdx + 1);
      let cur = childPath[mutIdx];
      const vis = new Set(childPath.map(p => key(p.r, p.c)));
      for (let j = 0; j < 15; j++) {
        let nbrs = getNeighbors(cur.r, cur.c).filter(n => grid[n.r][n.c] !== 'wall' && !vis.has(key(n.r, n.c)));
        if (!nbrs.length) break;
        cur = nbrs[Math.floor(Math.random() * nbrs.length)];
        childPath.push(cur);
        vis.add(key(cur.r, cur.c));
        if (cur.r === g.r && cur.c === g.c) break;
      }
    }
    
    const lastChild = childPath[childPath.length - 1];
    newPop.push({ path: childPath, fitness: childPath.length + heuristic(lastChild, g) * 5 });
  }
  
  as.population = newPop;
  return false;
}

function stepMinimax(s, g, key) {
  const as = algoState;
  const { r, c } = as.current;
  markCurrent(r, c); markVisited(r, c);
  if (r === g.r && c === g.c) return foundGoal(as.parent, key, r, c);
  
  // Game tree evaluation
  const evaluate = (nr, nc, depth, isMax, pathVis) => {
    if (depth === 0 || (nr === g.r && nc === g.c)) {
      return -heuristic({ r: nr, c: nc }, g);
    }
    const nbrs = getNeighbors(nr, nc).filter(n => !as.visited.has(key(n.r, n.c)) && !pathVis.has(key(n.r, n.c)));
    if (!nbrs.length) return -heuristic({ r: nr, c: nc }, g);
    
    if (isMax) {
      let best = -Infinity;
      nbrs.forEach(n => { 
        pathVis.add(key(n.r, n.c));
        best = Math.max(best, evaluate(n.r, n.c, depth - 1, false, pathVis)); 
        pathVis.delete(key(n.r, n.c));
      });
      return best;
    } else {
      let worst = Infinity;
      nbrs.forEach(n => { 
        pathVis.add(key(n.r, n.c));
        worst = Math.min(worst, evaluate(n.r, n.c, depth - 1, true, pathVis)); 
        pathVis.delete(key(n.r, n.c));
      });
      return worst;
    }
  };

  const nbrs = getNeighbors(r, c).filter(n => !as.visited.has(key(n.r, n.c)));
  if (!nbrs.length) return noPath();
  
  let bestVal = -Infinity;
  let bestNext = null;
  nbrs.forEach(n => {
    const pVis = new Set([key(n.r, n.c)]);
    const val = evaluate(n.r, n.c, as.depth - 1, false, pVis);
    markQueued(n.r, n.c);
    if (val > bestVal) { bestVal = val; bestNext = n; }
  });
  
  if (!bestNext) return noPath();
  as.parent[key(bestNext.r, bestNext.c)] = key(r, c);
  as.current = bestNext;
  consoleLog('step', `Minimax → (${bestNext.r},${bestNext.c}) eval=${bestVal.toFixed(1)}`);
  return false;
}

function stepAlphaBeta(s, g, key) {
  const as = algoState;
  const { r, c } = as.current;
  markCurrent(r, c); markVisited(r, c);
  if (r === g.r && c === g.c) return foundGoal(as.parent, key, r, c);
  
  const evaluateAB = (nr, nc, depth, alpha, beta, isMax, pathVis) => {
    if (depth === 0 || (nr === g.r && nc === g.c)) {
      return -heuristic({ r: nr, c: nc }, g);
    }
    const nbrs = getNeighbors(nr, nc).filter(n => !as.visited.has(key(n.r, n.c)) && !pathVis.has(key(n.r, n.c)));
    if (!nbrs.length) return -heuristic({ r: nr, c: nc }, g);
    
    if (isMax) {
      let maxEval = -Infinity;
      for (let n of nbrs) {
        pathVis.add(key(n.r, n.c));
        const ev = evaluateAB(n.r, n.c, depth - 1, alpha, beta, false, pathVis);
        pathVis.delete(key(n.r, n.c));
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) { as.totalPruned++; break; }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let n of nbrs) {
        pathVis.add(key(n.r, n.c));
        const ev = evaluateAB(n.r, n.c, depth - 1, alpha, beta, true, pathVis);
        pathVis.delete(key(n.r, n.c));
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) { as.totalPruned++; break; }
      }
      return minEval;
    }
  };

  const nbrs = getNeighbors(r, c).filter(n => !as.visited.has(key(n.r, n.c)));
  if (!nbrs.length) return noPath();
  
  let bestVal = -Infinity;
  let bestNext = null;
  nbrs.forEach(n => {
    const pVis = new Set([key(n.r, n.c)]);
    const val = evaluateAB(n.r, n.c, as.depth - 1, -Infinity, Infinity, false, pVis);
    markQueued(n.r, n.c);
    if (val > bestVal) { bestVal = val; bestNext = n; }
  });
  
  if (!bestNext) return noPath();
  as.parent[key(bestNext.r, bestNext.c)] = key(r, c);
  as.current = bestNext;
  consoleLog('step', `AlphaBeta → (${bestNext.r},${bestNext.c}) eval=${bestVal.toFixed(1)} pruned=${as.totalPruned}`);
  return false;
}

function stepMCTS(s, g, key) {
  const as = algoState;
  
  // Selection
  let node = as.root;
  while (node.children.length > 0 && node.children.every(c => c.visits > 0)) {
    let bestUcb = -Infinity;
    let nextNode = null;
    for (let c of node.children) {
      const ucb = (c.wins / c.visits) + 1.41 * Math.sqrt(Math.log(node.visits) / c.visits);
      if (ucb > bestUcb) { bestUcb = ucb; nextNode = c; }
    }
    node = nextNode;
  }
  
  // Expansion
  if (node.r !== g.r || node.c !== g.c) {
    if (node.children.length === 0 && node.visits === 0 && (node.r !== s.r || node.c !== s.c)) {
      // Just expanded, roll out directly
    } else {
      if (node.children.length === 0) {
        let anc = node;
        const pathSet = new Set();
        while(anc) { pathSet.add(key(anc.r, anc.c)); anc = anc.parentNode; }
        
        const nbrs = getNeighbors(node.r, node.c).filter(n => !pathSet.has(key(n.r, n.c)));
        node.children = nbrs.map(n => ({ r: n.r, c: n.c, parentNode: node, children: [], visits: 0, wins: 0 }));
        node.children.forEach(c => markQueued(c.r, c.c)); // Visuals
      }
      if (node.children.length > 0) {
        const unvisited = node.children.filter(c => c.visits === 0);
        if (unvisited.length > 0) node = unvisited[Math.floor(Math.random() * unvisited.length)];
      }
    }
  }
  
  // Simulation
  let simNode = { r: node.r, c: node.c };
  let win = 0;
  let steps = 0;
  const simVis = new Set([key(simNode.r, simNode.c)]);
  while (steps < 40) { // Limit depth
    if (simNode.r === g.r && simNode.c === g.c) { win = 1; break; }
    const nbrs = getNeighbors(simNode.r, simNode.c).filter(n => grid[n.r][n.c] !== 'wall' && !simVis.has(key(n.r, n.c)));
    if (!nbrs.length) break;
    simNode = nbrs[Math.floor(Math.random() * nbrs.length)];
    simVis.add(key(simNode.r, simNode.c));
    steps++;
  }
  if (win === 0) {
    const dist = heuristic(simNode, g);
    const startDist = heuristic(s, g);
    win = Math.max(0, 1 - (dist / startDist));
  }
  
  // Backpropagation
  let cur = node;
  while (cur) {
    cur.visits++;
    cur.wins += win;
    cur = cur.parentNode;
  }
  
  as.iteration++;
  as.visited.add(key(node.r, node.c));
  markCurrent(node.r, node.c);
  markVisited(node.r, node.c);
  
  consoleLog('step', `MCTS Iteration ${as.iteration} → Simulated from (${node.r},${node.c}), win=${win.toFixed(2)}`);
  
  if (as.iteration >= as.maxIterations || (node.r === g.r && node.c === g.c && win === 1)) {
    // Reconstruct path
    const parentMap = {};
    let finalCur = as.root;
    let pathFound = false;
    let safeGuard = 0;
    while (finalCur && safeGuard < 1000) {
      safeGuard++;
      if (finalCur.r === g.r && finalCur.c === g.c) { pathFound = true; break; }
      if (!finalCur.children.length) break;
      let bestChild = finalCur.children[0];
      for (let c of finalCur.children) {
        if (c.visits > bestChild.visits) bestChild = c;
      }
      parentMap[key(bestChild.r, bestChild.c)] = key(finalCur.r, finalCur.c);
      finalCur = bestChild;
    }
    if (pathFound || finalCur !== as.root) {
      return foundGoal(parentMap, key, finalCur.r, finalCur.c);
    } else {
      return noPath();
    }
  }
  return false;
}

function stepBacktracking(s, g, key) {
  const as = algoState;
  if (!as.stack.length) return noPath();
  const cur = as.stack.pop();
  
  if (cur.isBacktrack) {
    as.visited.delete(key(cur.r, cur.c));
    as.actualPath.pop();
    return false;
  }
  
  const { r, c } = cur;
  const k = key(r, c);
  
  if (as.visited.has(k)) return false;
  as.visited.add(k);
  as.actualPath = as.actualPath || [];
  as.actualPath.push(k);
  as.stack.push({ isBacktrack: true, r, c });

  markCurrent(r, c); markVisited(r, c);
  consoleLog('step', `BT → (${r},${c}) depth=${as.actualPath.length}`);
  if (r === g.r && c === g.c) {
    const parentMap = {};
    for (let i = 1; i < as.actualPath.length; i++) parentMap[as.actualPath[i]] = as.actualPath[i-1];
    return foundGoal(parentMap, key, r, c);
  }
  getNeighbors(r, c).reverse().forEach(n => {
    const nk = key(n.r, n.c);
    if (!as.visited.has(nk)) { as.stack.push(n); markQueued(n.r, n.c); }
  });
  updateQueueDisplay(as.stack.filter(x => !x.isBacktrack));
  return false;
}

function stepACO(s, g, key) {
  const as = algoState;
  
  if (as.totalIterations >= 1000 || as.iteration >= 200) {
    if (as.bestPath) {
      const parentMap = {};
      for (let i = 1; i < as.bestPath.length; i++) {
        parentMap[as.bestPath[i]] = as.bestPath[i-1];
      }
      const lastK = as.bestPath[as.bestPath.length-1];
      const r = parseInt(lastK.split(',')[0]);
      const c = parseInt(lastK.split(',')[1]);
      return foundGoal(parentMap, key, r, c);
    }
    return noPath();
  }
  
  let allDone = true;
  for (let ant of as.ants) {
    if (ant.done) continue;
    allDone = false;
    const cur = ant.path[ant.path.length - 1];
    const { r, c } = { r: parseInt(cur.split(',')[0]), c: parseInt(cur.split(',')[1]) };
    
    if (r === g.r && c === g.c) {
      ant.done = true;
      if (!as.bestPath || ant.path.length < as.bestPath.length) {
        as.bestPath = [...ant.path];
      }
      continue;
    }
    
    const nbrs = getNeighbors(r, c).filter(n => grid[n.r][n.c] !== 'wall' && !ant.visited.has(key(n.r, n.c)));
    if (!nbrs.length) {
      ant.done = true;
      continue;
    }
    
    let totalProb = 0;
    const probs = [];
    nbrs.forEach(n => {
      const k = key(n.r, n.c);
      const tau = as.pheromone[k] || 0.1;
      const eta = 1 / (heuristic(n, g) + 0.1);
      const prob = Math.pow(tau, 1.0) * Math.pow(eta, 2.0);
      totalProb += prob;
      probs.push({ node: n, prob });
    });
    
    let nextNode = nbrs[0];
    if (totalProb > 0) {
      let rand = Math.random() * totalProb;
      for (let p of probs) {
        rand -= p.prob;
        if (rand <= 0) { nextNode = p.node; break; }
      }
    }
    
    const nk = key(nextNode.r, nextNode.c);
    ant.path.push(nk);
    ant.visited.add(nk);
    markVisited(nextNode.r, nextNode.c);
    markCurrent(nextNode.r, nextNode.c);
  }
  
  if (allDone) {
    as.iteration++;
    // Evaporation
    for (let k in as.pheromone) {
      as.pheromone[k] *= 0.7; // 30% evaporation
    }
    // Deposit best path
    if (as.bestPath) {
      const deposit = 100 / as.bestPath.length;
      as.bestPath.forEach(k => {
        as.pheromone[k] = (as.pheromone[k] || 0.1) + deposit;
        const [r, c] = k.split(',').map(Number);
        if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') markQueued(r, c); // Visual indicator
      });
    }
    // Reset ants
    as.ants = Array.from({ length: 8 }, () => ({ r: s.r, c: s.c, path: [key(s.r, s.c)], visited: new Set([key(s.r, s.c)]), done: false }));
    consoleLog('step', `ACO Iteration ${as.iteration} | Best Path: ${as.bestPath ? as.bestPath.length : '-'}`);
  }
  
  as.totalIterations++;
  return false;
}

function stepJPS(s, g, key) {
  const as = algoState;
  if (!as.pq.length) return noPath();
  as.pq.sort((a, b) => a.f - b.f);
  const cur = as.pq.shift();
  const { r, c, g: gv } = cur;
  const k = key(r, c);
  
  if (as.visited.has(k)) return false;
  as.visited.add(k);
  markCurrent(r, c); markVisited(r, c);
  
  consoleLog('step', `JPS → (${r},${c}) f=${Math.round(cur.f * 10) / 10}`);
  if (r === g.r && c === g.c) return foundGoal(as.parent, key, r, c);
  
  const jump = (startR, startC, dr, dc) => {
    let r = startR, c = startC;
    while (true) {
      let nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols || grid[nr][nc] === 'wall') return null;
      if (nr === g.r && nc === g.c) return { r: nr, c: nc };
      
      // Check for forced neighbors
      if (dr !== 0) { // Moving vertically
        if ((nc + 1 < gridCols && grid[r][nc + 1] === 'wall' && grid[nr][nc + 1] !== 'wall') ||
            (nc - 1 >= 0 && grid[r][nc - 1] === 'wall' && grid[nr][nc - 1] !== 'wall')) {
          return { r: nr, c: nc };
        }
      } else { // Moving horizontally
        if ((nr + 1 < gridRows && grid[nr + 1][c] === 'wall' && grid[nr + 1][nc] !== 'wall') ||
            (nr - 1 >= 0 && grid[nr - 1][c] === 'wall' && grid[nr - 1][nc] !== 'wall')) {
          return { r: nr, c: nc };
        }
      }
      r = nr;
      c = nc;
    }
  };
  
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  dirs.forEach(([dr, dc]) => {
    const jp = jump(r, c, dr, dc);
    if (jp) {
      const jpk = key(jp.r, jp.c);
      const ng = gv + Math.abs(jp.r - r) + Math.abs(jp.c - c);
      if (as.gScore[jpk] === undefined || ng < as.gScore[jpk]) {
        as.gScore[jpk] = ng;
        as.parent[jpk] = key(r, c);
        as.pq.push({ ...jp, g: ng, f: ng + heuristic(jp, g) });
        markQueued(jp.r, jp.c);
      }
    }
  });
  
  updateQueueDisplay(as.pq);
  return false;
}

// ===================== CONTROLS =====================
function pauseSimulation() {
  if (!isRunning) return;
  isPaused = !isPaused;
  clearTimeout(simulationTimer);
  const btn = document.getElementById('btnPause');
  if (isPaused) {
    btn.textContent = '\u25b6 Lanjut';
    document.getElementById('infoStatus').textContent = 'Dijeda';
    document.getElementById('infoStatus').style.color = 'var(--accent3)';
    consoleLog('warn', 'Simulasi dijeda');
    if (algoWorker) algoWorker.postMessage({ type: 'pause' });
  } else {
    btn.textContent = '\u23f8 Jeda';
    document.getElementById('infoStatus').textContent = 'Berjalan';
    document.getElementById('infoStatus').style.color = 'var(--accent4)';
    consoleLog('info', 'Simulasi dilanjutkan');
    if (algoWorker) {
      const speedVal = parseInt(document.getElementById('speedSlider').value);
      algoWorker.postMessage({ type: 'speed', value: speedVal });
      algoWorker.postMessage({ type: 'resume' });
    }
  }
  updateUIControls();
}

function stepThroughSimulation() {
  if (!startPos || !goalPos) { consoleLog('error', 'Start/Goal belum ditentukan!'); return; }

  if (!isRunning) {
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++)
        if (['visited', 'current', 'queued', 'path'].includes(grid[r][c])) { grid[r][c] = 'unvisited'; updateCellUI(r, c); }

    isRunning = true; isPaused = true;
    stepCount = 0; visitedCount = 0;
    resetStats();
    document.getElementById('infoStatus').textContent = 'Dijeda (Langkah)';
    document.getElementById('infoStatus').style.color = 'var(--accent3)';
    consoleLog('system', '=== Memulai ' + ALGO_INFO[currentAlgo].title + ' (Langkah-per-Langkah) ===');

    // Always spawn a fresh worker so no stale generator carries over
    _respawnWorker();
    sendGridToWorker();
    algoWorker.postMessage({ type: 'speed', value: 1 });
    // Worker di-pause, belum start
  } else {
    isPaused = true;
    clearTimeout(simulationTimer);
    if (algoWorker) algoWorker.postMessage({ type: 'pause' });
    document.getElementById('btnPause').textContent = '\u25b6 Lanjut';
    document.getElementById('infoStatus').textContent = 'Dijeda (Langkah)';
    document.getElementById('infoStatus').style.color = 'var(--accent3)';
  }

  updateUIControls();
  // Kirim satu langkah saja ke worker
  if (algoWorker) algoWorker.postMessage({ type: 'step' });
}

function stopSimulation() {
  isRunning = false; isPaused = false;
  clearTimeout(simulationTimer);
  resetGridState();
  
  document.getElementById('btnPause').textContent = '⏸ Jeda';
  document.getElementById('infoStatus').textContent = 'Berhenti';
  document.getElementById('infoStatus').style.color = 'var(--accent5)';
  if (stepCount > 0) consoleLog('warn', 'Simulasi dihentikan di langkah ' + stepCount);
  
  updateUIControls();
}

function resetAll() {
  stopSimulation();
  initGrid(gridRows, gridCols);
  resetStats();
  consoleLog('system', '=== Reset Semua ===');
}

function resetStats() {
  stepCount = 0; visitedCount = 0;
  document.getElementById('statSteps').textContent = '0';
  document.getElementById('statVisited').textContent = '0';
  document.getElementById('statQueue').textContent = '0';
  document.getElementById('statPath').textContent = '-';
  document.getElementById('infoStep').textContent = '0';
  document.getElementById('infoCurrent').textContent = '-';
  document.getElementById('infoGn').textContent = '-';
  document.getElementById('infoHn').textContent = '-';
  document.getElementById('infoFn').textContent = '-';
  document.getElementById('queueDisplay').innerHTML = '';
  document.getElementById('pathDisplay').innerHTML = '<span style="color:var(--text3);font-size:10px">Belum ada jalur</span>';
  const statusEl = document.getElementById('infoStatus');
  statusEl.textContent = 'Siap';
  statusEl.style.color = 'var(--text3)';
  statusEl.style.background = 'transparent';
  statusEl.style.borderColor = 'transparent';
}

function updateUIControls() {
  const startBtn = document.getElementById('btnStart');
  const stepBtn  = document.getElementById('btnStep');
  const pauseBtn = document.getElementById('btnPause');
  const stopBtn  = document.getElementById('btnStop');
  const heuristicSel  = document.getElementById('heuristicSel');
  const weightSel     = document.getElementById('weightSel');
  const beamWidthSel  = document.getElementById('beamWidthSel');
  const depthLimitSel = document.getElementById('depthLimitSel');
  // Only target normal-mode grid size buttons (not compare ones)
  const gridSizeBtns = document.querySelectorAll('#rightNormal .grid-size-btn');
  const toolBtns     = document.querySelectorAll('#canvasWrapNormal .canvas-toolbar button');
  // Algo items in sidebar: NEVER disabled regardless of simulation state
  // (user can still browse algo info; selectAlgo guards against running state internally)

  if (!isRunning) {
    if (startBtn) startBtn.disabled = false;
    if (stepBtn)  stepBtn.disabled  = false;
    if (pauseBtn) pauseBtn.disabled = true;
    if (stopBtn)  stopBtn.disabled  = true;
    if (heuristicSel)  heuristicSel.disabled  = false;
    if (weightSel)     weightSel.disabled     = false;
    if (beamWidthSel)  beamWidthSel.disabled  = false;
    if (depthLimitSel) depthLimitSel.disabled = false;
    gridSizeBtns.forEach(el => el.disabled = false);
    toolBtns.forEach(el => el.disabled = false);
  } else if (isPaused) {
    if (startBtn) startBtn.disabled = true;
    if (stepBtn)  stepBtn.disabled  = false;
    if (pauseBtn) pauseBtn.disabled = false;
    if (stopBtn)  stopBtn.disabled  = false;
    if (heuristicSel)  heuristicSel.disabled  = true;
    if (weightSel)     weightSel.disabled     = true;
    if (beamWidthSel)  beamWidthSel.disabled  = true;
    if (depthLimitSel) depthLimitSel.disabled = true;
    gridSizeBtns.forEach(el => el.disabled = true);
    toolBtns.forEach(el => el.disabled = true);
  } else {
    if (startBtn) startBtn.disabled = true;
    if (stepBtn)  stepBtn.disabled  = true;
    if (pauseBtn) pauseBtn.disabled = false;
    if (stopBtn)  stopBtn.disabled  = false;
    if (heuristicSel)  heuristicSel.disabled  = true;
    if (weightSel)     weightSel.disabled     = true;
    if (beamWidthSel)  beamWidthSel.disabled  = true;
    if (depthLimitSel) depthLimitSel.disabled = true;
    gridSizeBtns.forEach(el => el.disabled = true);
    toolBtns.forEach(el => el.disabled = true);
  }
}

function updateSpeed(v) {
  const labels = ['Sangat Lambat', 'Lambat', 'Sedang', 'Cepat', 'Sangat Cepat'];
  document.getElementById('speedLabel').textContent = labels[v - 1];
  if (algoWorker && isRunning) algoWorker.postMessage({ type: 'speed', value: parseInt(v) });
}

// ===================== TURBO MODE =====================
function toggleTurboMode() {
  isTurboMode = !isTurboMode;
  _setTurboUI(isTurboMode);
  if (algoWorker && isRunning) {
    algoWorker.postMessage({ type: 'turbo', enabled: isTurboMode });
  }
  consoleLog('system', isTurboMode
    ? '⚡ Turbo Mode ON — ribuan step per detik, batch flush ~60fps'
    : '🔵 Normal Mode — Generator + Interval Ticking');
}

function _setTurboUI(active) {
  const btn       = document.getElementById('btnTurbo');
  const modeBadge = document.getElementById('modeBadge');
  const tickBadge = document.getElementById('tickBadge');

  if (btn) {
    if (active) {
      btn.classList.add('active');
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> ⚡ Turbo ON`;
      btn.title = 'Mode Turbo aktif — klik untuk mematikan';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> ⚡ Turbo Mode`;
      btn.title = 'Aktifkan Turbo Mode untuk simulasi skala besar super cepat';
    }
  }

  if (modeBadge) {
    modeBadge.textContent = active ? '⚡ Generator' : '⚙ Generator';
    modeBadge.className   = active ? 'gen-badge turbo' : 'gen-badge';
  }
  if (tickBadge) {
    tickBadge.textContent = active ? 'Turbo Batch' : 'Interval Tick';
    tickBadge.style.color = active ? 'var(--accent3)' : 'var(--text3)';
  }
}

function updateHeuristic(v) {
  currentHeuristic = v;
  consoleLog('info', `Heuristik diubah: ${v}`);
}

function updateWeight(v) {
  currentWeight = parseFloat(v);
  consoleLog('info', `Weight A*: w=${v}`);
}

// ===================== CONSOLE =====================
function consoleLog(type, msg) {
  const body = document.getElementById('consoleBody');
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
  const line = document.createElement('div');
  line.className = 'log-line';
  const typeClass = { info: 'log-info', warn: 'log-warn', success: 'log-success', error: 'log-error', step: 'log-step', path: 'log-path', system: 'log-system' };
  const prefix = { info: '[INFO]', warn: '[WARN]', success: '[ OK ]', error: '[ERR ]', step: '[STEP]', path: '[PATH]', system: '[SYS ]' };
  line.innerHTML = `<span class="log-time">${time}</span><span class="${typeClass[type] || 'log-step'}">${prefix[type] || '[LOG]'} ${msg}</span>`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
  logHistory.push(`${time} ${prefix[type]} ${msg}`);
  // Keep max 500 lines
  if (body.children.length > 500) body.removeChild(body.firstChild);
}

function clearConsole() {
  document.getElementById('consoleBody').innerHTML = '';
  logHistory = [];
  consoleLog('system', 'Console dibersihkan');
}

function exportLog() {
  const blob = new Blob([logHistory.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `simulasi-${currentAlgo}-${Date.now()}.log`; a.click();
  consoleLog('success', 'Log diekspor');
}

function toggleConsole() {
  const area = document.querySelector('.console-area');
  const btn = document.getElementById('consoleToggle');
  consoleVisible = !consoleVisible;
  area.style.height = consoleVisible ? '160px' : '32px';
  area.querySelector('.console-body').style.display = consoleVisible ? '' : 'none';
  area.querySelector('.console-input-row').style.display = consoleVisible ? '' : 'none';
  btn.textContent = consoleVisible ? '▼ Tutup' : '▲ Buka';
}

function handleConsoleInput(e) {
  if (e.key !== 'Enter') return;
  const input = e.target;
  const cmd = input.value.trim().toLowerCase();
  input.value = '';
  consoleLog('info', `>>> ${cmd}`);
  const parts = cmd.split(' ');
  switch (parts[0]) {
    case 'help':
      consoleLog('system', 'Perintah: help | run | pause | stop | reset | maze | clear | stats | algo [nama] | speed [1-5] | grid [rows] [cols]');
      break;
    case 'run': case 'start': startSimulation(); break;
    case 'pause': pauseSimulation(); break;
    case 'stop': stopSimulation(); break;
    case 'reset': resetAll(); break;
    case 'maze': generateMaze(); break;
    case 'clear': clearGrid(); break;
    case 'stats':
      consoleLog('info', `Stats: Steps=${stepCount} Visited=${visitedCount} Algo=${currentAlgo} Grid=${gridRows}×${gridCols}`);
      break;
    case 'algo':
      if (parts[1] && ALGO_INFO[parts[1]]) {
        const el = document.querySelector(`[data-algo="${parts[1]}"]`);
        if (el) selectAlgo(el, parts[1]);
      } else consoleLog('error', 'Algo tidak ditemukan. Coba: bfs, dfs, astar, ucs, greedy ...');
      break;
    case 'speed':
      if (parts[1]) { document.getElementById('speedSlider').value = parts[1]; updateSpeed(parts[1]); }
      break;
    case 'grid':
      if (parts[1] && parts[2]) setGridSize(parseInt(parts[1]), parseInt(parts[2]), document.querySelector('.grid-size-btn'));
      break;
    case 'version':
      consoleLog('system', 'Simulasi Searching v2.0 | AI Visualization Lab | 2024');
      break;
    default:
      consoleLog('error', `Perintah tidak dikenal: "${cmd}". Ketik "help" untuk bantuan.`);
  }
}

// ===================== MODAL =====================
function openModal(type) {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('show');
  if (type === 'bantuan') {
    document.getElementById('modalTitle').textContent = '📚 Panduan Penggunaan';
    document.getElementById('modalContent').innerHTML = `
      <p><strong style="color:var(--accent)">1. Pilih Algoritma</strong> dari sidebar kiri</p>
      <p><strong style="color:var(--accent)">2. Gambar dinding</strong> dengan klik/drag di grid. Gunakan toolbar untuk mode Start/Goal/Dinding</p>
      <p><strong style="color:var(--accent)">3. Generate Maze</strong> otomatis atau buat sendiri</p>
      <p><strong style="color:var(--accent)">4. Pilih tampilan</strong>: 2D Grid, 3D Isometric, atau Graph</p>
      <p><strong style="color:var(--accent)">5. Atur kecepatan</strong> dan heuristik di panel kanan</p>
      <p><strong style="color:var(--accent)">6. Tekan Mulai</strong> dan amati visualisasi langkah demi langkah</p>
      <p><strong style="color:var(--accent)">Console</strong>: Gunakan perintah seperti <code style="color:var(--accent3)">help, run, maze, clear, algo bfs</code></p>
    `;
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

// ===================== INIT =====================
// ===================== THEME SWITCHING =====================
function setTheme(theme, btn) {
  // Remove all theme classes
  document.body.classList.remove('theme-light', 'theme-warm');
  // Add the selected theme class
  if (theme === 'light') document.body.classList.add('theme-light');
  else if (theme === 'warm') document.body.classList.add('theme-warm');
  // Update button active states
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Update 3D colors if active
  if (currentView === '3d') init3D();
  if (currentView === 'graph') drawGraph();
  consoleLog('system', `Tema diubah: ${theme === 'dark' ? 'Gelap' : theme === 'light' ? 'Terang' : 'Hangat'}`);
}

window.addEventListener('load', () => {
  initGrid(15, 20);
  consoleLog('system', '=== Simulasi Searching v2.0 dimuat ===');
  consoleLog('info', 'Algoritma tersedia: 24 algoritma searching AI');
  consoleLog('info', 'Tampilan: 2D Grid | 3D Isometric | Graph');
  consoleLog('system', 'Ketik "help" untuk daftar perintah console');

  // Zoom-in / Zoom-out untuk 2D grid
  const grid2DDiv = document.getElementById('grid2d');
  if (grid2DDiv) {
    grid2DDiv.addEventListener('wheel', (e) => {
      if (currentView !== '2d') return;
      e.preventDefault();
      gridZoom *= (1 - e.deltaY * 0.001);
      gridZoom = Math.max(0.4, Math.min(3, gridZoom));
      const container = document.getElementById('gridContainer');
      if (container) {
        container.style.transform = `scale(${gridZoom})`;
      }
    }, { passive: false });
  }

  // Initial state UI controls
  updateUIControls();

  // Handle window resize for 3D
  window.addEventListener('resize', () => { if (currentView === '3d') init3D(); if (currentView === 'graph') initGraphView(); });
});
// ===================== COMPARE MODE =====================
let compareMode = false;
let cmpGrid = [];
let cmpStartPos = null, cmpGoalPos = null;
let cmpRows = 15, cmpCols = 20;
let cmpTool = 'wall';
let cmpMouseDown = false;

let cmpState = {
  A: { algo: 'bfs',   algoState: {}, running: false, done: false, found: false, steps: 0, visited: 0, pathLen: 0, queueLen: 0, startTime: 0, elapsed: 0, timer: null, grid: [], prevGrid: [] },
  B: { algo: 'astar', algoState: {}, running: false, done: false, found: false, steps: 0, visited: 0, pathLen: 0, queueLen: 0, startTime: 0, elapsed: 0, timer: null, grid: [], prevGrid: [] }
};
let cmpIsPaused = false;
let cmpFinishedCount = 0;
let _cmpRafPending = false; // requestAnimationFrame guard

// ----- Toggle -----
function toggleCompareMode() {
  compareMode = !compareMode;
  const btn             = document.getElementById('btnCompareToggle');
  const compareDualWrap = document.getElementById('compareDualWrap');
  const canvasNormal    = document.getElementById('canvasWrapNormal');
  const rightNormal     = document.getElementById('rightNormal');
  const rightCompare    = document.getElementById('rightCompare');
  const statsRow        = document.getElementById('statsRowNormal');
  const viewToggle      = document.getElementById('viewToggleNormal');

  if (compareMode) {
    btn.classList.add('active');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/></svg> Mode Biasa`;
    compareDualWrap.style.display = 'flex';
    canvasNormal.style.display    = 'none';
    rightNormal.style.display     = 'none';
    rightCompare.style.display    = 'flex';
    if (statsRow)   statsRow.style.display  = 'none';
    if (viewToggle) viewToggle.style.display = 'none';
    stopSimulation();
    populateCompareDropdowns();
    initCompareGrid();
    consoleLog('system', '=== Mode Komparasi Aktif ===');
  } else {
    btn.classList.remove('active');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/></svg> Bandingkan`;
    compareDualWrap.style.display = 'none';
    canvasNormal.style.display    = '';
    rightNormal.style.display     = 'flex';
    rightCompare.style.display    = 'none';
    if (statsRow)   statsRow.style.display  = '';
    if (viewToggle) viewToggle.style.display = '';
    stopCompare();
    consoleLog('system', '=== Mode Biasa Aktif ===');
  }
}

// ----- Dropdowns -----
function populateCompareDropdowns() {
  const selA = document.getElementById('compareAlgoA');
  const selB = document.getElementById('compareAlgoB');
  const algos = Object.keys(ALGO_INFO);
  const makeOpts = (sel, defaultVal) => {
    sel.innerHTML = '';
    algos.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = ALGO_INFO[k].title;
      if (k === defaultVal) opt.selected = true;
      sel.appendChild(opt);
    });
  };
  makeOpts(selA, cmpState.A.algo || 'bfs');
  makeOpts(selB, cmpState.B.algo || 'astar');
  onCompareAlgoChange();
}

function onCompareAlgoChange() {
  const algoA = document.getElementById('compareAlgoA')?.value || 'bfs';
  const algoB = document.getElementById('compareAlgoB')?.value || 'astar';
  cmpState.A.algo = algoA;
  cmpState.B.algo = algoB;
  document.getElementById('compareGridTitleA').textContent = ALGO_INFO[algoA]?.title || algoA;
  document.getElementById('compareGridTitleB').textContent = ALGO_INFO[algoB]?.title || algoB;
  document.getElementById('scoreAlgoNameA').textContent    = ALGO_INFO[algoA]?.title || algoA;
  document.getElementById('scoreAlgoNameB').textContent    = ALGO_INFO[algoB]?.title || algoB;
}

// ----- Grid init / render -----
function initCompareGrid() {
  cmpRows = gridRows; cmpCols = gridCols;
  cmpGrid = Array.from({ length: cmpRows }, (_, r) =>
    Array.from({ length: cmpCols }, (_, c) => {
      const v = grid[r][c];
      return ['visited','current','queued','path'].includes(v) ? 'unvisited' : v;
    })
  );
  cmpStartPos = startPos ? { ...startPos } : { r: Math.floor(cmpRows/2), c: 2 };
  cmpGoalPos  = goalPos  ? { ...goalPos  } : { r: Math.floor(cmpRows/2), c: cmpCols - 3 };
  renderCompareGrids();
}

function renderCompareGrids() {
  _buildCmpGrid('A', 'gridContainerA');
  _buildCmpGrid('B', 'gridContainerB');
}

function _buildCmpGrid(side, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const cellSize = _getCmpCellSize();
  container.style.gridTemplateColumns = `repeat(${cmpCols}, ${cellSize}px)`;
  container.innerHTML = '';
  const srcGrid = (cmpState[side].running && cmpState[side].grid.length) ? cmpState[side].grid : cmpGrid;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < cmpRows; r++) {
    for (let c = 0; c < cmpCols; c++) {
      const st = srcGrid[r][c];
      const cell = document.createElement('div');
      cell.className = `cell ${st}`;
      cell.style.cssText = `width:${cellSize}px;height:${cellSize}px`;
      if (st === 'start') cell.innerHTML = `<span style="font-size:9px">S</span>`;
      else if (st === 'goal')  cell.innerHTML = `<span style="font-size:9px">G</span>`;
      if (!cmpState.A.running && !cmpState.B.running) {
        cell.addEventListener('mousedown', () => { cmpMouseDown = true; paintCmpCell(r, c); });
        cell.addEventListener('mouseenter', () => { if (cmpMouseDown) paintCmpCell(r, c); });
        cell.addEventListener('mouseup',    () => { cmpMouseDown = false; });
      }
      frag.appendChild(cell);
    }
  }
  container.appendChild(frag);
  // init prevGrid snapshot
  cmpState[side].prevGrid = srcGrid.map(row => [...row]);
}

function _getCmpCellSize() {
  const wrap = document.getElementById('compareGridInnerA');
  if (!wrap) return 18;
  const w = wrap.clientWidth  - 16;
  const h = wrap.clientHeight - 16;
  return Math.max(10, Math.min(24, Math.floor(Math.min(w / cmpCols, h / cmpRows))));
}

// Only repaint cells whose state actually changed (dirty tracking)
function _patchCmpGrid(side) {
  const containerId = side === 'A' ? 'gridContainerA' : 'gridContainerB';
  const container = document.getElementById(containerId);
  if (!container) return;
  const cur  = cmpState[side].grid;
  const prev = cmpState[side].prevGrid;
  const ch   = container.children;
  for (let r = 0; r < cmpRows; r++) {
    for (let c = 0; c < cmpCols; c++) {
      const idx = r * cmpCols + c;
      const newSt = cur[r][c];
      if (newSt === prev[r][c]) continue; // skip unchanged
      const cell = ch[idx];
      if (!cell) continue;
      cell.className = `cell ${newSt}`;
      cell.innerHTML = '';
      if (newSt === 'start') cell.innerHTML = `<span style="font-size:9px">S</span>`;
      else if (newSt === 'goal') cell.innerHTML = `<span style="font-size:9px">G</span>`;
      prev[r][c] = newSt;
    }
  }
}

function paintCmpCell(r, c) {
  if (cmpState.A.running || cmpState.B.running) return;
  const current = cmpGrid[r][c];
  if (cmpTool === 'wall') {
    if (current === 'start' || current === 'goal') return;
    cmpGrid[r][c] = current === 'wall' ? 'unvisited' : 'wall';
  } else if (cmpTool === 'start') {
    if (current === 'goal') return;
    if (cmpStartPos) cmpGrid[cmpStartPos.r][cmpStartPos.c] = 'unvisited';
    cmpStartPos = { r, c };
    cmpGrid[r][c] = 'start';
  } else if (cmpTool === 'goal') {
    if (current === 'start') return;
    if (cmpGoalPos) cmpGrid[cmpGoalPos.r][cmpGoalPos.c] = 'unvisited';
    cmpGoalPos = { r, c };
    cmpGrid[r][c] = 'goal';
  }
  // patch both grids from cmpGrid
  ['A','B'].forEach(side => {
    const container = document.getElementById(side === 'A' ? 'gridContainerA' : 'gridContainerB');
    if (!container) return;
    const idx = r * cmpCols + c;
    const cell = container.children[idx];
    if (!cell) return;
    cell.className = `cell ${cmpGrid[r][c]}`;
    cell.innerHTML = '';
    if (cmpGrid[r][c] === 'start') cell.innerHTML = `<span style="font-size:9px">S</span>`;
    else if (cmpGrid[r][c] === 'goal') cell.innerHTML = `<span style="font-size:9px">G</span>`;
  });
}

function setCmpTool(tool, btn) {
  cmpTool = tool;
  document.querySelectorAll('#compareToolbar .tool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function generateCompareMaze() {
  if (cmpState.A.running || cmpState.B.running) return;
  cmpGrid = Array.from({ length: cmpRows }, () => Array(cmpCols).fill('unvisited'));
  for (let r = 0; r < cmpRows; r++)
    for (let c = 0; c < cmpCols; c++)
      if (cmpGrid[r][c] !== 'start' && cmpGrid[r][c] !== 'goal')
        cmpGrid[r][c] = Math.random() < 0.28 ? 'wall' : 'unvisited';
  if (!cmpStartPos) cmpStartPos = { r: Math.floor(cmpRows/2), c: 2 };
  if (!cmpGoalPos)  cmpGoalPos  = { r: Math.floor(cmpRows/2), c: cmpCols - 3 };
  cmpGrid[cmpStartPos.r][cmpStartPos.c] = 'start';
  cmpGrid[cmpGoalPos.r][cmpGoalPos.c]   = 'goal';
  const clearAround = pos => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = pos.r + dr, nc = pos.c + dc;
      if (nr >= 0 && nr < cmpRows && nc >= 0 && nc < cmpCols && cmpGrid[nr][nc] === 'wall')
        cmpGrid[nr][nc] = 'unvisited';
    }
  };
  clearAround(cmpStartPos); clearAround(cmpGoalPos);
  renderCompareGrids();
  consoleLog('system', 'Maze komparasi dibuat');
}

function clearCompareGrid() {
  if (cmpState.A.running || cmpState.B.running) return;
  cmpGrid = Array.from({ length: cmpRows }, () => Array(cmpCols).fill('unvisited'));
  if (cmpStartPos) cmpGrid[cmpStartPos.r][cmpStartPos.c] = 'start';
  if (cmpGoalPos)  cmpGrid[cmpGoalPos.r][cmpGoalPos.c]   = 'goal';
  resetCompareStats();
  renderCompareGrids();
  consoleLog('system', 'Grid komparasi dibersihkan');
}

// ----- Stats -----
function resetCompareStats() {
  ['A','B'].forEach(s => {
    cmpState[s].steps = 0; cmpState[s].visited = 0; cmpState[s].pathLen = 0;
    cmpState[s].queueLen = 0; cmpState[s].elapsed = 0;
    cmpState[s].done = false; cmpState[s].found = false;
  });
  ['Steps','Visited','Queue','Path','Time','Eff'].forEach(m => {
    const elA = document.getElementById(`score${m}A`);
    const elB = document.getElementById(`score${m}B`);
    if (elA) elA.textContent = (m === 'Path' || m === 'Eff') ? '-' : '0';
    if (elB) elB.textContent = (m === 'Path' || m === 'Eff') ? '-' : '0';
  });
  document.getElementById('progressBarA').style.width = '0%';
  document.getElementById('progressBarB').style.width = '0%';
  document.getElementById('scoreboardWinner').textContent = '';
  document.getElementById('compareBadgeA').innerHTML = '';
  document.getElementById('compareBadgeB').innerHTML = '';
  updateCmpStatus('A', 'ready');
  updateCmpStatus('B', 'ready');
  document.getElementById('gridSplitA').classList.remove('winner');
  document.getElementById('gridSplitB').classList.remove('winner');
  document.querySelectorAll('.scoreboard-val').forEach(el => el.classList.remove('winner-highlight'));
}

function updateCmpStatus(side, status) {
  const el = document.getElementById(`scoreStatus${side}`);
  if (!el) return;
  const map = {
    ready:   ['Siap',       'sbadge-ready'],
    running: ['Berjalan',   'sbadge-running'],
    paused:  ['Dijeda',     'sbadge-paused'],
    found:   ['Selesai ✓',  'sbadge-found'],
    failed:  ['Gagal ✗',    'sbadge-failed'],
    winner:  ['🏆 Juara!',  'sbadge-winner'],
  };
  const [text, cls] = map[status] || map.ready;
  el.innerHTML = `<span class="sbadge ${cls}">${text}</span>`;
}

// ----- Start / Run loop -----
function startCompare() {
  if (!cmpStartPos || !cmpGoalPos) { consoleLog('error', 'Start/Goal belum ada di grid komparasi!'); return; }
  onCompareAlgoChange();
  cmpFinishedCount = 0;
  cmpIsPaused = false;
  _cmpRafPending = false;
  resetCompareStats();

  cmpState.A.grid = cmpGrid.map(row => [...row]);
  cmpState.B.grid = cmpGrid.map(row => [...row]);

  ['A','B'].forEach(side => {
    const s = cmpState[side];
    s.running = true; s.done = false; s.found = false;
    s.steps = 0; s.visited = 0; s.pathLen = 0; s.queueLen = 0; s.elapsed = 0;
    s.startTime = performance.now();
    s.algoState = _initCmpAlgo(s.algo, cmpStartPos, cmpGoalPos);
    updateCmpStatus(side, 'running');
  });

  // Full initial render (builds DOM + prevGrid snapshot)
  _buildCmpGrid('A', 'gridContainerA');
  _buildCmpGrid('B', 'gridContainerB');

  document.getElementById('btnCompareStart').disabled = true;
  document.getElementById('btnComparePause').disabled = false;
  document.getElementById('btnCompareStop').disabled  = false;
  document.getElementById('compareAlgoA').disabled = true;
  document.getElementById('compareAlgoB').disabled = true;
  document.querySelectorAll('.cmp-size-btn').forEach(b => b.disabled = true);
  document.querySelectorAll('#compareToolbar button').forEach(b => b.disabled = true);

  consoleLog('system', `=== Komparasi: ${ALGO_INFO[cmpState.A.algo].title} vs ${ALGO_INFO[cmpState.B.algo].title} ===`);
  _scheduleCompare();
}

// Speed map: [steps per tick, delay ms]
//   Slow speeds → 1 step/tick, large delay (smooth animation)
//   Fast speeds → many steps/tick, fixed 16ms delay (no freeze)
const _CMP_SPEED = [
  [1,  400],  // 1 - Sangat Lambat
  [1,  150],  // 2 - Lambat
  [2,   60],  // 3 - Sedang
  [8,   16],  // 4 - Cepat
  [32,  16],  // 5 - Sangat Cepat
];

function _scheduleCompare() {
  if (cmpIsPaused) return;
  const v = parseInt(document.getElementById('compareSpeedSlider').value) || 3;
  const [stepsPerTick, delay] = _CMP_SPEED[v - 1];
  cmpState.A.timer = setTimeout(() => _tickCompare(stepsPerTick), delay);
}

function _tickCompare(stepsPerTick) {
  if (cmpIsPaused) return;

  let anyStillRunning = false;

  ['A','B'].forEach(side => {
    const s = cmpState[side];
    if (s.done || !s.running) return;
    anyStillRunning = true;

    for (let i = 0; i < stepsPerTick; i++) {
      if (s.done) break;
      const done = _stepCmp(side);
      if (done) {
        s.running = false; s.done = true;
        s.elapsed = performance.now() - s.startTime;
        cmpFinishedCount++;
        if (cmpFinishedCount === 1) _declareLeader();
        break;
      }
    }
    if (!s.done) s.elapsed = performance.now() - s.startTime;
  });

  // Render only changed cells (dirty patch) — single RAF to avoid layout thrashing
  if (!_cmpRafPending) {
    _cmpRafPending = true;
    requestAnimationFrame(() => {
      _patchCmpGrid('A');
      _patchCmpGrid('B');
      _updateCmpScoreboard('A');
      _updateCmpScoreboard('B');
      _cmpRafPending = false;
    });
  }

  if (cmpState.A.done && cmpState.B.done) {
    _finishCompare();
    return;
  }
  if (anyStillRunning || (!cmpState.A.done || !cmpState.B.done)) {
    _scheduleCompare();
  }
}

// ----- Step engine -----
function _stepCmp(side) {
  const s       = cmpState[side];
  const algo    = s.algo;
  const gR      = s.grid;          // the side's private grid array
  const as      = s.algoState;
  const goalP   = cmpGoalPos;
  const rows    = cmpRows, cols = cmpCols;
  s.steps++;

  const key = (r, c) => r * 1000 + c; // integer key — much faster than string concat

  const getN = (r, c) => {
    const out = [];
    if (r > 0        && gR[r-1][c] !== 'wall') out.push({r: r-1, c});
    if (r < rows - 1 && gR[r+1][c] !== 'wall') out.push({r: r+1, c});
    if (c > 0        && gR[r][c-1] !== 'wall') out.push({r, c: c-1});
    if (c < cols - 1 && gR[r][c+1] !== 'wall') out.push({r, c: c+1});
    return out;
  };

  const mC = (r, c) => { if (gR[r][c] !== 'start' && gR[r][c] !== 'goal') gR[r][c] = 'current'; };
  const mV = (r, c) => { s.visited++; if (gR[r][c] !== 'start' && gR[r][c] !== 'goal') gR[r][c] = 'visited'; };
  const mQ = (r, c) => { if (gR[r][c] !== 'start' && gR[r][c] !== 'goal' && gR[r][c] !== 'visited') gR[r][c] = 'queued'; };

  const heur = (r, c) => Math.abs(r - goalP.r) + Math.abs(c - goalP.c);

  const foundGoalFn = (parent, gr, gc) => {
    const path = [];
    let cur = key(gr, gc);
    while (cur !== undefined && cur !== null) {
      path.unshift(cur);
      cur = parent.get(cur);
      if (cur === -1) break; // sentinel for start
    }
    path.forEach(k => {
      const pr = Math.floor(k / 1000), pc = k % 1000;
      if (gR[pr][pc] !== 'start' && gR[pr][pc] !== 'goal') gR[pr][pc] = 'path';
    });
    s.pathLen = path.length;
    s.found = true;
    return true;
  };

  const noPFn = () => { s.found = false; return true; };

  // Use integer-keyed Map instead of string Set for visited — much faster
  switch (algo) {

    case 'bfs': {
      if (!as.queue.length) return noPFn();
      const { r, c } = as.queue.shift();
      mC(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
      mV(r, c);
      getN(r, c).forEach(n => {
        const k = key(n.r, n.c);
        if (!as.vis.has(k)) { as.vis.add(k); as.parent.set(k, key(r, c)); as.queue.push(n); mQ(n.r, n.c); }
      });
      s.queueLen = as.queue.length;
      break;
    }

    case 'dfs': case 'backtracking': {
      while (as.stack.length) {
        const { r, c } = as.stack.pop();
        const k = key(r, c);
        if (as.vis.has(k)) continue;
        as.vis.add(k); mC(r, c); mV(r, c);
        if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
        getN(r, c).reverse().forEach(n => {
          const nk = key(n.r, n.c);
          if (!as.vis.has(nk)) { as.parent.set(nk, key(r, c)); as.stack.push(n); mQ(n.r, n.c); }
        });
        s.queueLen = as.stack.length;
        return false;
      }
      return noPFn();
    }

    case 'ucs': {
      if (!as.pq.length) return noPFn();
      as.pq.sort((a, b) => a.cost - b.cost);
      const { r, c, cost } = as.pq.shift();
      const k = key(r, c);
      if (as.vis.has(k)) return false;
      as.vis.add(k); mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
      getN(r, c).forEach(n => {
        const nk = key(n.r, n.c);
        const nc = cost + 1;
        if (!as.costMap.has(nk) || nc < as.costMap.get(nk)) {
          as.costMap.set(nk, nc); as.parent.set(nk, key(r, c));
          as.pq.push({ ...n, cost: nc }); mQ(n.r, n.c);
        }
      });
      s.queueLen = as.pq.length;
      break;
    }

    case 'greedy': {
      if (!as.pq.length) return noPFn();
      as.pq.sort((a, b) => a.h - b.h);
      const cur = as.pq.shift();
      const { r, c } = cur;
      const k = key(r, c);
      if (as.vis.has(k)) return false;
      as.vis.add(k); mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
      getN(r, c).forEach(n => {
        const nk = key(n.r, n.c);
        if (!as.vis.has(nk)) {
          as.parent.set(nk, key(r, c));
          as.pq.push({ ...n, h: heur(n.r, n.c) });
          mQ(n.r, n.c);
        }
      });
      s.queueLen = as.pq.length;
      break;
    }

    case 'garislintang': {
      if (!as.pq.length) return noPFn();
      as.pq.sort((a, b) => a.f - b.f);
      const cur = as.pq.shift();
      const { r, c } = cur;
      const k = key(r, c);
      if (as.vis.has(k)) return false;
      as.vis.add(k); mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
      
      getN(r, c).forEach(n => {
        const nk = key(n.r, n.c);
        if (!as.vis.has(nk)) {
          as.parent.set(nk, key(r, c));
          const D_goal = heur(n.r, n.c);
          
          const sr = cmpStartPos.r, sc = cmpStartPos.c;
          const gr = goalP.r, gc = goalP.c;
          let crossTrack = 0;
          if (sr !== gr || sc !== gc) {
            const num = Math.abs((gr - sr) * (sc - n.c) - (sr - n.r) * (gc - sc));
            const den = Math.sqrt(Math.pow(gr - sr, 2) + Math.pow(gc - sc, 2));
            crossTrack = num / (den || 1);
          }
          const f = D_goal + 2.0 * crossTrack;
          as.pq.push({ ...n, f });
          mQ(n.r, n.c);
        }
      });
      s.queueLen = as.pq.length;
      break;
    }

    case 'astar': case 'weighted_astar': {
      if (!as.pq.length) return noPFn();
      as.pq.sort((a, b) => a.f - b.f);
      const cur = as.pq.shift();
      const { r, c, g: gv = 0 } = cur;
      const k = key(r, c);
      if (as.vis.has(k)) return false;
      as.vis.add(k); mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
      const weight = algo === 'weighted_astar' ? 2.0 : 1.0;
      getN(r, c).forEach(n => {
        const nk = key(n.r, n.c);
        const ng = gv + 1;
        const existing = as.gScore.get(nk);
        if (existing === undefined || ng < existing) {
          as.gScore.set(nk, ng);
          as.parent.set(nk, key(r, c));
          as.pq.push({ ...n, g: ng, f: ng + weight * heur(n.r, n.c) });
          mQ(n.r, n.c);
        }
      });
      s.queueLen = as.pq.length;
      break;
    }

    case 'dls': {
      while (as.stack.length) {
        const { r, c, depth } = as.stack.pop();
        const k = key(r, c);
        if (as.vis.has(k)) continue;
        as.vis.add(k); mC(r, c); mV(r, c);
        if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
        if (depth < as.depthLimit) {
          getN(r, c).reverse().forEach(n => {
            const nk = key(n.r, n.c);
            if (!as.vis.has(nk)) { as.parent.set(nk, key(r, c)); as.stack.push({ ...n, depth: depth + 1 }); mQ(n.r, n.c); }
          });
        }
        s.queueLen = as.stack.length;
        return false;
      }
      return noPFn();
    }

    case 'ids': {
      if (!as.stack.length) {
        as.maxDepth++;
        as.stack = [{ r: cmpStartPos.r, c: cmpStartPos.c, depth: 0 }];
        as.iterVisited = new Set();
        as.actualPath = [];
        if (as.maxDepth > rows * cols) return noPFn();
        return false;
      }
      const cur = as.stack.pop();
      if (cur.isBacktrack) {
        as.iterVisited.delete(key(cur.r, cur.c));
        as.actualPath.pop();
        return false;
      }
      const { r, c, depth } = cur;
      const k = key(r, c);
      if (as.iterVisited.has(k)) return false;
      as.iterVisited.add(k);
      as.actualPath.push(k);
      as.stack.push({ isBacktrack: true, r, c });
      mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) {
        const parentMap = new Map();
        for (let i = 1; i < as.actualPath.length; i++) parentMap.set(as.actualPath[i], as.actualPath[i-1]);
        parentMap.set(as.actualPath[0], -1);
        return foundGoalFn(parentMap, r, c);
      }
      if (depth < as.maxDepth) {
        getN(r, c).reverse().forEach(n => {
          const nk = key(n.r, n.c);
          if (!as.iterVisited.has(nk)) { as.stack.push({ ...n, depth: depth + 1 }); mQ(n.r, n.c); }
        });
      }
      s.queueLen = as.stack.filter(x => !x.isBacktrack).length;
      return false;
    }

    case 'idastar': {
      if (!as.stack.length) {
        if (as.nextThreshold === Infinity) return noPFn();
        as.threshold = as.nextThreshold;
        as.nextThreshold = Infinity;
        as.stack = [{ r: cmpStartPos.r, c: cmpStartPos.c, g: 0 }];
        as.iterVisited = new Set();
        as.actualPath = [];
        return false;
      }
      const cur = as.stack.pop();
      if (cur.isBacktrack) {
        as.iterVisited.delete(key(cur.r, cur.c));
        as.actualPath.pop();
        return false;
      }
      const { r, c, g: gv } = cur;
      const k = key(r, c);
      const f = gv + heur(r, c);
      if (f > as.threshold) { as.nextThreshold = Math.min(as.nextThreshold, f); return false; }
      if (as.iterVisited.has(k)) return false;
      as.iterVisited.add(k);
      as.actualPath.push(k);
      as.stack.push({ isBacktrack: true, r, c });
      mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) {
        const parentMap = new Map();
        for (let i = 1; i < as.actualPath.length; i++) parentMap.set(as.actualPath[i], as.actualPath[i-1]);
        parentMap.set(as.actualPath[0], -1);
        return foundGoalFn(parentMap, r, c);
      }
      getN(r, c).reverse().forEach(n => {
        const nk = key(n.r, n.c);
        if (!as.iterVisited.has(nk)) { as.stack.push({ ...n, g: gv + 1 }); mQ(n.r, n.c); }
      });
      s.queueLen = as.stack.filter(x => !x.isBacktrack).length;
      return false;
    }

    case 'beam': {
      if (!as.beam.length) return noPFn();
      const beamWidth = 2;
      const nextGen = [];
      let found = null;
      for (const cur of as.beam) {
        const { r, c } = cur;
        const k = key(r, c);
        mC(r, c); mV(r, c);
        if (r === goalP.r && c === goalP.c) { found = cur; break; }
        getN(r, c).forEach(n => {
          const nk = key(n.r, n.c);
          if (!as.vis.has(nk)) {
            as.vis.add(nk); as.parent.set(nk, k); mQ(n.r, n.c);
            nextGen.push({ ...n, h: heur(n.r, n.c) });
          }
        });
      }
      if (found) return foundGoalFn(as.parent, found.r, found.c);
      nextGen.sort((a, b) => a.h - b.h);
      as.beam = nextGen.slice(0, beamWidth);
      s.queueLen = as.beam.length;
      return false;
    }

    case 'hillclimbing': case 'steepest': {
      const { r, c } = as.current;
      mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
      const nbrs = getN(r, c);
      if (!nbrs.length) return noPFn();
      const curH = heur(r, c);
      let next = null;
      if (algo === 'steepest') {
        let bestH = curH;
        for (const n of nbrs) {
          const h = heur(n.r, n.c);
          if (h < bestH) { bestH = h; next = n; }
        }
      } else {
        for (const n of nbrs) {
          if (heur(n.r, n.c) < curH) { next = n; break; }
        }
      }
      if (!next) return noPFn();
      as.parent.set(key(next.r, next.c), key(r, c));
      as.current = next;
      mQ(next.r, next.c);
      return false;
    }

    case 'simulated_annealing': {
      const { r, c } = as.current;
      mC(r, c); mV(r, c);
      as.temp *= as.cooling;
      if (as.temp < 0.001) return noPFn();
      if (r === goalP.r && c === goalP.c) {
        const pMap = new Map();
        for(let i=1; i<as.actualPath.length; i++) pMap.set(as.actualPath[i], as.actualPath[i-1]);
        pMap.set(as.actualPath[0], -1);
        return foundGoalFn(pMap, r, c);
      }
      const nbrs = getN(r, c);
      if (!nbrs.length) return noPFn();
      const next = nbrs[Math.floor(Math.random() * nbrs.length)];
      const dE = heur(r, c) - heur(next.r, next.c);
      const accept = dE > 0 || Math.random() < Math.exp(dE / (as.temp * 0.1));
      if (accept) {
        as.actualPath.push(key(next.r, next.c));
        as.current = next;
        mQ(next.r, next.c);
      }
      return false;
    }

    case 'tabu': {
      const { r, c } = as.current;
      mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) {
        const pMap = new Map();
        for(let i=1; i<as.actualPath.length; i++) pMap.set(as.actualPath[i], as.actualPath[i-1]);
        pMap.set(as.actualPath[0], -1);
        return foundGoalFn(pMap, r, c);
      }
      const nbrs = getN(r, c).filter(n => !as.tabuList.includes(key(n.r, n.c)));
      if (!nbrs.length) return noPFn();
      nbrs.sort((a, b) => heur(a.r, a.c) - heur(b.r, b.c));
      const best = nbrs[0];
      const bk = key(best.r, best.c);
      as.actualPath.push(bk);
      as.tabuList.push(bk);
      if (as.tabuList.length > as.tabuMax) as.tabuList.shift();
      as.current = best;
      mQ(best.r, best.c);
      return false;
    }

    case 'bidirectional': {
      // Helper to reconstruct path on meeting
      const biMeetPath = (meetKey) => {
        // path from start → meeting point (via parentF)
        const toMeet = [];
        let cf = meetKey;
        while (cf !== null && cf !== undefined) {
          toMeet.unshift(cf);
          cf = as.parentF.get(cf) ?? null;
          if (cf === -1 || cf === undefined) break;
        }
        // path from meeting → goal (via parentB, reversed)
        const fromMeet = [];
        let cb = as.parentB.get(meetKey);
        while (cb !== null && cb !== undefined) {
          fromMeet.push(cb);
          cb = as.parentB.get(cb) ?? null;
          if (cb === -1 || cb === undefined) break;
        }
        return [...toMeet, ...fromMeet];
      };

      if (as.dirF) {
        if (!as.queueF.length) { as.dirF = false; return false; }
        const { r, c } = as.queueF.shift();
        const k = key(r, c);
        mC(r, c); mV(r, c);
        if (as.visB.has(k)) {
          const path = biMeetPath(k);
          // Build parent map from path for foundGoalFn
          const pMap = new Map();
          path.forEach((node, i) => { if (i > 0) pMap.set(node, path[i-1]); });
          pMap.set(key(cmpStartPos.r, cmpStartPos.c), -1);
          return foundGoalFn(pMap, goalP.r, goalP.c);
        }
        getN(r, c).forEach(n => {
          const nk = key(n.r, n.c);
          if (!as.visF.has(nk)) { as.visF.add(nk); as.parentF.set(nk, k); as.queueF.push(n); mQ(n.r, n.c); }
        });
        as.dirF = false;
      } else {
        if (!as.queueB.length) { as.dirF = true; return false; }
        const { r, c } = as.queueB.shift();
        const k = key(r, c);
        mC(r, c); mV(r, c);
        if (as.visF.has(k)) {
          const path = biMeetPath(k);
          const pMap = new Map();
          path.forEach((node, i) => { if (i > 0) pMap.set(node, path[i-1]); });
          pMap.set(key(cmpStartPos.r, cmpStartPos.c), -1);
          return foundGoalFn(pMap, goalP.r, goalP.c);
        }
        getN(r, c).forEach(n => {
          const nk = key(n.r, n.c);
          if (!as.visB.has(nk)) { as.visB.add(nk); as.parentB.set(nk, k); as.queueB.push(n); mQ(n.r, n.c); }
        });
        as.dirF = true;
      }
      return false;
    }

    case 'jps': {
      if (!as.pq.length) return noPFn();
      as.pq.sort((a, b) => a.f - b.f);
      const cur = as.pq.shift();
      const { r, c } = cur;
      const k = key(r, c);
      if (as.vis.has(k)) return false;
      as.vis.add(k); mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);

      const jump = (startR, startC, dr, dc) => {
        let cr = startR, cc = startC;
        while(true) {
          let nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || gR[nr][nc] === 'wall') return null;
          if (nr === goalP.r && nc === goalP.c) return { r: nr, c: nc };
          if (dr !== 0) {
            if ((nc + 1 < cols && gR[cr][nc + 1] === 'wall' && gR[nr][nc + 1] !== 'wall') ||
                (nc - 1 >= 0 && gR[cr][nc - 1] === 'wall' && gR[nr][nc - 1] !== 'wall')) return { r: nr, c: nc };
          } else {
            if ((nr + 1 < rows && gR[nr + 1][cc] === 'wall' && gR[nr + 1][nc] !== 'wall') ||
                (nr - 1 >= 0 && gR[nr - 1][cc] === 'wall' && gR[nr - 1][nc] !== 'wall')) return { r: nr, c: nc };
          }
          cr = nr; cc = nc;
        }
      };

      const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
      dirs.forEach(([dr, dc]) => {
        const jp = jump(r, c, dr, dc);
        if (jp) {
          const jpk = key(jp.r, jp.c);
          const ng = cur.g + Math.abs(jp.r - r) + Math.abs(jp.c - c);
          const existing = as.gScore.get(jpk);
          if (existing === undefined || ng < existing) {
            as.gScore.set(jpk, ng);
            as.parent.set(jpk, k);
            as.pq.push({ ...jp, g: ng, f: ng + heur(jp.r, jp.c) });
            mQ(jp.r, jp.c);
          }
        }
      });
      s.queueLen = as.pq.length;
      break;
    }

    case 'genetic': {
      if (as.generation > 100) return noPFn();
      const pop = as.population;
      pop.sort((a, b) => a.fitness - b.fitness);
      const best = pop[0];
      const last = best.path[best.path.length - 1];
      mC(last.r, last.c);
      if (last.r === goalP.r && last.c === goalP.c) {
        const pMap = new Map();
        for(let i=1; i<best.path.length; i++) pMap.set(key(best.path[i].r, best.path[i].c), key(best.path[i-1].r, best.path[i-1].c));
        pMap.set(key(best.path[0].r, best.path[0].c), -1);
        return foundGoalFn(pMap, last.r, last.c);
      }
      const nextGen = [];
      const parentCount = Math.max(2, Math.floor(pop.length * 0.2));
      for (let i = 0; i < pop.length; i++) {
        const p1 = pop[Math.floor(Math.random() * parentCount)];
        const p2 = pop[Math.floor(Math.random() * parentCount)];
        const intersect = p1.path.filter(n1 => p2.path.some(n2 => n1.r === n2.r && n1.c === n2.c));
        const pt = intersect.length > 1 ? intersect[Math.floor(Math.random() * intersect.length)] : p1.path[Math.floor(p1.path.length / 2)];
        const idx1 = p1.path.findIndex(n => n.r === pt.r && n.c === pt.c);
        let childPath = p1.path.slice(0, idx1 + 1);
        
        let cur = childPath[childPath.length - 1];
        const vis = new Set(childPath.map(n => key(n.r, n.c)));
        for (let j = 0; j < 40; j++) {
          const nbrs = getN(cur.r, cur.c).filter(n => !vis.has(key(n.r, n.c)));
          if (!nbrs.length) break;
          const n = nbrs[Math.floor(Math.random() * nbrs.length)];
          childPath.push(n); cur = n;
          vis.add(key(n.r, n.c));
          if (cur.r === goalP.r && cur.c === goalP.c) break;
        }
        nextGen.push({ path: childPath, fitness: childPath.length + heur(cur.r, cur.c) * 5 });
      }
      as.population = nextGen;
      as.generation++;
      s.visited += pop.length * 20; 
      return false;
    }

    case 'minimax': case 'alphabeta': {
      const { r, c } = as.current;
      mC(r, c); mV(r, c);
      if (r === goalP.r && c === goalP.c) return foundGoalFn(as.parent, r, c);
      
      const evaluate = (nr, nc, depth, isMax, pathVis, alpha, beta) => {
        if (depth === 0 || (nr === goalP.r && nc === goalP.c)) return -heur(nr, nc);
        const nbrs = getN(nr, nc).filter(n => !as.vis.has(key(n.r, n.c)) && !pathVis.has(key(n.r, n.c)));
        if (!nbrs.length) return -heur(nr, nc);
        
        if (isMax) {
          let maxEv = -Infinity;
          for (const n of nbrs) {
            pathVis.add(key(n.r, n.c));
            const ev = evaluate(n.r, n.c, depth - 1, false, pathVis, alpha, beta);
            pathVis.delete(key(n.r, n.c));
            maxEv = Math.max(maxEv, ev);
            if (algo === 'alphabeta') { alpha = Math.max(alpha, ev); if (beta <= alpha) break; }
          }
          return maxEv;
        } else {
          let minEv = Infinity;
          for (const n of nbrs) {
            pathVis.add(key(n.r, n.c));
            const ev = evaluate(n.r, n.c, depth - 1, true, pathVis, alpha, beta);
            pathVis.delete(key(n.r, n.c));
            minEv = Math.min(minEv, ev);
            if (algo === 'alphabeta') { beta = Math.min(beta, ev); if (beta <= alpha) break; }
          }
          return minEv;
        }
      };
      
      const nbrs = getN(r, c).filter(n => !as.vis.has(key(n.r, n.c)));
      if (!nbrs.length) return noPFn();
      let bestVal = -Infinity;
      let bestNext = null;
      nbrs.forEach(n => {
        const pVis = new Set([key(n.r, n.c)]);
        const val = evaluate(n.r, n.c, as.depth - 1, false, pVis, -Infinity, Infinity);
        mQ(n.r, n.c);
        if (val > bestVal) { bestVal = val; bestNext = n; }
      });
      if (!bestNext) return noPFn();
      as.parent.set(key(bestNext.r, bestNext.c), key(r, c));
      as.current = bestNext;
      return false;
    }

    case 'mcts': {
      if (as.maxIterations-- <= 0) return noPFn();
      const select = (node) => {
        let n = node;
        while (n.children.length > 0) {
          let best = null, bestUcb = -Infinity;
          n.children.forEach(c => {
            if (c.visits === 0) { best = c; bestUcb = Infinity; return; }
            const ucb = (c.wins / c.visits) + Math.sqrt(2 * Math.log(n.visits) / c.visits);
            if (ucb > bestUcb) { bestUcb = ucb; best = c; }
          });
          n = best || n.children[0];
        }
        return n;
      };
      const node = select(as.root);
      mC(node.r, node.c); mV(node.r, node.c);
      if (node.r === goalP.r && node.c === goalP.c) {
        const pMap = new Map();
        let cur = node;
        while(cur.parentNode) { pMap.set(key(cur.r, cur.c), key(cur.parentNode.r, cur.parentNode.c)); cur = cur.parentNode; }
        pMap.set(key(cmpStartPos.r, cmpStartPos.c), -1);
        return foundGoalFn(pMap, goalP.r, goalP.c);
      }
      if (node.visits > 0 || (node.r === cmpStartPos.r && node.c === cmpStartPos.c)) {
        let anc = node;
        const pathSet = new Set();
        while(anc) { pathSet.add(key(anc.r, anc.c)); anc = anc.parentNode; }
        const nbrs = getN(node.r, node.c).filter(n => !pathSet.has(key(n.r, n.c)));
        node.children = nbrs.map(n => ({ r: n.r, c: n.c, parentNode: node, children: [], visits: 0, wins: 0 }));
      }
      
      let simR = node.r, simC = node.c;
      const simVis = new Set([key(simR, simC)]);
      for (let step = 0; step < 40; step++) {
        if (simR === goalP.r && simC === goalP.c) break;
        const nbrs = getN(simR, simC).filter(n => !simVis.has(key(n.r, n.c)));
        if (!nbrs.length) break;
        const next = nbrs[Math.floor(Math.random() * nbrs.length)];
        simR = next.r; simC = next.c;
        simVis.add(key(simR, simC));
      }
      const dist = heur(simR, simC);
      const score = dist === 0 ? 1 : 1 / (1 + dist);
      
      let anc = node;
      while (anc) { anc.visits++; anc.wins += score; anc = anc.parentNode; }
      return false;
    }

    case 'ants': {
      if (as.totalIterations >= 1000 || as.iteration >= 200) {
        if (as.bestPath) {
          const pMap = new Map();
          for(let i=1; i<as.bestPath.length; i++) pMap.set(key(as.bestPath[i].r, as.bestPath[i].c), key(as.bestPath[i-1].r, as.bestPath[i-1].c));
          pMap.set(key(as.bestPath[0].r, as.bestPath[0].c), -1);
          const last = as.bestPath[as.bestPath.length-1];
          return foundGoalFn(pMap, last.r, last.c);
        }
        return noPFn();
      }
      let allDone = true;
      let ants = as.ants || Array(10).fill().map(() => ({ path: [{r: cmpStartPos.r, c: cmpStartPos.c}], vis: new Set([key(cmpStartPos.r, cmpStartPos.c)]), done: false, win: false }));
      
      ants.forEach(ant => {
        if (ant.done) return;
        allDone = false;
        const cur = ant.path[ant.path.length - 1];
        mC(cur.r, cur.c); mV(cur.r, cur.c);
        if (cur.r === goalP.r && cur.c === goalP.c) { ant.done = true; ant.win = true; return; }
        const nbrs = getN(cur.r, cur.c).filter(n => !ant.vis.has(key(n.r, n.c)));
        if (!nbrs.length) { ant.done = true; return; }
        
        let probs = [];
        let sum = 0;
        nbrs.forEach(n => {
          const k = key(cur.r, cur.c) + '-' + key(n.r, n.c);
          const tau = as.pheromone.has(k) ? as.pheromone.get(k) : 1;
          const eta = 1 / (1 + heur(n.r, n.c));
          const p = Math.pow(tau, 1) * Math.pow(eta, 2);
          probs.push({ n, p });
          sum += p;
        });
        let rnd = Math.random() * sum;
        let next = nbrs[0];
        for (const prob of probs) { rnd -= prob.p; if (rnd <= 0) { next = prob.n; break; } }
        
        ant.path.push(next);
        ant.vis.add(key(next.r, next.c));
      });
      as.ants = ants;
      if (allDone) {
        as.ants.forEach(ant => {
          const len = ant.path.length;
          const end = ant.path[len - 1];
          const dist = heur(end.r, end.c);
          if (dist < as.bestDist) { as.bestDist = dist; as.bestPath = ant.path; }
          const deposit = ant.win ? (100 / len) : (1 / (dist + 1));
          for (let i = 0; i < len - 1; i++) {
            const k = key(ant.path[i].r, ant.path[i].c) + '-' + key(ant.path[i+1].r, ant.path[i+1].c);
            as.pheromone.set(k, (as.pheromone.get(k) || 1) + deposit);
          }
        });
        as.pheromone.forEach((v, k) => as.pheromone.set(k, v * 0.9));
        as.iteration++;
        as.ants = null;
      }
      as.totalIterations++;
      return false;
    }
  }
  return false;
}

function _initCmpAlgo(algo, s, g) {
  const key = (r, c) => r * 1000 + c;
  const as = {
    vis:     new Set(),
    parent:  new Map(),   // int key → int parent key (-1 = start sentinel)
    gScore:  new Map(),
    costMap: new Map(),
    queue: [], pq: [], stack: []
  };
  as.parent.set(key(s.r, s.c), -1);

  const heur = (r, c) => Math.abs(r - g.r) + Math.abs(c - g.c);
  switch (algo) {
    case 'bfs':
      as.queue.push({ r: s.r, c: s.c });
      as.vis.add(key(s.r, s.c));
      break;
    case 'dfs':
      as.stack.push({ r: s.r, c: s.c });
      break;
    case 'dls':
      as.depthLimit = parseInt(document.getElementById('depthLimitSel').value) || 10;
      as.stack.push({ r: s.r, c: s.c, depth: 0 });
      break;
    case 'ids':
      as.maxDepth = 0;
      as.stack = [{ r: s.r, c: s.c, depth: 0 }];
      as.iterVisited = new Set();
      as.actualPath = [];
      break;
    case 'idastar':
      as.threshold = heur(s.r, s.c);
      as.stack = [{ r: s.r, c: s.c, g: 0 }];
      as.nextThreshold = Infinity;
      as.iterVisited = new Set();
      as.actualPath = [];
      break;
    case 'beam':
      as.beam = [{ r: s.r, c: s.c, h: heur(s.r, s.c) }];
      break;
    case 'hillclimbing': case 'steepest':
      as.current = { r: s.r, c: s.c };
      as.vis.add(key(s.r, s.c));
      break;
    case 'simulated_annealing':
      as.current = { r: s.r, c: s.c };
      as.temp = 200; as.cooling = 0.995;
      as.vis.add(key(s.r, s.c));
      as.bestDist = heur(s.r, s.c);
      as.bestPos = { r: s.r, c: s.c };
      as.actualPath = [key(s.r, s.c)];
      break;
    case 'tabu':
      as.current = { r: s.r, c: s.c };
      as.tabuList = [key(s.r, s.c)]; as.tabuMax = 15;
      as.actualPath = [key(s.r, s.c)];
      break;
    case 'genetic':
      as.population = generatePopulation(s, g, 20); // Note: we can reuse this since it uses start/goal pos natively
      as.generation = 0;
      break;
    case 'minimax': case 'alphabeta':
      as.current = { r: s.r, c: s.c };
      as.depth = 3;
      as.vis.add(key(s.r, s.c));
      break;
    case 'mcts':
      as.root = { r: s.r, c: s.c, parentNode: null, children: [], visits: 0, wins: 0 };
      as.maxIterations = 300;
      break;
    case 'backtracking':
      as.stack = [{ r: s.r, c: s.c }];
      break;
    case 'ants':
      as.pheromone = new Map();
      as.totalIterations = 0; as.iteration = 0;
      as.bestPath = null; as.bestDist = Infinity;
      break;
    case 'bidirectional':
      as.queueF = [{ r: s.r, c: s.c }];
      as.queueB = [{ r: g.r, c: g.c }];
      as.visF = new Set([key(s.r, s.c)]);
      as.visB = new Set([key(g.r, g.c)]);
      as.parentF = new Map();
      as.parentB = new Map();
      as.parentF.set(key(s.r, s.c), null);
      as.parentB.set(key(g.r, g.c), null);
      as.dirF = true;
      break;
    case 'ucs':
      as.pq.push({ r: s.r, c: s.c, cost: 0 });
      as.costMap.set(key(s.r, s.c), 0);
      break;
    case 'greedy':
      as.pq.push({ r: s.r, c: s.c, h: heur(s.r, s.c) });
      break;
    case 'garislintang':
      as.pq.push({ r: s.r, c: s.c, f: heur(s.r, s.c) });
      break;
    default: // astar, weighted_astar, jps
      as.pq.push({ r: s.r, c: s.c, g: 0, f: heur(s.r, s.c) });
      as.gScore.set(key(s.r, s.c), 0);
      break;
  }
  return as;
}

// ----- Scoreboard (called inside RAF — safe to write DOM) -----
function _updateCmpScoreboard(side) {
  const s = cmpState[side];
  const get = id => document.getElementById(id);
  get(`scoreSteps${side}`).textContent   = s.steps;
  get(`scoreVisited${side}`).textContent = s.visited;
  get(`scoreQueue${side}`).textContent   = s.queueLen;
  get(`scorePath${side}`).textContent    = s.pathLen || '-';
  get(`scoreTime${side}`).textContent    = Math.round(s.elapsed);
  const eff = (s.visited > 0 && s.pathLen > 0)
    ? (s.pathLen / s.visited * 100).toFixed(1) + '%' : '-';
  get(`scoreEff${side}`).textContent = eff;
  const maxExp = cmpRows * cmpCols * 0.7;
  get(`progressBar${side}`).style.width = Math.min(100, s.visited / maxExp * 100) + '%';
}

// ----- Winner logic -----
function _declareLeader() {
  const A = cmpState.A, B = cmpState.B;
  if (A.done && !B.done && A.found) { _markLeader('A'); }
  else if (B.done && !A.done && B.found) { _markLeader('B'); }
}

function _markLeader(side) {
  updateCmpStatus(side, 'winner');
  const other = side === 'A' ? 'B' : 'A';
  updateCmpStatus(other, cmpState[other].running ? 'running' : 'found');
  const algoName = ALGO_INFO[cmpState[side].algo]?.title || cmpState[side].algo;
  const color    = side === 'A' ? 'var(--accent)' : 'var(--accent2)';
  document.getElementById('scoreboardWinner').innerHTML =
    `<span style="color:${color}">▲ ${algoName}</span> 🏆 Pertama Selesai!`;
  document.getElementById(`compareBadge${side}`).innerHTML =
    `<span class="sbadge sbadge-winner" style="font-size:9px">🏆 Juara</span>`;
  document.getElementById('gridSplitA').classList.toggle('winner', side === 'A');
  document.getElementById('gridSplitB').classList.toggle('winner', side === 'B');
}

function _finishCompare() {
  clearTimeout(cmpState.A.timer);
  cmpState.A.running = cmpState.B.running = false;
  cmpIsPaused = false;

  const A = cmpState.A, B = cmpState.B;

  // Final status
  const statusFor = (s, other) => {
    if (!s.found) return 'failed';
    if (!other.found || s.pathLen < other.pathLen) return 'winner';
    if (s.pathLen === other.pathLen) return 'found';
    return 'found';
  };
  updateCmpStatus('A', statusFor(A, B));
  updateCmpStatus('B', statusFor(B, A));

  // Highlight winning metrics
  [['Steps','scoreStepsA','scoreStepsB'], ['Visited','scoreVisitedA','scoreVisitedB'],
   ['Path','scorePathA','scorePathB'],    ['Time','scoreTimeA','scoreTimeB']
  ].forEach(([, kA, kB]) => {
    const va = parseFloat(document.getElementById(kA).textContent) || Infinity;
    const vb = parseFloat(document.getElementById(kB).textContent) || Infinity;
    if (va < vb) document.getElementById(kA).classList.add('winner-highlight');
    else if (vb < va) document.getElementById(kB).classList.add('winner-highlight');
  });

  // Summary
  let summary = '';
  if (A.found && B.found) {
    if      (A.pathLen < B.pathLen) summary = `<span style="color:var(--accent)">▲ ${ALGO_INFO[A.algo]?.title}</span> unggul — path lebih pendek (${A.pathLen} vs ${B.pathLen})`;
    else if (B.pathLen < A.pathLen) summary = `<span style="color:var(--accent2)">▲ ${ALGO_INFO[B.algo]?.title}</span> unggul — path lebih pendek (${B.pathLen} vs ${A.pathLen})`;
    else                             summary = `⚖️ Seri! Panjang path sama (${A.pathLen} node)`;
  } else if (A.found) summary = `<span style="color:var(--accent)">▲ ${ALGO_INFO[A.algo]?.title}</span> menang — B gagal menemukan jalur`;
  else if (B.found)   summary = `<span style="color:var(--accent2)">▲ ${ALGO_INFO[B.algo]?.title}</span> menang — A gagal menemukan jalur`;
  else                summary = `❌ Kedua algoritma gagal menemukan jalur`;
  document.getElementById('scoreboardWinner').innerHTML = summary;

  // Re-enable controls
  document.getElementById('btnCompareStart').disabled = false;
  document.getElementById('btnComparePause').disabled = true;
  document.getElementById('btnCompareStop').disabled  = true;
  document.getElementById('compareAlgoA').disabled = false;
  document.getElementById('compareAlgoB').disabled = false;
  document.querySelectorAll('.cmp-size-btn').forEach(b => b.disabled = false);
  document.querySelectorAll('#compareToolbar button').forEach(b => b.disabled = false);

  _updateCmpScoreboard('A'); _updateCmpScoreboard('B');
  consoleLog('success', `Komparasi selesai! ${A.algo}: ${A.steps} steps | ${B.algo}: ${B.steps} steps`);
}

// ----- Pause / Stop -----
function pauseCompare() {
  cmpIsPaused = !cmpIsPaused;
  const btn = document.getElementById('btnComparePause');
  if (cmpIsPaused) {
    clearTimeout(cmpState.A.timer);
    btn.textContent = '▶ Lanjut';
    updateCmpStatus('A', cmpState.A.done ? (cmpState.A.found ? 'found' : 'failed') : 'paused');
    updateCmpStatus('B', cmpState.B.done ? (cmpState.B.found ? 'found' : 'failed') : 'paused');
    consoleLog('warn', 'Komparasi dijeda');
  } else {
    btn.textContent = '⏸ Jeda';
    if (!cmpState.A.done) updateCmpStatus('A', 'running');
    if (!cmpState.B.done) updateCmpStatus('B', 'running');
    consoleLog('info', 'Komparasi dilanjutkan');
    _scheduleCompare();
  }
}

function stopCompare() {
  clearTimeout(cmpState.A.timer);
  cmpIsPaused = false;
  cmpState.A.running = cmpState.B.running = false;
  document.getElementById('btnCompareStart').disabled = false;
  document.getElementById('btnComparePause').disabled = true;
  document.getElementById('btnComparePause').textContent = '⏸ Jeda';
  document.getElementById('btnCompareStop').disabled  = true;
  document.getElementById('compareAlgoA').disabled = false;
  document.getElementById('compareAlgoB').disabled = false;
  document.querySelectorAll('.cmp-size-btn').forEach(b => b.disabled = false);
  document.querySelectorAll('#compareToolbar button').forEach(b => b.disabled = false);
  updateCmpStatus('A', 'ready'); updateCmpStatus('B', 'ready');
  consoleLog('warn', 'Komparasi dihentikan');
}

function updateCompareSpeed(v) {
  const labels = ['Sangat Lambat', 'Lambat', 'Sedang', 'Cepat', 'Sangat Cepat'];
  document.getElementById('compareSpeedLabel').textContent = labels[v - 1];
}

function setCmpGridSize(r, c, btn) {
  if (cmpState.A.running || cmpState.B.running) return;
  document.querySelectorAll('.cmp-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cmpRows = r; cmpCols = c;
  cmpGrid = Array.from({ length: r }, () => Array(c).fill('unvisited'));
  cmpStartPos = { r: Math.floor(r / 2), c: 2 };
  cmpGoalPos  = { r: Math.floor(r / 2), c: c - 3 };
  cmpGrid[cmpStartPos.r][cmpStartPos.c] = 'start';
  cmpGrid[cmpGoalPos.r][cmpGoalPos.c]   = 'goal';
  resetCompareStats();
  renderCompareGrids();
  consoleLog('system', `Grid komparasi: ${r}×${c}`);
}

window.addEventListener('resize', () => {
  if (compareMode && cmpGrid.length) renderCompareGrids();
});

// ─── Theme-aware 3D color helper (override) ───────────────────────────
function get3DColorThemed(state) {
  const isLight = document.body.classList.contains('theme-light');
  const isWarm  = document.body.classList.contains('theme-warm');
  if (isLight) {
    const c = { unvisited:'#dde4ef', wall:'#6d28d9', start:'#16a34a', goal:'#7c3aed',
      visited:'#86efac', current:'#0284c7', queued:'#fbbf24', path:'#ea580c' };
    return c[state] || c.unvisited;
  }
  if (isWarm) {
    const c = { unvisited:'#2e2018', wall:'#7c2d12', start:'#22c55e', goal:'#f97316',
      visited:'#064e3b', current:'#fbbf24', queued:'#92400e', path:'#84cc16' };
    return c[state] || c.unvisited;
  }
  return get3DColor(state);
}
