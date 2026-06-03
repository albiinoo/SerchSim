// =====================================================================
// algo-worker.js  — Web Worker untuk simulasi algoritma searching
// UPGRADED: Generator Functions + Message Batching + Turbo Mode
//
// Arsitektur:
//   1. NORMAL MODE  → Generator Function per algoritma
//                     yield = satu "step" terlihat
//                     Interval-Based Ticking mengkonsumsi generator
//
//   2. TURBO MODE   → Worker menjalankan ribuan step tanpa delay,
//                     mengirim snapshot batch setiap ~16ms
//                     (requestAnimationFrame-friendly batching)
//
// Keunggulan Generator:
//   - State implisit di dalam generator (tidak perlu algoState object)
//   - Pause/Resume gratis — tinggal stop/start interval
//   - Step-through sangat natural: gen.next() satu kali
//   - Tidak ada busy-wait, tidak ada frame drop
// =====================================================================

'use strict';

// ── Konfigurasi ────────────────────────────────────────────────────────
let workerGrid       = [];
let workerRows       = 0, workerCols = 0;
let workerAlgo       = 'bfs';
let workerHeuristic  = 'manhattan';
let workerWeight     = 1.0;
let workerBeamWidth  = 3;
let workerDepthLimit = 10;
let startPos         = null, goalPos = null;
let stepCount        = 0, visitedCount = 0;
let isRunning        = false;
let isPaused         = false;
let isTurbo          = false;   // ← Turbo Mode flag

// Speed table: [stepsPerTick, delayMs]
const SPEED_TABLE = [
  [1,   320],   // 1 – Sangat Lambat
  [1,   140],   // 2 – Lambat
  [3,    60],   // 3 – Sedang
  [12,   16],   // 4 – Cepat
  [50,   16],   // 5 – Sangat Cepat
];
let speedConfig = { stepsPerTick: 3, delayMs: 60 };

// ── Generator state ────────────────────────────────────────────────────
let algoGenerator    = null;    // Generator Function instance
let tickHandle       = null;    // setTimeout handle
let turboHandle      = null;    // setInterval handle untuk Turbo

// ── Dirty batch (dikumpulkan per tick, lalu di-flush sekaligus) ────────
let pendingCells     = new Map();
let pendingLogs      = [];
let pendingInfo      = null;
let pendingQueue     = null;
let pendingPath      = null;
let pendingDone      = null;

// Untuk Turbo Mode: batch lebih agresif
let turboLastFlush   = 0;
const TURBO_FLUSH_INTERVAL = 16; // ~60 fps

// ── Message handler ────────────────────────────────────────────────────
self.onmessage = function(e) {
  const { type } = e.data;
  switch (type) {
    case 'init':        handleInit(e.data);     break;
    case 'start':       handleStart();          break;
    case 'pause':       handlePause();          break;
    case 'resume':      handleResume();         break;
    case 'stop':        handleStop();           break;
    case 'step':        handleStep();           break;
    case 'speed':       handleSpeed(e.data);    break;
    case 'turbo':       handleTurbo(e.data);    break;
    case 'gridUpdate':  handleGridUpdate(e.data); break;
  }
};

function handleInit(data) {
  _stopAll();
  workerGrid       = data.grid.map(row => [...row]);
  workerRows       = data.rows;
  workerCols       = data.cols;
  workerAlgo       = data.algo;
  workerHeuristic  = data.heuristic  || 'manhattan';
  workerWeight     = (data.weight !== undefined && data.weight !== null) ? parseFloat(data.weight) : 1.0;
  workerBeamWidth  = data.beamWidth  || 3;
  workerDepthLimit = data.depthLimit || 10;
  startPos         = data.startPos;
  goalPos          = data.goalPos;
  stepCount        = 0;
  visitedCount     = 0;
  isTurbo          = false;
  pendingCells     = new Map();
  pendingLogs      = [];

  // Buat generator baru dari algoritma yang dipilih
  algoGenerator    = makeAlgorithmGenerator();

  log('system', `Worker init [GENERATOR MODE]: ${workerAlgo} | ${workerRows}×${workerCols}${workerAlgo==='weighted_astar' ? ` | w=${workerWeight}` : ''}`);
  flush();
}

function handleStart() {
  if (!algoGenerator) return;
  isRunning = true;
  isPaused  = false;
  if (isTurbo) {
    _startTurboLoop();
  } else {
    _scheduleNormalTick();
  }
}

function handlePause() {
  isPaused = true;
  _stopAll();
}

function handleResume() {
  if (!isRunning) return;
  isPaused = false;
  if (isTurbo) {
    _startTurboLoop();
  } else {
    _scheduleNormalTick();
  }
}

function handleStop() {
  isRunning = false;
  isPaused  = false;
  _stopAll();
  algoGenerator = null;
}

function handleStep() {
  // Manual step-through: konsumsi satu yield dari generator
  if (!algoGenerator || isPaused) return;
  const result = algoGenerator.next();
  if (result.done) {
    isRunning = false;
  }
  flush();
}

function handleSpeed(data) {
  const idx = Math.max(1, Math.min(5, data.value)) - 1;
  const [spt, dms] = SPEED_TABLE[idx];
  speedConfig.stepsPerTick = spt;
  speedConfig.delayMs      = dms;
}

function handleTurbo(data) {
  isTurbo = !!data.enabled;
  if (isRunning && !isPaused) {
    _stopAll();
    if (isTurbo) {
      _startTurboLoop();
    } else {
      _scheduleNormalTick();
    }
  }
  log('system', isTurbo ? '⚡ Turbo Mode ON — step batching aktif' : '🔵 Mode Normal aktif');
  flush();
}

function handleGridUpdate(data) {
  if (data.cells) {
    data.cells.forEach(({ r, c, state }) => { workerGrid[r][c] = state; });
  }
  if (data.startPos) startPos = data.startPos;
  if (data.goalPos)  goalPos  = data.goalPos;
}

