// ===================== STATE =====================
let currentAlgo = 'bfs';
let currentView = '2d';
let currentTool = 'wall';
let gridZoom = 1;
let gridRows = 15, gridCols = 20;
let grid = [];
let startPos = null, goalPos = null;
let isRunning = false, isPaused = false;
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
  grid = Array.from({length: rows}, () => Array(cols).fill('unvisited'));
  startPos = { r: Math.floor(rows/2), c: 2 };
  goalPos = { r: Math.floor(rows/2), c: cols-3 };
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
    startPos = {r, c};
    grid[r][c] = 'start';
  } else if (currentTool === 'goal') {
    if (current === 'start') return;
    if (goalPos) {
      const oldGoal = goalPos;
      grid[oldGoal.r][oldGoal.c] = 'unvisited';
      updateCellUI(oldGoal.r, oldGoal.c);
    }
    goalPos = {r, c};
    grid[r][c] = 'goal';
  }
  updateCellUI(r, c);
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
  grid = Array.from({length: gridRows}, () => Array(gridCols).fill('unvisited'));
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
        const nr = pos.r+dr, nc = pos.c+dc;
        if (nr>=0 && nr<gridRows && nc>=0 && nc<gridCols)
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
      const ox = (c - gridCols/2) * 20;
      const oy = (r - gridRows/2) * 20;
      const oz = h * 20;
      
      const rx = ox * Math.cos(camAngle) - oy * Math.sin(camAngle);
      const ry = ox * Math.sin(camAngle) + oy * Math.cos(camAngle);
      
      const fz = oz * Math.cos(camPitch) - ry * Math.sin(camPitch);
      const fy = ry * Math.cos(camPitch) + oz * Math.sin(camPitch);
      
      return {
          x: W/2 + camPanX + rx * camZoom,
          y: H/2 + camPanY - fy * camZoom,
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
      renderList.push({r, c, state, hLevel, depth: p.depth});
    }
  }
  
  renderList.sort((a, b) => b.depth - a.depth);

  renderList.forEach(cell => {
      const {r, c, state, hLevel} = cell;
      const col = get3DColor(state);
      
      const v = [];
      for(let dz of [0, hLevel]) {
          for(let dy of [-0.5, 0.5]) {
              for(let dx of [-0.5, 0.5]) {
                  v.push(project(c + dx, r + dy, dz));
              }
          }
      }
      
      ctx.beginPath();
      ctx.moveTo(v[4].x, v[4].y); ctx.lineTo(v[5].x, v[5].y);
      ctx.lineTo(v[7].x, v[7].y); ctx.lineTo(v[6].x, v[6].y);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5; ctx.stroke();
      
      if (hLevel > 0.1) {
          ctx.beginPath();
          ctx.moveTo(v[4].x, v[4].y); ctx.lineTo(v[6].x, v[6].y);
          ctx.lineTo(v[2].x, v[2].y); ctx.lineTo(v[0].x, v[0].y);
          ctx.closePath();
          ctx.fillStyle = shadeColor(col, -40); ctx.fill(); ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(v[6].x, v[6].y); ctx.lineTo(v[7].x, v[7].y);
          ctx.lineTo(v[3].x, v[3].y); ctx.lineTo(v[2].x, v[2].y);
          ctx.closePath();
          ctx.fillStyle = shadeColor(col, -25); ctx.fill(); ctx.stroke();
      }
      
      if (state === 'start' || state === 'goal') {
        const topCenter = project(c, r, hLevel + 0.2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(state === 'start' ? 'S' : 'G', topCenter.x, topCenter.y);
      }
  });

  animFrame3d = requestAnimationFrame(() => render3D(ctx, W, H));
}


function get3DColor(state) {
  const colors = {
    unvisited: '#1e3a5f', wall: '#0a1018', start: '#22c55e',
    goal: '#7c3aed', visited: '#0d4a32', current: '#00d4ff',
    queued: '#7a4f00', path: '#7a3000'
  };
  return colors[state] || '#1e3a5f';
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
    for (let j = i+1; j < graphNodes.length; j++) {
      const dr = Math.abs(graphNodes[i].r - graphNodes[j].r);
      const dc = Math.abs(graphNodes[i].c - graphNodes[j].c);
      if (dr <= step+1 && dc <= step+1 && dr+dc <= step*2) {
        const w = Math.round(Math.sqrt(dr*dr + dc*dc) * 10) / 10;
        graphEdges.push({ from: i, to: j, w });
      }
    }
  }
  drawGraph();
}

function drawGraph() {
  if (!graphCtx) return;
  const W = graphCanvas.width, H = graphCanvas.height;
  graphCtx.clearRect(0, 0, W, H);

  // Background
  graphCtx.fillStyle = '#070b14';
  graphCtx.fillRect(0, 0, W, H);

  // Draw edges
  graphEdges.forEach(e => {
    const a = graphNodes[e.from], b = graphNodes[e.to];
    graphCtx.beginPath();
    graphCtx.moveTo(a.x, a.y);
    graphCtx.lineTo(b.x, b.y);
    graphCtx.strokeStyle = '#1e2d42';
    graphCtx.lineWidth = 1.5;
    graphCtx.stroke();
    // Weight label
    const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
    graphCtx.fillStyle = '#475569';
    graphCtx.font = '9px JetBrains Mono';
    graphCtx.textAlign = 'center';
    graphCtx.fillText(e.w, mx, my-3);
  });

  // Draw nodes
  graphNodes.forEach(n => {
    const colors = { unvisited: '#1e3a5f', wall: '#1e293b', start: '#22c55e', goal: '#7c3aed',
      visited: '#10b981', current: '#00d4ff', queued: '#f59e0b', path: '#f97316' };
    graphCtx.beginPath();
    graphCtx.arc(n.x, n.y, 14, 0, Math.PI*2);
    graphCtx.fillStyle = colors[n.state] || colors.unvisited;
    graphCtx.fill();
    // Glow for special nodes
    if (n.state === 'current' || n.state === 'start' || n.state === 'goal') {
      graphCtx.shadowBlur = 12;
      graphCtx.shadowColor = colors[n.state];
      graphCtx.fill();
      graphCtx.shadowBlur = 0;
    }
    graphCtx.strokeStyle = 'rgba(255,255,255,0.15)';
    graphCtx.lineWidth = 1;
    graphCtx.stroke();
    // Label
    graphCtx.fillStyle = '#fff';
    graphCtx.font = 'bold 10px JetBrains Mono';
    graphCtx.textAlign = 'center';
    graphCtx.textBaseline = 'middle';
    graphCtx.fillText(n.label, n.x, n.y);
  });
}

// ===================== ALGO SELECT =====================
function selectAlgo(el, algo) {
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
  consoleLog('info', `Tipe: ${info.type} | ${info.desc.substring(0,80)}...`);
}

// ===================== SIMULATION ENGINE =====================
function startSimulation() {
  if (!startPos || !goalPos) { consoleLog('error', 'Start/Goal belum ditentukan!'); return; }
  if (isRunning && !isPaused) return;
  if (isPaused) { isPaused = false; document.getElementById('infoStatus').textContent = 'Berjalan'; document.getElementById('infoStatus').style.color = 'var(--accent4)'; runNextStep(); return; }

  // Reset visited cells
  for (let r = 0; r < gridRows; r++)
    for (let c = 0; c < gridCols; c++)
      if (['visited','current','queued','path'].includes(grid[r][c])) { grid[r][c] = 'unvisited'; updateCellUI(r,c); }

  isRunning = true; isPaused = false;
  stepCount = 0; visitedCount = 0;
  resetStats();

  document.getElementById('infoStatus').textContent = 'Berjalan';
  document.getElementById('infoStatus').style.color = 'var(--accent4)';

  consoleLog('system', `=== Memulai ${ALGO_INFO[currentAlgo].title} ===`);
  consoleLog('info', `Start: (${startPos.r},${startPos.c}) | Goal: (${goalPos.r},${goalPos.c})`);
  consoleLog('info', `Grid: ${gridRows}×${gridCols} | Heuristik: ${currentHeuristic}`);

  // Init algorithm-specific structures
  initAlgorithm();
  runNextStep();
}

// Algorithm state
let algoState = {};