// ── Normal Mode Loop (Interval-Based Ticking) ─────────────────────────
function _scheduleNormalTick() {
  if (!isRunning || isPaused || !algoGenerator) return;
  tickHandle = setTimeout(() => {
    // Konsumsi `stepsPerTick` yield dari generator
    for (let i = 0; i < speedConfig.stepsPerTick && isRunning && !isPaused; i++) {
      const result = algoGenerator.next();
      if (result.done || result.value === 'DONE') {
        isRunning = false;
        break;
      }
    }
    flush();
    if (isRunning && !isPaused) _scheduleNormalTick();
  }, speedConfig.delayMs);
}

// ── Turbo Mode Loop (setInterval + Batch Flush setiap 16ms) ───────────
function _startTurboLoop() {
  if (!isRunning || !algoGenerator) return;
  turboLastFlush = Date.now();

  turboHandle = setInterval(() => {
    if (!isRunning || isPaused || !algoGenerator) {
      clearInterval(turboHandle);
      return;
    }

    // Jalankan sebanyak mungkin step dalam jendela 12ms
    const deadline = Date.now() + 12;
    while (Date.now() < deadline && isRunning && !isPaused) {
      const result = algoGenerator.next();
      if (result.done || result.value === 'DONE') {
        isRunning = false;
        break;
      }
    }

    // Flush ke main thread setiap interval
    flush();

    if (!isRunning) {
      clearInterval(turboHandle);
      flush(); // final flush
    }
  }, TURBO_FLUSH_INTERVAL);
}

function _stopAll() {
  if (tickHandle)  { clearTimeout(tickHandle);   tickHandle  = null; }
  if (turboHandle) { clearInterval(turboHandle); turboHandle = null; }
}

// ── Flush: kirim semua pending ke main thread ─────────────────────────
function flush() {
  const msg = {};
  let hasData = false;

  if (pendingCells.size > 0) {
    const cells = [];
    pendingCells.forEach((state, k) => {
      const sepIdx = k.indexOf(',');
      cells.push({ r: +k.slice(0, sepIdx), c: +k.slice(sepIdx + 1), state });
    });
    msg.cells        = cells;
    msg.stepCount    = stepCount;
    msg.visitedCount = visitedCount;
    pendingCells     = new Map();
    hasData = true;
  }

  if (pendingLogs.length > 0) {
    msg.logs    = pendingLogs.slice();
    pendingLogs = [];
    hasData = true;
  }

  if (pendingInfo !== null) { msg.info = pendingInfo; pendingInfo = null; hasData = true; }
  if (pendingQueue !== null) { msg.queue = pendingQueue; pendingQueue = null; hasData = true; }
  if (pendingPath  !== null) { msg.path  = pendingPath;  pendingPath  = null; hasData = true; }
  if (pendingDone  !== null) { msg.done  = pendingDone;  pendingDone  = null; hasData = true; }

  if (hasData) self.postMessage(msg);
}

// ── Helpers ────────────────────────────────────────────────────────────
function key(r, c)    { return `${r},${c}`; }
function keyInt(r, c) { return r * 10000 + c; } // integer key for Map (faster)

function markCell(r, c, state) {
  if (workerGrid[r][c] === 'start' || workerGrid[r][c] === 'goal') return;
  workerGrid[r][c] = state;
  pendingCells.set(key(r, c), state);
}

function markCurrent(r, c) {
  markCell(r, c, 'current');
  const h = heuristic(r, c, goalPos.r, goalPos.c);
  const gSc = algoGenerator?._gScore?.[key(r, c)] ?? 0;
  pendingInfo = { r, c, h: Math.round(h * 10) / 10, g: gSc, f: Math.round((gSc + h) * 10) / 10, step: stepCount };
}

function markVisited(r, c) {
  visitedCount++;
  markCell(r, c, 'visited');
}

function markQueued(r, c) {
  const s = workerGrid[r][c];
  if (s !== 'visited' && s !== 'current' && s !== 'start' && s !== 'goal')
    markCell(r, c, 'queued');
}

function setQueue(items) {
  pendingQueue = items.slice(0, 20).map(it =>
    typeof it === 'string' ? it : key(it.r, it.c)
  );
}

function log(type, msg) { pendingLogs.push({ type, msg }); }

function heuristic(ar, ac, br, bc) {
  const dr = Math.abs(ar - br), dc = Math.abs(ac - bc);
  switch (workerHeuristic) {
    case 'manhattan': return dr + dc;
    case 'euclidean': return Math.sqrt(dr * dr + dc * dc);
    case 'chebyshev': return Math.max(dr, dc);
    case 'octile':    return Math.max(dr, dc) + (Math.SQRT2 - 1) * Math.min(dr, dc);
    default:          return dr + dc;
  }
}

function getNeighbors(r, c, diagonal = false) {
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  if (diagonal) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  const res = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < workerRows && nc >= 0 && nc < workerCols && workerGrid[nr][nc] !== 'wall')
      res.push({ r: nr, c: nc });
  }
  return res;
}

function tracePath(parent, gr, gc) {
  const path = [];
  let cur = key(gr, gc);
  while (cur) { path.unshift(cur); cur = parent[cur]; }
  return path;
}

function tracePathMap(parentMap, gr, gc) {
  const path = [];
  let cur = key(gr, gc);
  while (cur !== undefined && cur !== null) {
    path.unshift(cur);
    cur = (parentMap instanceof Map) ? parentMap.get(cur) : parentMap[cur];
    if (cur === undefined) break;
  }
  return path;
}

function emitPath(path) {
  path.forEach(k => {
    const [r, c] = k.split(',').map(Number);
    markCell(r, c, 'path');
  });
  pendingPath = path;
  pendingDone = { found: true, pathLen: path.length, steps: stepCount, visited: visitedCount };
  log('success', `✓ Path ditemukan! Panjang: ${path.length} node, ${stepCount} langkah`);
  log('path', `Path: ${path.join(' → ')}`);
}