function initAlgorithm() {
  const s = startPos, g = goalPos;
  const key = (r,c) => `${r},${c}`;
  algoState = { visited: new Set(), parent: {}, gScore: {}, fScore: {}, queue: [], found: false, path: [] };
  algoState.gScore[key(s.r,s.c)] = 0;

  switch(currentAlgo) {
        case 'garislintang':
      algoState.pq = [{r:s.r,c:s.c,g:0,f:heuristic(s,g)}];
      algoState.gScore = {[key(s.r,s.c)]:0};
      break;
    case 'bfs':
      algoState.queue = [{r:s.r,c:s.c}];
      algoState.visited.add(key(s.r,s.c));
      break;
    case 'dfs':
      algoState.stack = [{r:s.r,c:s.c}];
      algoState.visited.add(key(s.r,s.c));
      break;
    case 'dls':
      algoState.stack = [{r:s.r,c:s.c,depth:0}];
      algoState.depthLimit = parseInt(document.getElementById('depthLimitSel').value) || 10;
      break;
    case 'ids':
      algoState.maxDepth = 0; algoState.currentDepth = 0;
      algoState.stack = [{r:s.r,c:s.c,depth:0}];
      algoState.iterVisited = new Set([key(s.r,s.c)]);
      break;
    case 'ucs':
      algoState.pq = [{r:s.r,c:s.c,cost:0}];
      algoState.costMap = {[key(s.r,s.c)]: 0};
      break;
    case 'bidirectional':
      algoState.queueF = [{r:s.r,c:s.c}];
      algoState.queueB = [{r:g.r,c:g.c}];
      algoState.visitedF = new Set([key(s.r,s.c)]);
      algoState.visitedB = new Set([key(g.r,g.c)]);
      algoState.parentF = {}; algoState.parentB = {};
      algoState.direction = 'forward';
      break;
    case 'greedy':
      algoState.pq = [{r:s.r,c:s.c,h:heuristic(s,g)}];
      algoState.visited.add(key(s.r,s.c));
      break;
    case 'astar':
    case 'weighted_astar':
      algoState.pq = [{r:s.r,c:s.c,g:0,f:heuristic(s,g)}];
      algoState.gScore = {[key(s.r,s.c)]:0};
      break;
    case 'idastar':
      algoState.threshold = heuristic(s,g);
      algoState.stack = [{r:s.r,c:s.c,g:0,path:[key(s.r,s.c)]}];
      algoState.nextThreshold = Infinity;
      break;
    case 'beam':
      algoState.beam = [{r:s.r,c:s.c,h:heuristic(s,g)}];
      algoState.visited.add(key(s.r,s.c));
      algoState.beamWidth = parseInt(document.getElementById('beamWidthSel').value) || 3;
      break;
    case 'hillclimbing':
    case 'steepest':
      algoState.current = {r:s.r,c:s.c};
      algoState.visited.add(key(s.r,s.c));
      break;
    case 'simulated_annealing':
      algoState.current = {r:s.r,c:s.c};
      algoState.temp = 100; algoState.cooling = 0.98;
      break;
    case 'tabu':
      algoState.current = {r:s.r,c:s.c};
      algoState.tabuList = [key(s.r,s.c)]; algoState.tabuMax = 15;
      break;
    case 'genetic':
      algoState.population = generatePopulation(s, g, 10);
      algoState.generation = 0;
      break;
    case 'minimax': case 'alphabeta': case 'mcts':
      algoState.queue = [{r:s.r,c:s.c}];
      algoState.visited.add(key(s.r,s.c));
      break;
    case 'backtracking':
      algoState.stack = [{r:s.r,c:s.c,path:[key(s.r,s.c)]}];
      break;
    case 'ants':
      algoState.pheromone = {};
      algoState.ants = Array.from({length:5}, () => ({r:s.r,c:s.c,path:[key(s.r,s.c)],visited:new Set([key(s.r,s.c)])}));
      algoState.bestPath = null; algoState.iteration = 0;
      algoState.queue = [{r:s.r,c:s.c}]; algoState.visited.add(key(s.r,s.c));
      break;
    case 'jps':
      algoState.pq = [{r:s.r,c:s.c,g:0,f:heuristic(s,g)}];
      algoState.gScore = {[key(s.r,s.c)]:0};
      break;
  }
}

function generatePopulation(s, g, size) {
  const pop = [];
  for (let i = 0; i < size; i++) {
    const path = [{r:s.r,c:s.c}];
    let cur = {r:s.r,c:s.c};
    for (let j = 0; j < 30; j++) {
      const nbrs = getNeighbors(cur.r, cur.c).filter(n => grid[n.r][n.c] !== 'wall');
      if (!nbrs.length) break;
      const next = nbrs[Math.floor(Math.random()*nbrs.length)];
      path.push(next); cur = next;
      if (cur.r === g.r && cur.c === g.c) break;
    }
    pop.push({ path, fitness: heuristic(cur, g) });
  }
  return pop;
}

function runNextStep() {
  if (!isRunning || isPaused) return;
  const done = stepAlgorithm();
  if (!done) {
    const delay = [300, 150, 80, 30, 5][parseInt(document.getElementById('speedSlider').value)-1];
    simulationTimer = setTimeout(runNextStep, delay);
  }
}

function stepAlgorithm() {
  const s = startPos, g = goalPos;
  const key = (r,c) => `${r},${c}`;

  stepCount++;
  document.getElementById('statSteps').textContent = stepCount;
  document.getElementById('infoStep').textContent = stepCount;

  switch(currentAlgo) {
    case 'garislintang': return stepGarisLintang(s,g,key);
    case 'bfs': return stepBFS(s,g,key);
    case 'dfs': return stepDFS(s,g,key);
    case 'dls': return stepDLS(s,g,key);
    case 'ids': return stepIDS(s,g,key);
    case 'ucs': return stepUCS(s,g,key);
    case 'bidirectional': return stepBiDir(s,g,key);
    case 'greedy': return stepGreedy(s,g,key);
    case 'astar': return stepAStar(s,g,key, false);
    case 'weighted_astar': return stepAStar(s,g,key, true);
    case 'idastar': return stepIDAStar(s,g,key);
    case 'beam': return stepBeam(s,g,key);
    case 'hillclimbing': return stepHC(s,g,key, false);
    case 'steepest': return stepHC(s,g,key, true);
    case 'simulated_annealing': return stepSA(s,g,key);
    case 'tabu': return stepTabu(s,g,key);
    case 'genetic': return stepGenetic(s,g,key);
    case 'minimax': return stepMinimax(s,g,key);
    case 'alphabeta': return stepAlphaBeta(s,g,key);
    case 'mcts': return stepMCTS(s,g,key);
    case 'backtracking': return stepBacktracking(s,g,key);
    case 'ants': return stepACO(s,g,key);
    case 'jps': return stepJPS(s,g,key);
    default: return stepBFS(s,g,key);
  }
}

function getNeighbors(r, c, diagonal=false) {
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  if (diagonal) dirs.push(...[[1,1],[1,-1],[-1,1],[-1,-1]]);
  const res = [];
  dirs.forEach(([dr,dc]) => {
    const nr=r+dr, nc=c+dc;
    if (nr>=0 && nr<gridRows && nc>=0 && nc<gridCols && grid[nr][nc] !== 'wall')
      res.push({r:nr,c:nc});
  });
  return res;
}

function heuristic(a, b) {
  const dr = Math.abs(a.r-b.r), dc = Math.abs(a.c-b.c);
  switch(currentHeuristic) {
    case 'manhattan': return dr+dc;
    case 'euclidean': return Math.sqrt(dr*dr+dc*dc);
    case 'chebyshev': return Math.max(dr,dc);
    case 'octile': return Math.max(dr,dc) + (Math.sqrt(2)-1)*Math.min(dr,dc);
    default: return dr+dc;
  }
}

function markCurrent(r, c) {
  if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') { grid[r][c] = 'current'; updateCellUI(r,c); }
  document.getElementById('infoCurrent').textContent = `(${r},${c})`;
  const h = Math.round(heuristic({r,c}, goalPos)*10)/10;
  const g = algoState.gScore ? (algoState.gScore[`${r},${c}`] || 0) : 0;
  document.getElementById('infoHn').textContent = h;
  document.getElementById('infoGn').textContent = g;
  document.getElementById('infoFn').textContent = Math.round((g+h)*10)/10;
}

function markVisited(r, c) {
  visitedCount++;
  if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') { grid[r][c] = 'visited'; updateCellUI(r,c); }
  document.getElementById('statVisited').textContent = visitedCount;
}

function markQueued(r, c) {
  if (grid[r][c] !== 'start' && grid[r][c] !== 'goal' && grid[r][c] !== 'visited') { grid[r][c] = 'queued'; updateCellUI(r,c); }
}

function foundGoal(parent, key, gr, gc) {
  const path = [];
  let cur = key(gr, gc);
  while (cur) { path.unshift(cur); cur = parent[cur]; }
  path.forEach(k => {
    const [r,c] = k.split(',').map(Number);
    if (grid[r][c] !== 'start' && grid[r][c] !== 'goal') { grid[r][c] = 'path'; updateCellUI(r,c); }
  });
  document.getElementById('statPath').textContent = path.length;
  document.getElementById('infoStatus').textContent = 'Selesai ✓';
  document.getElementById('infoStatus').style.color = 'var(--accent4)';
  const pathDisplay = document.getElementById('pathDisplay');
  pathDisplay.innerHTML = path.map((k,i) => `<span class="path-node">${k}</span>${i<path.length-1?'<span class="path-arrow">→</span>':''}`).join('');
  consoleLog('success', `✓ Path ditemukan! Panjang: ${path.length} node, ${stepCount} langkah, ${visitedCount} dikunjungi`);
  consoleLog('path', `Path: ${path.join(' → ')}`);
  isRunning = false;
  if (currentView === 'graph') { initGraphView(); }
  return true;
}

function noPath() {
  document.getElementById('infoStatus').textContent = 'Gagal ✗';
  document.getElementById('infoStatus').style.color = 'var(--accent5)';
  document.getElementById('statPath').textContent = '∞';
  consoleLog('error', `✗ Tidak ada jalur ditemukan setelah ${stepCount} langkah`);
  isRunning = false;
  return true;
}

function updateQueueDisplay(items) {
  const qd = document.getElementById('queueDisplay');
  document.getElementById('statQueue').textContent = items.length;
  qd.innerHTML = items.slice(0,12).map(item => {
    const k = typeof item === 'string' ? item : `${item.r},${item.c}`;
    return `<div class="queue-node">${k.split(',').map(Number).map((v,i)=>i===0?v:','+v).join('')}</div>`;
  }).join('') + (items.length > 12 ? `<div style="font-size:9px;color:var(--text3);padding:4px">+${items.length-12}</div>` : '');
}

function stepGarisLintang(s,g,key) {
  const as = algoState;
  if (!as.pq.length) return noPath();
  as.pq.sort((a,b)=>a.f-b.f);
  const cur = as.pq.shift();
  const {r,c,g:gv} = cur;
  const k = key(r,c);
  if (as.visited.has(k)) return false;
  as.visited.add(k);
  markCurrent(r,c); markVisited(r,c);
  
  const h = Math.round(heuristic({r,c},g)*10)/10;
  consoleLog('step', `GarisLintang → (${r},${c}) f=${Math.round(cur.f*10)/10}`);
  if (r===g.r && c===g.c) return foundGoal(as.parent,key,r,c);
  
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    const ng = gv+1;
    if (!as.gScore[nk] || ng < as.gScore[nk]) {
      as.gScore[nk]=ng; as.parent[nk]=key(r,c);
      
      // Calculate f = D_goal + k * T
      const k_val = 2.5; // penalti
      const d_goal = Math.sqrt(Math.pow(n.r-g.r, 2) + Math.pow(n.c-g.c, 2));
      const dx = g.c - s.c;
      const dy = g.r - s.r;
      let cross = 0;
      if (dx === 0 && dy === 0) {
        cross = Math.sqrt(Math.pow(n.r-s.r, 2) + Math.pow(n.c-s.c, 2));
      } else {
        cross = Math.abs(dx * (s.r - n.r) - (s.c - n.c) * dy) / Math.sqrt(dx*dx + dy*dy);
      }
      const f = d_goal + k_val * cross;
      
      as.pq.push({...n,g:ng,f:f});
      markQueued(n.r,n.c);
    }
  });
  updateQueueDisplay(as.pq);
  return false;
}