function emitNoPath() {
  pendingDone = { found: false, steps: stepCount, visited: visitedCount };
  log('error', `✗ Tidak ada jalur setelah ${stepCount} langkah`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GENERATOR FACTORY — pilih dan kembalikan generator yang sesuai
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function makeAlgorithmGenerator() {
  const s = startPos, g = goalPos;

  switch (workerAlgo) {
    case 'bfs':             return gen_BFS(s, g);
    case 'dfs':             return gen_DFS(s, g);
    case 'dls':             return gen_DLS(s, g);
    case 'ids':             return gen_IDS(s, g);
    case 'ucs':             return gen_UCS(s, g);
    case 'bidirectional':   return gen_BiDir(s, g);
    case 'greedy':          return gen_Greedy(s, g);
    case 'astar':           return gen_AStar(s, g, 1.0);
    case 'weighted_astar':  return gen_AStar(s, g, workerWeight);
    case 'idastar':         return gen_IDAStar(s, g);
    case 'beam':            return gen_Beam(s, g);
    case 'hillclimbing':    return gen_HC(s, g, false);
    case 'steepest':        return gen_HC(s, g, true);
    case 'simulated_annealing': return gen_SA(s, g);
    case 'tabu':            return gen_Tabu(s, g);
    case 'genetic':         return gen_Genetic(s, g);
    case 'minimax':         return gen_Minimax(s, g);
    case 'alphabeta':       return gen_AlphaBeta(s, g);
    case 'mcts':            return gen_MCTS(s, g);
    case 'backtracking':    return gen_Backtracking(s, g);
    case 'ants':            return gen_ACO(s, g);
    case 'jps':             return gen_JPS(s, g);
    case 'garislintang':    return gen_GarisLintang(s, g);
    default:                return gen_BFS(s, g);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GENERATOR IMPLEMENTATIONS
//  Setiap `yield` = satu langkah visual
//  `return` = selesai
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function* gen_BFS(s, g) {
  const visited = new Set([key(s.r, s.c)]);
  const parent  = {};
  const queue   = [{ r: s.r, c: s.c }];

  while (queue.length) {
    stepCount++;
    const { r, c } = queue.shift();
    markCurrent(r, c);
    log('step', `BFS → (${r},${c}) | Q:${queue.length}`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }
    markVisited(r, c);

    for (const n of getNeighbors(r, c)) {
      const k = key(n.r, n.c);
      if (!visited.has(k)) {
        visited.add(k);
        parent[k] = key(r, c);
        queue.push(n);
        markQueued(n.r, n.c);
      }
    }
    setQueue(queue);
    yield;
  }
  emitNoPath();
}

function* gen_DFS(s, g) {
  const visited = new Set();
  const parent  = {};
  const stack   = [{ r: s.r, c: s.c }];

  while (stack.length) {
    const { r, c } = stack.pop();
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    log('step', `DFS → (${r},${c}) | Stack:${stack.length}`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    for (const n of getNeighbors(r, c).reverse()) {
      const nk = key(n.r, n.c);
      if (!visited.has(nk)) {
        parent[nk] = key(r, c);
        stack.push(n);
        markQueued(n.r, n.c);
      }
    }
    setQueue(stack);
    yield;
  }
  emitNoPath();
}

function* gen_DLS(s, g) {
  const L = workerDepthLimit;
  const visited = new Set();
  const parent  = {};
  const stack   = [{ r: s.r, c: s.c, depth: 0 }];

  while (stack.length) {
    const { r, c, depth } = stack.pop();
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    log('step', `DLS[${depth}/${L}] → (${r},${c})`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    if (depth < L) {
      for (const n of getNeighbors(r, c).reverse()) {
        const nk = key(n.r, n.c);
        if (!visited.has(nk)) {
          parent[nk] = key(r, c);
          stack.push({ ...n, depth: depth + 1 });
          markQueued(n.r, n.c);
        }
      }
    }
    setQueue(stack);
    yield;
  }
  emitNoPath();
}

function* gen_IDS(s, g) {
  for (let maxDepth = 0; maxDepth <= workerRows * workerCols; maxDepth++) {
    log('warn', `IDS → Iterasi baru, maxDepth=${maxDepth}`);

    // Clear visualisasi iterasi sebelumnya
    for (let r = 0; r < workerRows; r++)
      for (let c = 0; c < workerCols; c++)
        if (workerGrid[r][c] === 'visited' || workerGrid[r][c] === 'queued') {
          workerGrid[r][c] = 'unvisited';
          pendingCells.set(key(r, c), 'unvisited');
        }

    const iterVisited = new Set();
    const actualPath  = [];
    const stack       = [{ r: s.r, c: s.c, depth: 0 }];

    while (stack.length) {
      const cur = stack.pop();
      if (cur.isBacktrack) {
        iterVisited.delete(key(cur.r, cur.c));
        actualPath.pop();
        continue;
      }
      const { r, c, depth } = cur;
      const k = key(r, c);
      if (iterVisited.has(k)) continue;
      iterVisited.add(k);
      actualPath.push(k);
      stack.push({ isBacktrack: true, r, c });
      stepCount++;
      markCurrent(r, c); markVisited(r, c);
      log('step', `IDS[${depth}/${maxDepth}] → (${r},${c})`);

      if (r === g.r && c === g.c) {
        const pm = {};
        for (let i = 1; i < actualPath.length; i++) pm[actualPath[i]] = actualPath[i - 1];
        emitPath(tracePathMap(pm, r, c));
        return 'DONE';
      }

      if (depth < maxDepth) {
        for (const n of getNeighbors(r, c).reverse()) {
          const nk = key(n.r, n.c);
          if (!iterVisited.has(nk)) {
            stack.push({ ...n, depth: depth + 1 });
            markQueued(n.r, n.c);
          }
        }
      }
      setQueue(stack.filter(x => !x.isBacktrack));
      yield;
    }
  }
  emitNoPath();
}

function* gen_UCS(s, g) {
  const visited = new Set();
  const parent  = {};
  const costMap = { [key(s.r, s.c)]: 0 };
  const pq      = [{ r: s.r, c: s.c, cost: 0 }];

  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    const { r, c, cost } = pq.shift();
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    log('step', `UCS → (${r},${c}) g=${cost}`);

    if (r === g.r && c === g.c) {
      // Draw path line from start to goal
      const path = tracePath(parent, r, c);
      emitPath(path);
      return 'DONE';
    }

    for (const n of getNeighbors(r, c)) {
      const nk  = key(n.r, n.c);
      const nc2 = cost + 1;
      if (costMap[nk] === undefined || nc2 < costMap[nk]) {
        costMap[nk] = nc2;
        parent[nk]  = key(r, c);
        pq.push({ ...n, cost: nc2 });
        markQueued(n.r, n.c);
      }
    }
    setQueue(pq);
    yield;
  }
  emitNoPath();
}

function* gen_BiDir(s, g) {
  const qF = [{ r: s.r, c: s.c }];
  const qB = [{ r: g.r, c: g.c }];
  const vF = new Set([key(s.r, s.c)]);
  const vB = new Set([key(g.r, g.c)]);
  const pF = {};  // pF[node] = parent node (toward start)
  const pB = {};  // pB[node] = parent node (toward goal)
  pF[key(s.r, s.c)] = null;
  pB[key(g.r, g.c)] = null;

  function buildMergedPath(meetKey) {
    // Build path: start → meet
    const pathToMeet = [];
    let cur = meetKey;
    while (cur !== null && cur !== undefined) {
      pathToMeet.unshift(cur);
      cur = pF[cur];
    }
    // Build path: meet → goal (reverse backward parents)
    const pathFromMeet = [];
    let back = pB[meetKey];
    while (back !== null && back !== undefined) {
      pathFromMeet.push(back);
      back = pB[back];
    }
    return [...pathToMeet, ...pathFromMeet];
  }

  while (qF.length || qB.length) {
    stepCount++;

    // Forward step
    if (qF.length) {
      const { r, c } = qF.shift();
      const k = key(r, c);
      markCurrent(r, c); markVisited(r, c);
      log('step', `Bi-BFS [→] (${r},${c})`);

      if (vB.has(k)) {
        log('success', `Pertemuan di (${r},${c})!`);
        const path = buildMergedPath(k);
        emitPath(path);
        return 'DONE';
      }
      for (const n of getNeighbors(r, c)) {
        const nk = key(n.r, n.c);
        if (!vF.has(nk)) {
          vF.add(nk);
          pF[nk] = k;
          qF.push(n);
          markQueued(n.r, n.c);
        }
      }
    }

    // Backward step
    if (qB.length) {
      const { r, c } = qB.shift();
      const k = key(r, c);
      markCurrent(r, c); markVisited(r, c);
      log('step', `Bi-BFS [←] (${r},${c})`);

      if (vF.has(k)) {
        log('success', `Pertemuan di (${r},${c})!`);
        const path = buildMergedPath(k);
        emitPath(path);
        return 'DONE';
      }
      for (const n of getNeighbors(r, c)) {
        const nk = key(n.r, n.c);
        if (!vB.has(nk)) {
          vB.add(nk);
          pB[nk] = k;
          qB.push(n);
          markQueued(n.r, n.c);
        }
      }
    }

    setQueue([...qF, ...qB]);
    yield;
  }
  emitNoPath();
}

function* gen_Greedy(s, g) {
  const visited = new Set();
  const parent  = {};
  const pq      = [{ r: s.r, c: s.c, h: heuristic(s.r, s.c, g.r, g.c) }];

  while (pq.length) {
    pq.sort((a, b) => a.h - b.h);
    const { r, c } = pq.shift();
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    const h = Math.round(heuristic(r, c, g.r, g.c) * 10) / 10;
    log('step', `Greedy → (${r},${c}) h=${h}`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    for (const n of getNeighbors(r, c)) {
      const nk = key(n.r, n.c);
      if (!visited.has(nk)) {
        parent[nk] = key(r, c);
        pq.push({ ...n, h: heuristic(n.r, n.c, g.r, g.c) });
        markQueued(n.r, n.c);
      }
    }
    setQueue(pq);
    yield;
  }
  emitNoPath();
}

function* gen_AStar(s, g, w) {
  const visited = new Set();
  const parent  = {};
  const gScore  = {};
  gScore[key(s.r, s.c)] = 0;
  const pq      = [{ r: s.r, c: s.c, g: 0, f: w * heuristic(s.r, s.c, g.r, g.c) }];
  // Expose gScore untuk markCurrent info panel
  gen_AStar._gScore = gScore;

  while (pq.length) {
    pq.sort((a, b) => a.f - b.f);
    const { r, c, g: gv } = pq.shift();
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    const h = Math.round(heuristic(r, c, g.r, g.c) * 10) / 10;
    log('step', `${w !== 1 ? `wA*(${w})` : 'A*'} → (${r},${c}) g=${gv} h=${h} f=${Math.round((gv + w * h) * 10) / 10}`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    for (const n of getNeighbors(r, c)) {
      const nk = key(n.r, n.c);
      const ng = gv + 1;
      // Fix: gunakan === undefined agar cost 0 tidak dianggap falsy
      if (gScore[nk] === undefined || ng < gScore[nk]) {
        gScore[nk]  = ng;
        parent[nk]  = key(r, c);
        pq.push({ ...n, g: ng, f: ng + w * heuristic(n.r, n.c, g.r, g.c) });
        markQueued(n.r, n.c);
      }
    }
    setQueue(pq);
    yield;
  }
  emitNoPath();
}

function* gen_IDAStar(s, g) {
  let threshold = heuristic(s.r, s.c, g.r, g.c);

  while (threshold < Infinity) {
    log('warn', `IDA* → threshold=${Math.round(threshold * 10) / 10}`);

    // Clear sebelum iterasi baru
    for (let r = 0; r < workerRows; r++)
      for (let c = 0; c < workerCols; c++)
        if (workerGrid[r][c] === 'visited' || workerGrid[r][c] === 'queued') {
          workerGrid[r][c] = 'unvisited';
          pendingCells.set(key(r, c), 'unvisited');
        }

    const iterVisited  = new Set();
    const actualPath   = [];
    const stack        = [{ r: s.r, c: s.c, gVal: 0 }];
    let   nextThresh   = Infinity;

    while (stack.length) {
      const cur = stack.pop();
      if (cur.isBacktrack) {
        iterVisited.delete(key(cur.r, cur.c));
        actualPath.pop();
        continue;
      }
      const { r, c, gVal } = cur;
      const k = key(r, c);
      const f = gVal + heuristic(r, c, g.r, g.c);
      if (f > threshold) { nextThresh = Math.min(nextThresh, f); continue; }
      if (iterVisited.has(k)) continue;
      iterVisited.add(k);
      actualPath.push(k);
      stack.push({ isBacktrack: true, r, c });
      stepCount++;
      markCurrent(r, c); markVisited(r, c);
      log('step', `IDA* → (${r},${c}) f=${Math.round(f * 10) / 10}`);

      if (r === g.r && c === g.c) {
        const pm = {};
        for (let i = 1; i < actualPath.length; i++) pm[actualPath[i]] = actualPath[i - 1];
        emitPath(tracePathMap(pm, r, c));
        return 'DONE';
      }

      for (const n of getNeighbors(r, c).reverse()) {
        const nk = key(n.r, n.c);
        if (!iterVisited.has(nk)) stack.push({ ...n, gVal: gVal + 1 });
      }
      setQueue(stack.filter(x => !x.isBacktrack));
      yield;
    }

    if (nextThresh === Infinity) break;
    threshold = nextThresh;
  }
  emitNoPath();
}

function* gen_Beam(s, g) {
  const visited = new Set([key(s.r, s.c)]);
  const parent  = {};
  const W       = workerBeamWidth;
  let   beam    = [{ r: s.r, c: s.c, h: heuristic(s.r, s.c, g.r, g.c) }];

  while (beam.length) {
    stepCount++;
    const nextGen = [];

    for (const cur of beam) {
      const { r, c } = cur;
      const k = key(r, c);
      markCurrent(r, c); markVisited(r, c);
      log('step', `Beam[W=${W}] → (${r},${c}) h=${Math.round(cur.h * 10) / 10}`);

      if (r === g.r && c === g.c) {
        emitPath(tracePath(parent, r, c));
        return 'DONE';
      }

      for (const n of getNeighbors(r, c)) {
        const nk = key(n.r, n.c);
        if (!visited.has(nk)) {
          visited.add(nk);
          parent[nk] = key(r, c);
          nextGen.push({ ...n, h: heuristic(n.r, n.c, g.r, g.c) });
          markQueued(n.r, n.c);
        }
      }
    }

    if (!nextGen.length) break;
    nextGen.sort((a, b) => a.h - b.h);
    beam = nextGen.slice(0, W);
    setQueue(beam);
    yield;
  }
  emitNoPath();
}

function* gen_HC(s, g, steepest) {
  const visited = new Set([key(s.r, s.c)]);
  const parent  = {};
  let   cur     = { r: s.r, c: s.c };

  while (true) {
    stepCount++;
    const { r, c } = cur;
    markCurrent(r, c); markVisited(r, c);
    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    const nbrs   = getNeighbors(r, c).filter(n => !visited.has(key(n.r, n.c)));
    const curH   = heuristic(r, c, g.r, g.c);

    if (!nbrs.length) break;

    let next;
    if (steepest) {
      nbrs.sort((a, b) => heuristic(a.r, a.c, g.r, g.c) - heuristic(b.r, b.c, g.r, g.c));
      next = nbrs[0];
      if (heuristic(next.r, next.c, g.r, g.c) >= curH) break;
    } else {
      next = nbrs.find(n => heuristic(n.r, n.c, g.r, g.c) < curH);
      if (!next) break;
    }

    const nk = key(next.r, next.c);
    visited.add(nk);
    parent[nk] = key(r, c);
    markQueued(next.r, next.c);
    log('step', `${steepest ? 'Steepest' : ''} HC → (${next.r},${next.c}) h=${Math.round(heuristic(next.r, next.c, g.r, g.c) * 10) / 10}`);
    cur = next;
    yield;
  }
  emitNoPath();
}

function* gen_SA(s, g) {
  let cur      = { r: s.r, c: s.c };
  let temp     = 200;
  const cool   = 0.995;
  const path   = [key(s.r, s.c)];

  while (temp > 0.001) {
    stepCount++;
    const { r, c } = cur;
    markCurrent(r, c); markVisited(r, c);
    temp *= cool;

    if (r === g.r && c === g.c) {
      const pm = {};
      for (let i = 1; i < path.length; i++) pm[path[i]] = path[i - 1];
      emitPath(tracePathMap(pm, r, c));
      return 'DONE';
    }

    const nbrs = getNeighbors(r, c);
    if (!nbrs.length) break;
    const next  = nbrs[Math.floor(Math.random() * nbrs.length)];
    const dE    = heuristic(r, c, g.r, g.c) - heuristic(next.r, next.c, g.r, g.c);
    const accept = dE > 0 || Math.random() < Math.exp(dE / (temp * 0.1));

    if (accept) {
      path.push(key(next.r, next.c));
      markQueued(next.r, next.c);
      cur = next;
    }
    log('step', `SA T=${temp.toFixed(2)} → (${next.r},${next.c}) ΔE=${dE.toFixed(2)} ${accept ? '✓' : '✗'}`);
    yield;
  }
  emitNoPath();
}

function* gen_Tabu(s, g) {
  let cur        = { r: s.r, c: s.c };
  const tabuList = [key(s.r, s.c)];
  const TMAX     = 15;
  const path     = [key(s.r, s.c)];

  for (let iter = 0; iter < workerRows * workerCols * 3; iter++) {
    stepCount++;
    const { r, c } = cur;
    markCurrent(r, c); markVisited(r, c);

    if (r === g.r && c === g.c) {
      const pm = {};
      for (let i = 1; i < path.length; i++) pm[path[i]] = path[i - 1];
      emitPath(tracePathMap(pm, r, c));
      return 'DONE';
    }

    const nbrs = getNeighbors(r, c).filter(n => !tabuList.includes(key(n.r, n.c)));
    if (!nbrs.length) break;
    nbrs.sort((a, b) => heuristic(a.r, a.c, g.r, g.c) - heuristic(b.r, b.c, g.r, g.c));
    const best = nbrs[0];
    const bk   = key(best.r, best.c);
    path.push(bk);
    tabuList.push(bk);
    if (tabuList.length > TMAX) tabuList.shift();
    markQueued(best.r, best.c);
    log('step', `Tabu → (${best.r},${best.c}) | Tabu:${tabuList.length}`);
    cur = best;
    yield;
  }
  emitNoPath();
}

function* gen_Genetic(s, g) {
  const POP_SIZE = 20;
  const MAX_GEN  = 200;

  function randPath() {
    const p = [{ r: s.r, c: s.c }];
    let c2 = { r: s.r, c: s.c };
    const vis = new Set([key(c2.r, c2.c)]);
    for (let j = 0; j < 40; j++) {
      const nbrs = getNeighbors(c2.r, c2.c).filter(n => !vis.has(key(n.r, n.c)));
      if (!nbrs.length) break;
      const nx = nbrs[Math.floor(Math.random() * nbrs.length)];
      p.push(nx); c2 = nx; vis.add(key(nx.r, nx.c));
      if (nx.r === g.r && nx.c === g.c) break;
    }
    const last = p[p.length - 1];
    return { path: p, fitness: p.length + heuristic(last.r, last.c, g.r, g.c) * 5 };
  }

  let population = Array.from({ length: POP_SIZE }, randPath);
  let bestEver   = null;

  for (let gen = 0; gen < MAX_GEN; gen++) {
    stepCount++;
    population.sort((a, b) => a.fitness - b.fitness);
    const best = population[0];
    if (!bestEver || best.fitness < bestEver.fitness) bestEver = { ...best, path: [...best.path] };

    // Clear & draw best path
    for (let r = 0; r < workerRows; r++)
      for (let c = 0; c < workerCols; c++)
        if (workerGrid[r][c] === 'visited' || workerGrid[r][c] === 'current' || workerGrid[r][c] === 'queued') {
          workerGrid[r][c] = 'unvisited'; pendingCells.set(key(r, c), 'unvisited');
        }

    bestEver.path.forEach(p => {
      if (workerGrid[p.r][p.c] !== 'start' && workerGrid[p.r][p.c] !== 'goal') {
        workerGrid[p.r][p.c] = 'visited'; pendingCells.set(key(p.r, p.c), 'visited');
      }
    });

    const last = bestEver.path[bestEver.path.length - 1];
    if (workerGrid[last.r][last.c] !== 'start' && workerGrid[last.r][last.c] !== 'goal') {
      workerGrid[last.r][last.c] = 'current'; pendingCells.set(key(last.r, last.c), 'current');
    }

    visitedCount = gen * POP_SIZE;
    log('step', `GA Gen ${gen} | Best fitness: ${bestEver.fitness.toFixed(2)}`);

    if (last.r === g.r && last.c === g.c) {
      const pm = {};
      for (let i = 1; i < bestEver.path.length; i++)
        pm[key(bestEver.path[i].r, bestEver.path[i].c)] = key(bestEver.path[i - 1].r, bestEver.path[i - 1].c);
      emitPath(tracePathMap(pm, last.r, last.c));
      return 'DONE';
    }

    // Evolusi
    const newPop = [bestEver];
    while (newPop.length < POP_SIZE) {
      const p1 = population[Math.floor(Math.random() * 5)];
      const p2 = population[Math.floor(Math.random() * 5)];
      const p2Set = new Set(p2.path.map(p => key(p.r, p.c)));
      let childPath = [...p1.path];

      // Crossover
      let crossIdx = -1;
      for (let i = p1.path.length - 1; i > 0; i--) {
        if (p2Set.has(key(p1.path[i].r, p1.path[i].c))) { crossIdx = i; break; }
      }
      if (crossIdx !== -1 && Math.random() < 0.7) {
        const node = p1.path[crossIdx];
        const p2Idx = p2.path.findIndex(p => p.r === node.r && p.c === node.c);
        childPath = [...p1.path.slice(0, crossIdx), ...p2.path.slice(p2Idx)];
      }

      // Mutasi
      if (Math.random() < 0.3) {
        const mi = Math.floor(Math.random() * childPath.length);
        childPath = childPath.slice(0, mi + 1);
        let curN = childPath[mi];
        const vis = new Set(childPath.map(p => key(p.r, p.c)));
        for (let j = 0; j < 15; j++) {
          const nbrs = getNeighbors(curN.r, curN.c).filter(n => !vis.has(key(n.r, n.c)));
          if (!nbrs.length) break;
          curN = nbrs[Math.floor(Math.random() * nbrs.length)];
          childPath.push(curN); vis.add(key(curN.r, curN.c));
          if (curN.r === g.r && curN.c === g.c) break;
        }
      }
      const lastC = childPath[childPath.length - 1];
      newPop.push({ path: childPath, fitness: childPath.length + heuristic(lastC.r, lastC.c, g.r, g.c) * 5 });
    }
    population = newPop;
    yield;
  }
  emitNoPath();
}

function* gen_Minimax(s, g) {
  const DEPTH  = 4;
  const visited = new Set([key(s.r, s.c)]);
  const parent  = {};
  let   cur     = { r: s.r, c: s.c };

  function minimax(r, c, depth, isMax, pVis) {
    if (depth === 0 || (r === g.r && c === g.c)) return -heuristic(r, c, g.r, g.c);
    const nbrs = getNeighbors(r, c).filter(n => !visited.has(key(n.r, n.c)) && !pVis.has(key(n.r, n.c)));
    if (!nbrs.length) return -heuristic(r, c, g.r, g.c);
    let val = isMax ? -Infinity : Infinity;
    for (const n of nbrs) {
      pVis.add(key(n.r, n.c));
      const v = minimax(n.r, n.c, depth - 1, !isMax, pVis);
      pVis.delete(key(n.r, n.c));
      if (isMax) val = Math.max(val, v);
      else       val = Math.min(val, v);
    }
    return val;
  }

  for (let iter = 0; iter < workerRows * workerCols; iter++) {
    stepCount++;
    const { r, c } = cur;
    markCurrent(r, c); markVisited(r, c);
    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    const nbrs = getNeighbors(r, c).filter(n => !visited.has(key(n.r, n.c)));
    if (!nbrs.length) break;

    let bestVal = -Infinity, bestNext = null;
    for (const n of nbrs) {
      const pVis = new Set([key(n.r, n.c)]);
      const val  = minimax(n.r, n.c, DEPTH - 1, false, pVis);
      markQueued(n.r, n.c);
      if (val > bestVal) { bestVal = val; bestNext = n; }
    }
    if (!bestNext) break;
    const nk = key(bestNext.r, bestNext.c);
    parent[nk] = key(r, c);
    visited.add(nk);
    cur = bestNext;
    log('step', `Minimax → (${bestNext.r},${bestNext.c}) eval=${bestVal.toFixed(1)}`);
    yield;
  }
  emitNoPath();
}

function* gen_AlphaBeta(s, g) {
  const DEPTH   = 4;
  const visited = new Set([key(s.r, s.c)]);
  const parent  = {};
  let   cur     = { r: s.r, c: s.c };
  let   pruned  = 0;

  function ab(r, c, depth, alpha, beta, isMax, pVis) {
    if (depth === 0 || (r === g.r && c === g.c)) return -heuristic(r, c, g.r, g.c);
    const nbrs = getNeighbors(r, c).filter(n => !visited.has(key(n.r, n.c)) && !pVis.has(key(n.r, n.c)));
    if (!nbrs.length) return -heuristic(r, c, g.r, g.c);
    let val = isMax ? -Infinity : Infinity;
    for (const n of nbrs) {
      pVis.add(key(n.r, n.c));
      const v = ab(n.r, n.c, depth - 1, alpha, beta, !isMax, pVis);
      pVis.delete(key(n.r, n.c));
      if (isMax) { val = Math.max(val, v); alpha = Math.max(alpha, val); }
      else       { val = Math.min(val, v); beta  = Math.min(beta, val); }
      if (beta <= alpha) { pruned++; break; }
    }
    return val;
  }

  for (let iter = 0; iter < workerRows * workerCols; iter++) {
    stepCount++;
    const { r, c } = cur;
    markCurrent(r, c); markVisited(r, c);
    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    const nbrs = getNeighbors(r, c).filter(n => !visited.has(key(n.r, n.c)));
    if (!nbrs.length) break;

    let bestVal = -Infinity, bestNext = null;
    for (const n of nbrs) {
      const pVis = new Set([key(n.r, n.c)]);
      const val  = ab(n.r, n.c, DEPTH - 1, -Infinity, Infinity, false, pVis);
      markQueued(n.r, n.c);
      if (val > bestVal) { bestVal = val; bestNext = n; }
    }
    if (!bestNext) break;
    const nk = key(bestNext.r, bestNext.c);
    parent[nk] = key(r, c);
    visited.add(nk);
    cur = bestNext;
    log('step', `AlphaBeta → (${bestNext.r},${bestNext.c}) pruned=${pruned}`);
    yield;
  }
  emitNoPath();
}

function* gen_MCTS(s, g) {
  const MAX_ITER = 300;
  const root = { r: s.r, c: s.c, parentNode: null, children: [], visits: 0, wins: 0 };

  for (let iter = 0; iter < MAX_ITER; iter++) {
    stepCount++;

    // Selection via UCB1
    let node = root;
    while (node.children.length > 0 && node.children.every(ch => ch.visits > 0)) {
      let bestUcb = -Infinity, nextNode = null;
      for (const ch of node.children) {
        const ucb = (ch.wins / ch.visits) + 1.41 * Math.sqrt(Math.log(node.visits) / ch.visits);
        if (ucb > bestUcb) { bestUcb = ucb; nextNode = ch; }
      }
      node = nextNode || node.children[0];
    }

    markCurrent(node.r, node.c); markVisited(node.r, node.c);
    if (node.r === g.r && node.c === g.c) {
      const pm = {};
      let c2 = node;
      while (c2.parentNode) { pm[key(c2.r, c2.c)] = key(c2.parentNode.r, c2.parentNode.c); c2 = c2.parentNode; }
      emitPath(tracePathMap(pm, node.r, node.c));
      return 'DONE';
    }

    // Expansion
    if (node.visits > 0 || node === root) {
      let anc = node;
      const pathSet = new Set();
      while (anc) { pathSet.add(key(anc.r, anc.c)); anc = anc.parentNode; }
      node.children = getNeighbors(node.r, node.c)
        .filter(n => !pathSet.has(key(n.r, n.c)))
        .map(n => ({ ...n, parentNode: node, children: [], visits: 0, wins: 0 }));
    }

    // Simulation
    let sr = node.r, sc = node.c;
    const simVis = new Set([key(sr, sc)]);
    for (let i = 0; i < 40; i++) {
      if (sr === g.r && sc === g.c) break;
      const nbrs = getNeighbors(sr, sc).filter(n => !simVis.has(key(n.r, n.c)));
      if (!nbrs.length) break;
      const nx = nbrs[Math.floor(Math.random() * nbrs.length)];
      sr = nx.r; sc = nx.c; simVis.add(key(sr, sc));
    }

    // Backprop
    const dist  = heuristic(sr, sc, g.r, g.c);
    const score = dist === 0 ? 1 : 1 / (1 + dist);
    let anc = node;
    while (anc) { anc.visits++; anc.wins += score; anc = anc.parentNode; }
    log('step', `MCTS iter=${iter} | node(${node.r},${node.c}) sim_dist=${dist.toFixed(1)}`);
    yield;
  }
  emitNoPath();
}

function* gen_Backtracking(s, g) {
  const visited = new Set([key(s.r, s.c)]);
  const parent  = {};
  const stack   = [{ r: s.r, c: s.c }];

  while (stack.length) {
    const { r, c } = stack.pop();
    const k = key(r, c);
    if (!visited.has(k)) continue; // already popped means already processed
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    log('step', `BT → (${r},${c}) | Stack:${stack.length}`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    for (const n of getNeighbors(r, c).reverse()) {
      const nk = key(n.r, n.c);
      if (!visited.has(nk)) {
        visited.add(nk);
        parent[nk] = key(r, c);
        stack.push(n);
        markQueued(n.r, n.c);
      }
    }
    setQueue(stack);
    yield;
  }
  emitNoPath();
}

function* gen_ACO(s, g) {
  const NUM_ANTS = 8;
  const MAX_ITER = 200;
  const pheromone = {};

  let bestPath = null;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    stepCount++;
    // Buat semut baru
    const ants = Array.from({ length: NUM_ANTS }, () => ({
      r: s.r, c: s.c,
      path:    [key(s.r, s.c)],
      visited: new Set([key(s.r, s.c)]),
      done: false
    }));

    // Jalankan semua semut
    for (let step = 0; step < workerRows * workerCols; step++) {
      let allDone = true;
      for (const ant of ants) {
        if (ant.done) continue;
        allDone = false;
        const [cr, cc] = ant.path[ant.path.length - 1].split(',').map(Number);
        markCurrent(cr, cc); markVisited(cr, cc);

        if (cr === g.r && cc === g.c) { ant.done = true; continue; }
        const nbrs = getNeighbors(cr, cc).filter(n => !ant.visited.has(key(n.r, n.c)));
        if (!nbrs.length) { ant.done = true; continue; }

        let probs = [], sum = 0;
        const curKey = key(cr, cc);
        for (const n of nbrs) {
          const ek = `${curKey}-${key(n.r, n.c)}`;
          const tau = pheromone[ek] || 1;
          const eta = 1 / (1 + heuristic(n.r, n.c, g.r, g.c));
          const p   = tau * eta * eta;
          probs.push({ n, p }); sum += p;
        }
        let rnd = Math.random() * sum, next = nbrs[0];
        for (const pr of probs) { rnd -= pr.p; if (rnd <= 0) { next = pr.n; break; } }
        const nk = key(next.r, next.c);
        ant.path.push(nk); ant.visited.add(nk);
        markQueued(next.r, next.c);
      }
      if (allDone) break;
    }

    // Deposit feromon
    for (const ant of ants) {
      const len = ant.path.length;
      const [lr, lc] = ant.path[len - 1].split(',').map(Number);
      const atGoal   = (lr === g.r && lc === g.c);
      if (!bestPath || (atGoal && len < bestPath.length)) bestPath = [...ant.path];
      const deposit = atGoal ? (100 / len) : (1 / (heuristic(lr, lc, g.r, g.c) + 1));
      for (let i = 0; i < len - 1; i++) {
        const ek = `${ant.path[i]}-${ant.path[i + 1]}`;
        pheromone[ek] = ((pheromone[ek] || 0) + deposit) * 0.9;
      }
    }

    log('step', `ACO iter=${iter} | Best path: ${bestPath ? bestPath.length : '-'}`);
    yield;
  }

  if (bestPath) {
    const pm = {};
    for (let i = 1; i < bestPath.length; i++) pm[bestPath[i]] = bestPath[i - 1];
    const [lr, lc] = bestPath[bestPath.length - 1].split(',').map(Number);
    emitPath(tracePathMap(pm, lr, lc));
    return 'DONE';
  }
  emitNoPath();
}

function* gen_JPS(s, g) {
  const visited = new Set();
  const parent  = {};
  const gScore  = { [key(s.r, s.c)]: 0 };
  const pq      = [{ r: s.r, c: s.c, g: 0, f: heuristic(s.r, s.c, g.r, g.c) }];

  function jump(r, c, dr, dc) {
    while (true) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= workerRows || nc < 0 || nc >= workerCols || workerGrid[nr][nc] === 'wall') return null;
      if (nr === g.r && nc === g.c) return { r: nr, c: nc };
      if (dr !== 0) {
        if ((nc + 1 < workerCols && workerGrid[r][nc + 1] === 'wall' && workerGrid[nr][nc + 1] !== 'wall') ||
            (nc - 1 >= 0         && workerGrid[r][nc - 1] === 'wall' && workerGrid[nr][nc - 1] !== 'wall'))
          return { r: nr, c: nc };
      } else {
        if ((nr + 1 < workerRows && workerGrid[nr + 1][c] === 'wall' && workerGrid[nr + 1][nc] !== 'wall') ||
            (nr - 1 >= 0         && workerGrid[nr - 1][c] === 'wall' && workerGrid[nr - 1][nc] !== 'wall'))
          return { r: nr, c: nc };
      }
      r = nr; c = nc;
    }
  }

  while (pq.length) {
    pq.sort((a, b) => a.f - b.f);
    const { r, c, g: gv } = pq.shift();
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    log('step', `JPS → (${r},${c}) f=${Math.round((gv + heuristic(r, c, g.r, g.c)) * 10) / 10}`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    for (const [dr, dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
      const jp = jump(r, c, dr, dc);
      if (jp) {
        const jpk = key(jp.r, jp.c);
        const ng  = gv + Math.abs(jp.r - r) + Math.abs(jp.c - c);
        if (gScore[jpk] === undefined || ng < gScore[jpk]) {
          gScore[jpk]  = ng;
          parent[jpk]  = key(r, c);
          pq.push({ ...jp, g: ng, f: ng + heuristic(jp.r, jp.c, g.r, g.c) });
          markQueued(jp.r, jp.c);
        }
      }
    }
    setQueue(pq);
    yield;
  }
  emitNoPath();
}

function* gen_GarisLintang(s, g) {
  const visited = new Set();
  const parent  = {};
  const gScore  = { [key(s.r, s.c)]: 0 };
  const K       = 2.5; // penalti cross-track
  const pq      = [{ r: s.r, c: s.c, g: 0, f: heuristic(s.r, s.c, g.r, g.c) }];

  while (pq.length) {
    pq.sort((a, b) => a.f - b.f);
    const { r, c, g: gv } = pq.shift();
    const k = key(r, c);
    if (visited.has(k)) continue;
    visited.add(k);
    stepCount++;
    markCurrent(r, c); markVisited(r, c);
    log('step', `GarisLintang → (${r},${c}) f=${Math.round(pq[0]?.f ?? 0, 1)}`);

    if (r === g.r && c === g.c) {
      emitPath(tracePath(parent, r, c));
      return 'DONE';
    }

    const dx = g.c - s.c, dy = g.r - s.r;
    const denom = Math.sqrt(dx * dx + dy * dy) || 1;

    for (const n of getNeighbors(r, c)) {
      const nk = key(n.r, n.c);
      const ng = (gv || 0) + 1;
      if (gScore[nk] === undefined || ng < gScore[nk]) {
        gScore[nk] = ng;
        parent[nk] = key(r, c);
        const dGoal = Math.sqrt((n.r - g.r) ** 2 + (n.c - g.c) ** 2);
        const cross = Math.abs(dx * (s.r - n.r) - (s.c - n.c) * dy) / denom;
        pq.push({ ...n, g: ng, f: dGoal + K * cross });
        markQueued(n.r, n.c);
      }
    }
    setQueue(pq);
    yield;
  }
  emitNoPath();
}