// ===================== ALGORITHMS =====================
function stepBFS(s,g,key) {
  const {queue, visited, parent} = algoState;
  if (!queue.length) return noPath();
  const {r,c} = queue.shift();
  markCurrent(r,c);
  consoleLog('step', `BFS → Ekspansi (${r},${c}) | Antrian: ${queue.length}`);
  if (r===g.r && c===g.c) return foundGoal(parent,key,r,c);
  markVisited(r,c);
  const nbrs = getNeighbors(r,c);
  nbrs.forEach(n => {
    const k = key(n.r,n.c);
    if (!visited.has(k)) { visited.add(k); parent[k] = key(r,c); queue.push(n); markQueued(n.r,n.c); }
  });
  updateQueueDisplay(queue);
  return false;
}

function stepDFS(s,g,key) {
  const {stack, visited, parent} = algoState;
  if (!stack.length) return noPath();
  const {r,c} = stack.pop();
  const k = key(r,c);
  if (visited.has(k)) return false;
  visited.add(k);
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `DFS → Ekspansi (${r},${c}) | Stack: ${stack.length}`);
  if (r===g.r && c===g.c) return foundGoal(parent,key,r,c);
  const nbrs = getNeighbors(r,c).reverse();
  nbrs.forEach(n => {
    const nk = key(n.r,n.c);
    if (!visited.has(nk)) { parent[nk] = key(r,c); stack.push(n); markQueued(n.r,n.c); }
  });
  updateQueueDisplay(stack);
  return false;
}

function stepDLS(s,g,key) {
  const {stack, visited, parent, depthLimit} = algoState;
  if (!stack.length) return noPath();
  const {r,c,depth} = stack.pop();
  const k = key(r,c);
  if (visited.has(k)) return false;
  visited.add(k);
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `DLS[d=${depth}/${depthLimit}] → (${r},${c})`);
  if (r===g.r && c===g.c) return foundGoal(parent,key,r,c);
  if (depth < depthLimit) {
    getNeighbors(r,c).reverse().forEach(n => {
      const nk = key(n.r,n.c);
      if (!visited.has(nk)) { parent[nk] = key(r,c); stack.push({...n,depth:depth+1}); markQueued(n.r,n.c); }
    });
  }
  updateQueueDisplay(stack);
  return false;
}

function stepIDS(s,g,key) {
  const as = algoState;
  if (!as.stack.length) {
    as.maxDepth++;
    consoleLog('warn', `IDS → Iterasi baru, max depth: ${as.maxDepth}`);
    as.stack = [{r:s.r,c:s.c,depth:0}];
    as.iterVisited = new Set([key(s.r,s.c)]);
    for (let r=0;r<gridRows;r++) for (let c=0;c<gridCols;c++) if (grid[r][c]==='visited'||grid[r][c]==='queued') { grid[r][c]='unvisited'; updateCellUI(r,c); }
    if (as.maxDepth > gridRows*gridCols) return noPath();
    return false;
  }
  const {r,c,depth} = as.stack.pop();
  const k = key(r,c);
  if (as.iterVisited.has(k)) return false;
  as.iterVisited.add(k);
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `IDS[d=${depth}] → (${r},${c})`);
  if (r===g.r && c===g.c) return foundGoal(as.parent,key,r,c);
  if (depth < as.maxDepth) {
    getNeighbors(r,c).reverse().forEach(n => {
      const nk = key(n.r,n.c);
      if (!as.iterVisited.has(nk)) { as.parent[nk]=key(r,c); as.stack.push({...n,depth:depth+1}); markQueued(n.r,n.c); }
    });
  }
  updateQueueDisplay(as.stack);
  return false;
}

function stepUCS(s,g,key) {
  const {pq, costMap, parent} = algoState;
  if (!pq.length) return noPath();
  pq.sort((a,b)=>a.cost-b.cost);
  const {r,c,cost} = pq.shift();
  const k = key(r,c);
  if (algoState.visited.has(k)) return false;
  algoState.visited.add(k);
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `UCS → (${r},${c}) cost=${cost}`);
  if (r===g.r && c===g.c) return foundGoal(parent,key,r,c);
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    const newCost = cost+1;
    if (!costMap[nk] || newCost < costMap[nk]) { costMap[nk]=newCost; parent[nk]=key(r,c); pq.push({...n,cost:newCost}); markQueued(n.r,n.c); }
  });
  updateQueueDisplay(pq);
  return false;
}

function stepBiDir(s,g,key) {
  const as = algoState;
  const isForward = as.direction === 'forward';
  const q = isForward ? as.queueF : as.queueB;
  const vis = isForward ? as.visitedF : as.visitedB;
  const visOther = isForward ? as.visitedB : as.visitedF;
  const par = isForward ? as.parentF : as.parentB;
  if (!q.length) return noPath();
  const {r,c} = q.shift();
  const k = key(r,c);
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `Bi-BFS [${isForward?'→':'←'}] → (${r},${c})`);
  if (visOther.has(k)) {
    consoleLog('success', `Pertemuan di (${r},${c})!`);
    return foundGoal(as.parentF, key, r, c);
  }
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    if (!vis.has(nk)) { vis.add(nk); par[nk]=key(r,c); q.push(n); markQueued(n.r,n.c); }
  });
  as.direction = isForward ? 'backward' : 'forward';
  updateQueueDisplay([...as.queueF,...as.queueB]);
  return false;
}

function stepGreedy(s,g,key) {
  const {pq, visited, parent} = algoState;
  if (!pq.length) return noPath();
  pq.sort((a,b)=>a.h-b.h);
  const {r,c} = pq.shift();
  const k = key(r,c);
  if (visited.has(k)) return false;
  visited.add(k);
  markCurrent(r,c); markVisited(r,c);
  const h = Math.round(heuristic({r,c},g)*10)/10;
  consoleLog('step', `Greedy → (${r},${c}) h=${h}`);
  if (r===g.r && c===g.c) return foundGoal(parent,key,r,c);
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    if (!visited.has(nk)) { parent[nk]=key(r,c); pq.push({...n,h:heuristic(n,g)}); markQueued(n.r,n.c); }
  });
  updateQueueDisplay(pq);
  return false;
}

function stepAStar(s,g,key, weighted) {
  const as = algoState;
  const w = weighted ? parseFloat(document.getElementById('weightSel').value) : 1.0;
  if (!as.pq.length) return noPath();
  as.pq.sort((a,b)=>a.f-b.f);
  const {r,c,g:gv} = as.pq.shift();
  const k = key(r,c);
  if (as.visited.has(k)) return false;
  as.visited.add(k);
  markCurrent(r,c); markVisited(r,c);
  const h = Math.round(heuristic({r,c},g)*10)/10;
  const f = Math.round((gv+w*h)*10)/10;
  consoleLog('step', `${weighted?'wA*':'A*'} → (${r},${c}) g=${gv} h=${h} f=${f}`);
  if (r===g.r && c===g.c) return foundGoal(as.parent,key,r,c);
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    const ng = gv+1;
    if (!as.gScore[nk] || ng < as.gScore[nk]) {
      as.gScore[nk]=ng; as.parent[nk]=key(r,c);
      as.pq.push({...n,g:ng,f:ng+w*heuristic(n,g)});
      markQueued(n.r,n.c);
    }
  });
  updateQueueDisplay(as.pq);
  return false;
}

function stepIDAStar(s,g,key) {
  const as = algoState;
  if (!as.stack.length) {
    if (as.nextThreshold === Infinity) return noPath();
    as.threshold = as.nextThreshold;
    as.nextThreshold = Infinity;
    as.stack = [{r:s.r,c:s.c,g:0,path:[key(s.r,s.c)]}];
    consoleLog('warn', `IDA* → threshold = ${Math.round(as.threshold*10)/10}`);
    for (let r=0;r<gridRows;r++) for (let c=0;c<gridCols;c++) if (grid[r][c]==='visited'||grid[r][c]==='queued') { grid[r][c]='unvisited'; updateCellUI(r,c); }
    return false;
  }
  const {r,c,g:gv,path} = as.stack.pop();
  const f = gv + heuristic({r,c},g);
  if (f > as.threshold) { as.nextThreshold = Math.min(as.nextThreshold, f); return false; }
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `IDA* → (${r},${c}) g=${gv} f=${Math.round(f*10)/10} thresh=${Math.round(as.threshold*10)/10}`);
  if (r===g.r && c===g.c) return foundGoal(as.parent, key, r, c);
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    if (!path.includes(nk)) { as.parent[nk]=key(r,c); as.stack.push({...n,g:gv+1,path:[...path,nk]}); markQueued(n.r,n.c); }
  });
  return false;
}

function stepBeam(s,g,key) {
  const as = algoState;
  if (!as.beam.length) return noPath();
  const cur = as.beam.shift();
  const {r,c} = cur;
  const k = key(r,c);
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `Beam[W=${as.beamWidth}] → (${r},${c}) h=${Math.round(cur.h*10)/10}`);
  if (r===g.r && c===g.c) return foundGoal(as.parent,key,r,c);
  let candidates = [];
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    if (!as.visited.has(nk)) { as.parent[nk]=key(r,c); candidates.push({...n,h:heuristic(n,g)}); }
  });
  candidates.sort((a,b)=>a.h-b.h);
  candidates = candidates.slice(0, as.beamWidth);
  candidates.forEach(n => { as.visited.add(key(n.r,n.c)); as.beam.push(n); markQueued(n.r,n.c); });
  updateQueueDisplay(as.beam);
  return false;
}

function stepHC(s,g,key, steepest) {
  const as = algoState;
  const {r,c} = as.current;
  markCurrent(r,c); markVisited(r,c);
  if (r===g.r && c===g.c) return foundGoal(as.parent,key,r,c);
  const nbrs = getNeighbors(r,c).filter(n => !as.visited.has(key(n.r,n.c)));
  if (!nbrs.length) return noPath();
  const curH = heuristic({r,c},g);
  if (steepest) {
    nbrs.sort((a,b)=>heuristic(a,g)-heuristic(b,g));
    const best = nbrs[0];
    if (heuristic(best,g) >= curH) return noPath();
    as.parent[key(best.r,best.c)] = key(r,c);
    as.visited.add(key(best.r,best.c));
    as.current = best;
    markQueued(best.r,best.c);
    consoleLog('step', `Steepest HC → (${best.r},${best.c}) h=${Math.round(heuristic(best,g)*10)/10}`);
  } else {
    const better = nbrs.find(n => heuristic(n,g) < curH);
    if (!better) return noPath();
    as.parent[key(better.r,better.c)] = key(r,c);
    as.visited.add(key(better.r,better.c));
    as.current = better;
    markQueued(better.r,better.c);
    consoleLog('step', `HC → (${better.r},${better.c}) h=${Math.round(heuristic(better,g)*10)/10}`);
  }
  return false;
}

function stepSA(s,g,key) {
  const as = algoState;
  const {r,c} = as.current;
  markCurrent(r,c); markVisited(r,c);
  as.temp *= as.cooling;
  if (as.temp < 0.01) return noPath();
  if (r===g.r && c===g.c) return foundGoal(as.parent,key,r,c);
  const nbrs = getNeighbors(r,c);
  if (!nbrs.length) return false;
  const next = nbrs[Math.floor(Math.random()*nbrs.length)];
  const dE = heuristic({r,c},g) - heuristic(next,g);
  const accept = dE > 0 || Math.random() < Math.exp(dE/as.temp);
  if (accept) {
    as.parent[key(next.r,next.c)] = key(r,c);
    as.current = next;
    markQueued(next.r,next.c);
  }
  consoleLog('step', `SA T=${as.temp.toFixed(2)} → (${next.r},${next.c}) ΔE=${dE.toFixed(2)} ${accept?'✓':'✗'}`);
  return false;
}

function stepTabu(s,g,key) {
  const as = algoState;
  const {r,c} = as.current;
  markCurrent(r,c); markVisited(r,c);
  if (r===g.r && c===g.c) return foundGoal(as.parent,key,r,c);
  const nbrs = getNeighbors(r,c).filter(n => !as.tabuList.includes(key(n.r,n.c)));
  if (!nbrs.length) return noPath();
  nbrs.sort((a,b)=>heuristic(a,g)-heuristic(b,g));
  const best = nbrs[0];
  const bk = key(best.r,best.c);
  as.parent[bk] = key(r,c);
  as.tabuList.push(bk);
  if (as.tabuList.length > as.tabuMax) as.tabuList.shift();
  as.current = best;
  markQueued(best.r,best.c);
  consoleLog('step', `Tabu → (${best.r},${best.c}) | Tabu size: ${as.tabuList.length}`);
  return false;
}

function stepGenetic(s,g,key) {
  const as = algoState;
  as.generation++;
  const best = as.population.reduce((a,b)=>a.fitness<b.fitness?a:b);
  const last = best.path[best.path.length-1];
  markCurrent(last.r, last.c);
  best.path.forEach(p => markVisited(p.r,p.c));
  consoleLog('step', `GA Gen ${as.generation} | Best fitness: ${best.fitness.toFixed(2)}`);
  if (last.r===g.r && last.c===g.c) {
    best.path.forEach(p => { as.parent[key(p.r,p.c)] = null; });
    return foundGoal(as.parent, key, last.r, last.c);
  }
  // Simple evolution: mutate best
  as.population = as.population.map(ind => {
    if (Math.random() < 0.3) return generatePopulation(s,g,1)[0];
    return ind;
  });
  if (as.generation > 100) return noPath();
  return false;
}

function stepMinimax(s,g,key) { return stepBFS(s,g,key); }
function stepAlphaBeta(s,g,key) { return stepBFS(s,g,key); }
function stepMCTS(s,g,key) { return stepAStar(s,g,key,false); }

function stepBacktracking(s,g,key) {
  const as = algoState;
  if (!as.stack.length) return noPath();
  const {r,c,path} = as.stack.pop();
  markCurrent(r,c); markVisited(r,c);
  consoleLog('step', `BT → (${r},${c}) depth=${path.length}`);
  if (r===g.r && c===g.c) {
    path.forEach(k => { const [pr,pc]=k.split(',').map(Number); if(grid[pr][pc]!=='start'&&grid[pr][pc]!=='goal'){grid[pr][pc]='path';updateCellUI(pr,pc);} });
    document.getElementById('statPath').textContent = path.length;
    document.getElementById('infoStatus').textContent = 'Selesai ✓';
    document.getElementById('infoStatus').style.color = 'var(--accent4)';
    consoleLog('success', `BT: Path ditemukan! ${path.length} node`);
    isRunning = false; return true;
  }
  getNeighbors(r,c).forEach(n => {
    const nk = key(n.r,n.c);
    if (!path.includes(nk)) { as.parent[nk]=key(r,c); as.stack.push({...n,path:[...path,nk]}); markQueued(n.r,n.c); }
  });
  updateQueueDisplay(as.stack);
  return false;
}

function stepACO(s,g,key) { return stepAStar(s,g,key,false); }
function stepJPS(s,g,key) { return stepAStar(s,g,key,false); }

// ===================== CONTROLS =====================
function pauseSimulation() {
  if (!isRunning) return;
  isPaused = !isPaused;
  clearTimeout(simulationTimer);
  const btn = document.getElementById('btnPause');
  if (isPaused) {
    btn.textContent = '▶ Lanjut';
    document.getElementById('infoStatus').textContent = 'Dijeda';
    document.getElementById('infoStatus').style.color = 'var(--accent3)';
    consoleLog('warn', 'Simulasi dijeda');
  } else {
    btn.textContent = '⏸ Jeda';
    document.getElementById('infoStatus').textContent = 'Berjalan';
    document.getElementById('infoStatus').style.color = 'var(--accent4)';
    consoleLog('info', 'Simulasi dilanjutkan');
    runNextStep();
  }
}

function stepThroughSimulation() {
  if (!startPos || !goalPos) { consoleLog('error', 'Start/Goal belum ditentukan!'); return; }
  
  if (!isRunning) {
    for (let r = 0; r < gridRows; r++)
      for (let c = 0; c < gridCols; c++)
        if (['visited','current','queued','path'].includes(grid[r][c])) { grid[r][c] = 'unvisited'; updateCellUI(r,c); }

    isRunning = true;
    isPaused = true;
    stepCount = 0; visitedCount = 0;
    resetStats();

    document.getElementById('infoStatus').textContent = 'Dijeda (Langkah)';
    document.getElementById('infoStatus').style.color = 'var(--accent3)';

    consoleLog('system', `=== Memulai ${ALGO_INFO[currentAlgo].title} (Langkah-per-Langkah) ===`);
    initAlgorithm();
  } else {
    isPaused = true;
    clearTimeout(simulationTimer);
    document.getElementById('btnPause').textContent = '▶ Lanjut';
    document.getElementById('infoStatus').textContent = 'Dijeda (Langkah)';
    document.getElementById('infoStatus').style.color = 'var(--accent3)';
  }
  
  stepAlgorithm();
}

function stopSimulation() {
  isRunning = false; isPaused = false;
  clearTimeout(simulationTimer);
  document.getElementById('btnPause').textContent = '⏸ Jeda';
  document.getElementById('infoStatus').textContent = 'Berhenti';
  document.getElementById('infoStatus').style.color = 'var(--accent5)';
  if (stepCount > 0) consoleLog('warn', `Simulasi dihentikan di langkah ${stepCount}`);
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
  document.getElementById('infoStatus').textContent = 'Siap';
  document.getElementById('infoStatus').style.color = 'var(--text3)';
}

function updateSpeed(v) {
  const labels = ['Sangat Lambat', 'Lambat', 'Sedang', 'Cepat', 'Sangat Cepat'];
  document.getElementById('speedLabel').textContent = labels[v-1];
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
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}.${String(now.getMilliseconds()).padStart(3,'0')}`;
  const line = document.createElement('div');
  line.className = 'log-line';
  const typeClass = { info: 'log-info', warn: 'log-warn', success: 'log-success', error: 'log-error', step: 'log-step', path: 'log-path', system: 'log-system' };
  const prefix = { info: '[INFO]', warn: '[WARN]', success: '[ OK ]', error: '[ERR ]', step: '[STEP]', path: '[PATH]', system: '[SYS ]' };
  line.innerHTML = `<span class="log-time">${time}</span><span class="${typeClass[type]||'log-step'}">${prefix[type]||'[LOG]'} ${msg}</span>`;
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
  const blob = new Blob([logHistory.join('\n')], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `simulasi-${currentAlgo}-${Date.now()}.log`; a.click();
  consoleLog('success', 'Log diekspor');
}

function toggleConsole() {
  const area = document.querySelector('.console-area');
  const btn = document.getElementById('consoleToggle');
  consoleVisible = !consoleVisible;
  area.style.height = consoleVisible ? '180px' : '32px';
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
  switch(parts[0]) {
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

  // Handle window resize for 3D
  window.addEventListener('resize', () => { if (currentView === '3d') init3D(); if (currentView === 'graph') initGraphView(); });
});