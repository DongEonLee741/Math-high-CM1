/**
 * tictactoe-app.js — 위상 틱택토 대전 + 분석 모듈
 *
 * 레퍼런스: 위상 틱택토팩 하이브리드(2.15.).html
 *
 * API:
 *   initTicTacToe(containerEl, options) — 대전 위젯
 *   initAnalyzer(containerEl, options)  — 분석기 (grid-renderer 래핑)
 *
 * 유틸리티 (export):
 *   getGhostTiles, buildGlobalGrid, getEdgeArrowConfig, ID, FLIP_V
 */

import { createGridRenderer } from './grid-renderer.js';

// ─── 순열 상수 ───
export const ID     = [0,1,2,3,4,5,6,7,8];
export const FLIP_V = [6,7,8, 3,4,5, 0,1,2];

// ─── 2D 타일 레이아웃 상수 ───
const CELL_PX    = 100;       // 셀 한 변 크기 (px)
const GRID_LINE  = 2;         // 격자선 두께
const TILE_BORDER = 2;        // 타일 테두리 두께
const TILE_SIZE  = 3 * CELL_PX + 2 * GRID_LINE + 2 * TILE_BORDER;
const TILE_GAP   = 8;
const CELL_2D    = TILE_SIZE + TILE_GAP;

// ─── Edge Arrow 색상 ───
const ORANGE = '#f97316';
const PURPLE = '#a855f7';

// ════════════════════════════════════════════
// 유틸리티 함수
// ════════════════════════════════════════════

/**
 * 모드별 유령 타일 배치를 반환한다.
 * @param {string} mode - 'plain'|'cylinder'|'torus'|'mobius'
 * @returns {Array<{dr:number, dc:number, perm:number[]}>}
 */
export function getGhostTiles(mode) {
  if (mode === 'cylinder') {
    return [
      { dr: 0, dc: -1, perm: ID },
      { dr: 0, dc:  1, perm: ID },
    ];
  } else if (mode === 'torus') {
    return [
      { dr:-1, dc:-1, perm: ID }, { dr:-1, dc:0, perm: ID }, { dr:-1, dc:1, perm: ID },
      { dr: 0, dc:-1, perm: ID },                             { dr: 0, dc:1, perm: ID },
      { dr: 1, dc:-1, perm: ID }, { dr: 1, dc:0, perm: ID }, { dr: 1, dc:1, perm: ID },
    ];
  } else if (mode === 'mobius') {
    return [
      { dr: 0, dc: -1, perm: FLIP_V },
      { dr: 0, dc:  1, perm: FLIP_V },
    ];
  }
  return []; // plain
}

/**
 * 글로벌 그리드를 구축한다 (승리 판정용).
 * @param {string} mode
 * @param {Array<number|null>} board - 길이 9, 0-indexed, 1=O 2=X null=빈칸
 * @returns {{G: Array, rMin: number, cMin: number, invPerms: Map}}
 */
export function buildGlobalGrid(mode, board) {
  const ghosts = getGhostTiles(mode);
  const tiles = [{ dr: 0, dc: 0, perm: null }, ...ghosts];

  const rVals = tiles.map(t => t.dr);
  const cVals = tiles.map(t => t.dc);
  const rMin = Math.min(...rVals), rMax = Math.max(...rVals);
  const cMin = Math.min(...cVals), cMax = Math.max(...cVals);

  const H = (rMax - rMin + 1) * 3;
  const W = (cMax - cMin + 1) * 3;
  const G = Array.from({ length: H }, () => Array(W).fill(null));

  const invPerms = new Map();
  for (const t of tiles) {
    const key = `${t.dr},${t.dc}`;
    if (t.perm) {
      const inv = new Array(9);
      for (let i = 0; i < 9; i++) inv[t.perm[i]] = i;
      invPerms.set(key, inv);
    } else {
      invPerms.set(key, null);
    }
  }

  for (const { dr, dc, perm } of tiles) {
    for (let i = 0; i < 9; i++) {
      const v = board[i];
      if (v === null) continue;
      const j = perm ? perm[i] : i;
      const baseRow = (dr - rMin) * 3;
      const baseCol = (dc - cMin) * 3;
      const y = baseRow + Math.floor(j / 3);
      const x = baseCol + (j % 3);
      G[y][x] = v;
    }
  }

  return { G, rMin, cMin, invPerms };
}

/**
 * 기본 도형 표현법 화살표 설정을 반환한다.
 * @param {string} mode
 * @returns {{left:Object|null, right:Object|null, top:Object|null, bottom:Object|null}}
 */
export function getEdgeArrowConfig(mode) {
  const cfg = { left: null, right: null, top: null, bottom: null };
  if (mode === 'cylinder') {
    cfg.left  = { dir: 'up',   color: ORANGE };
    cfg.right = { dir: 'up',   color: ORANGE };
  } else if (mode === 'torus') {
    cfg.left   = { dir: 'up',    color: ORANGE };
    cfg.right  = { dir: 'up',    color: ORANGE };
    cfg.top    = { dir: 'right', color: PURPLE };
    cfg.bottom = { dir: 'right', color: PURPLE };
  } else if (mode === 'mobius') {
    cfg.left  = { dir: 'up',   color: ORANGE };
    cfg.right = { dir: 'down', color: ORANGE };
  }
  return cfg;
}

// ─── Edge Arrow SVG 생성 ───
function createArrowSVG(dir, color, arrowLength) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const len = arrowLength || 60;
  const hw = 10;     // 삼각형 머리 반폭
  const hlen = 16;   // 삼각형 머리 길이
  const sw = 4;      // 선 두께

  const line = document.createElementNS(ns, 'line');
  const head = document.createElementNS(ns, 'polygon');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', String(sw));
  line.setAttribute('stroke-linecap', 'round');
  head.setAttribute('fill', color);

  if (dir === 'up') {
    svg.setAttribute('viewBox', `0 0 ${hw * 2} ${len}`);
    svg.setAttribute('width', String(hw * 2));
    svg.setAttribute('height', String(len));
    line.setAttribute('x1', hw); line.setAttribute('y1', len);
    line.setAttribute('x2', hw); line.setAttribute('y2', hlen);
    head.setAttribute('points', `0,${hlen} ${hw},0 ${hw * 2},${hlen}`);
  } else if (dir === 'down') {
    svg.setAttribute('viewBox', `0 0 ${hw * 2} ${len}`);
    svg.setAttribute('width', String(hw * 2));
    svg.setAttribute('height', String(len));
    line.setAttribute('x1', hw); line.setAttribute('y1', 0);
    line.setAttribute('x2', hw); line.setAttribute('y2', len - hlen);
    head.setAttribute('points', `0,${len - hlen} ${hw},${len} ${hw * 2},${len - hlen}`);
  } else if (dir === 'right') {
    svg.setAttribute('viewBox', `0 0 ${len} ${hw * 2}`);
    svg.setAttribute('width', String(len));
    svg.setAttribute('height', String(hw * 2));
    line.setAttribute('x1', 0); line.setAttribute('y1', hw);
    line.setAttribute('x2', len - hlen); line.setAttribute('y2', hw);
    head.setAttribute('points', `${len - hlen},0 ${len},${hw} ${len - hlen},${hw * 2}`);
  } else if (dir === 'left') {
    svg.setAttribute('viewBox', `0 0 ${len} ${hw * 2}`);
    svg.setAttribute('width', String(len));
    svg.setAttribute('height', String(hw * 2));
    line.setAttribute('x1', len); line.setAttribute('y1', hw);
    line.setAttribute('x2', hlen); line.setAttribute('y2', hw);
    head.setAttribute('points', `${hlen},0 0,${hw} ${hlen},${hw * 2}`);
  }

  svg.appendChild(line);
  svg.appendChild(head);
  svg.style.display = 'block';
  return svg;
}

// ════════════════════════════════════════════
// CSS 주입 (한 번만)
// ════════════════════════════════════════════
let styleInjected = false;
function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const css = `
/* ─── 틱택토 위젯 스타일 ─── */
.ttt-widget { position: relative; width: 100%; font-family: -apple-system, sans-serif; }
.ttt-widget * { box-sizing: border-box; }

/* 컨트롤 바 */
.ttt-controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.ttt-controls button {
  padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px;
  background: #fff; cursor: pointer; font-size: 0.9rem; transition: all 0.15s;
}
.ttt-controls button:hover { background: #eff6ff; border-color: #2563eb; }
.ttt-controls button.primary {
  background: #2563eb; color: #fff; border-color: #2563eb;
}
.ttt-controls button.primary:hover { background: #1d4ed8; }

/* 상태 표시 */
.ttt-status {
  text-align: center; padding: 8px; font-size: 1rem; font-weight: 600;
  border-radius: 8px; margin-bottom: 12px; background: #f8fafc; color: #475569;
}
.ttt-status.p1 { background: #eff6ff; color: #2563eb; }
.ttt-status.p2 { background: #fef2f2; color: #ef4444; }

/* 2D 보드 뷰포트 */
.ttt-viewport {
  position: relative; overflow: hidden; border-radius: 12px;
  border: 2px solid #e2e8f0; background: #f0f4f8;
  touch-action: none; cursor: grab;
}
.ttt-viewport:active { cursor: grabbing; }

/* 보드 컨테이너 (드래그 이동) */
.ttt-board-container {
  position: absolute; display: grid;
}

/* 타일 (3×3 한 세트) */
.ttt-tile {
  display: grid; grid-template-columns: repeat(3, ${CELL_PX}px);
  grid-template-rows: repeat(3, ${CELL_PX}px);
  gap: ${GRID_LINE}px;
  border: ${TILE_BORDER}px solid #333; border-radius: 4px;
  background: #333;
}
.ttt-tile.ghost { opacity: 0.45; border-color: #999; background: #999; }
.ttt-tile.center { opacity: 1; border-color: #333; background: #333; }

/* 셀 */
.ttt-cell {
  display: flex; align-items: center; justify-content: center;
  background: #fff; cursor: pointer; font-size: 2.2rem; font-weight: bold;
  transition: background 0.12s;
  user-select: none; -webkit-user-select: none;
}
.ttt-cell:hover { background: #f8fafc; }
.ttt-cell.o { color: #3b82f6; }
.ttt-cell.x { color: #ef4444; }
.ttt-cell.win { background: #fef08a !important; }

/* Edge Arrow 컨테이너 */
.ttt-edge-arrow { position: absolute; pointer-events: none; z-index: 5; }

/* 3D 영역 */
.ttt-3d-container {
  width: 100%; aspect-ratio: 1/1; max-width: 440px;
  margin: 0 auto; border-radius: 12px; overflow: hidden;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  display: none;
}
.ttt-3d-container.active { display: block; }

/* 모드 선택 버튼 */
.ttt-mode-btn {
  padding: 12px 20px; border: 2px solid #e2e8f0; border-radius: 12px;
  background: #fff; cursor: pointer; font-size: 1rem; font-weight: 500;
  transition: all 0.15s; text-align: center;
}
.ttt-mode-btn:hover { border-color: #2563eb; background: #eff6ff; }
.ttt-mode-btn.active { border-color: #2563eb; background: #2563eb; color: #fff; }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}


// ════════════════════════════════════════════
// TicTacToeGame 클래스
// ════════════════════════════════════════════

class TicTacToeGame {
  constructor(containerEl, options = {}) {
    injectStyles();
    this.container = containerEl;
    this.mode = options.mode || 'plain';
    this.enable3D = options.enable3D !== false;
    this.onMove = options.onMove || null;
    this.onGameEnd = options.onGameEnd || null;
    this.showModeSelect = options.showModeSelect || false;

    // 게임 상태
    this.board = Array(9).fill(null);
    this.currentPlayer = 1;
    this.gameActive = false;
    this.gameOver = false;
    this.currentView = '2d';

    // 드래그 상태
    this.boardOffset = { x: 0, y: 0 };
    this.dragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.clickStart = { x: 0, y: 0 };
    this.isClick = true;

    // 3D 상태
    this.threeLoaded = false;
    this.scene = null;
    this.camera = null;
    this.renderer3d = null;
    this.gameObject = null;
    this.texture = null;
    this.textureCanvas = null;
    this.textureCtx = null;
    this.spherical = { radius: 8, theta: Math.PI / 4, phi: Math.PI / 3 };
    this.animFrameId = null;

    // DOM 참조
    this.els = {};

    this._build();
    this._createBoard();
  }

  // ─── Public API ───

  /** 게임을 시작한다. */
  start() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 1;
    this.gameActive = true;
    this.gameOver = false;
    this._switchTo2D();
    this._updateBoard();
    this._setStatus(`Player 1 차례 (O)`, 1);
    if (this.els.btn3d) this.els.btn3d.style.display = 'none';
  }

  /** 게임을 리셋한다. */
  reset() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 1;
    this.gameActive = false;
    this.gameOver = false;
    this._switchTo2D();
    this._updateBoard();
    this._setStatus('게임 시작을 눌러주세요', 0);
    if (this.els.btn3d) this.els.btn3d.style.display = 'none';
  }

  /** 모드를 변경한다. */
  setMode(mode) {
    this.mode = mode;
    this.reset();
    this._cleanup3D();
    this.els.boardContainer.innerHTML = '';
    this._createBoard();
  }

  /** 위젯을 제거한다. */
  destroy() {
    this._cleanup3D();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.container.innerHTML = '';
  }

  /** 현재 보드 상태를 반환한다. */
  getBoard() {
    return [...this.board];
  }

  // ─── DOM 생성 ───

  _build() {
    this.container.innerHTML = '';
    const w = document.createElement('div');
    w.className = 'ttt-widget';

    // 컨트롤 바
    const controls = document.createElement('div');
    controls.className = 'ttt-controls';

    const btnStart = document.createElement('button');
    btnStart.className = 'primary';
    btnStart.textContent = '게임 시작';
    btnStart.addEventListener('click', () => this.start());
    controls.appendChild(btnStart);

    const btnReset = document.createElement('button');
    btnReset.textContent = '리셋';
    btnReset.addEventListener('click', () => this.reset());
    controls.appendChild(btnReset);

    if (this.enable3D && this.mode !== 'plain') {
      const btn3d = document.createElement('button');
      btn3d.textContent = '3D 전환하기';
      btn3d.style.display = 'none';
      btn3d.addEventListener('click', () => this._toggle3D());
      controls.appendChild(btn3d);
      this.els.btn3d = btn3d;
    }

    w.appendChild(controls);

    // 상태
    const status = document.createElement('div');
    status.className = 'ttt-status';
    status.textContent = '게임 시작을 눌러주세요';
    this.els.status = status;
    w.appendChild(status);

    // 2D 뷰포트
    const vpSize = Math.min(440, window.innerWidth - 40);
    const viewport = document.createElement('div');
    viewport.className = 'ttt-viewport';
    viewport.style.width = vpSize + 'px';
    viewport.style.height = vpSize + 'px';
    viewport.style.margin = '0 auto';
    this.els.viewport = viewport;

    const boardContainer = document.createElement('div');
    boardContainer.className = 'ttt-board-container';
    this.els.boardContainer = boardContainer;
    viewport.appendChild(boardContainer);
    w.appendChild(viewport);

    // 3D 컨테이너
    if (this.enable3D && this.mode !== 'plain') {
      const container3d = document.createElement('div');
      container3d.className = 'ttt-3d-container';
      this.els.container3d = container3d;
      w.appendChild(container3d);
    }

    this.container.appendChild(w);

    // 드래그 이벤트 설정
    if (this.mode !== 'plain') {
      this._setupDrag();
    }
  }

  // ─── 2D 타일 보드 ───

  _createBoard() {
    const bc = this.els.boardContainer;
    bc.innerHTML = '';

    if (this.mode === 'plain') {
      // 평면: 단일 타일만 (유령 타일 없음)
      bc.style.gridTemplateColumns = `${TILE_SIZE}px`;
      bc.style.gridTemplateRows = `${TILE_SIZE}px`;
      bc.style.gap = '0px';

      const tile = this._createTile(0, 0, false);
      bc.appendChild(tile);

      // 중앙 정렬
      const vpSize = this.els.viewport.clientWidth;
      this.boardOffset.x = (vpSize - TILE_SIZE) / 2;
      this.boardOffset.y = (vpSize - TILE_SIZE) / 2;
      this._updateBoardPosition();
      return;
    }

    // 위상별 타일 크기
    let tilesX, tilesY;
    if (this.mode === 'cylinder' || this.mode === 'mobius') {
      tilesX = 5; tilesY = 1;
    } else if (this.mode === 'torus') {
      tilesX = 5; tilesY = 5;
    }

    const centerX = Math.floor(tilesX / 2);
    const centerY = Math.floor(tilesY / 2);

    bc.style.gridTemplateColumns = `repeat(${tilesX}, ${TILE_SIZE}px)`;
    bc.style.gridTemplateRows = `repeat(${tilesY}, ${TILE_SIZE}px)`;
    bc.style.gap = `${TILE_GAP}px`;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const isCenter = (tx === centerX && ty === centerY);
        const tile = this._createTile(tx, ty, !isCenter);
        bc.appendChild(tile);
      }
    }

    // Edge Arrow 추가
    this._createEdgeArrows(centerX, centerY);

    // 초기 위치 (중앙 타일이 뷰포트 중앙)
    const vpSize = this.els.viewport.clientWidth;
    this.boardOffset.x = -(centerX * CELL_2D) + (vpSize - TILE_SIZE) / 2;
    this.boardOffset.y = -(centerY * CELL_2D) + (vpSize - TILE_SIZE) / 2;
    this._updateBoardPosition();
  }

  _createTile(tx, ty, isGhost) {
    const centerX = this.mode === 'torus' ? 2 : 2;
    const centerY = this.mode === 'torus' ? 2 : 0;

    const tile = document.createElement('div');
    tile.className = `ttt-tile ${isGhost ? 'ghost' : 'center'}`;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';

        // 뫼비우스: 홀수 타일은 상하 반전
        let actualRow = row;
        if (this.mode === 'mobius' && tx % 2 !== centerX % 2) {
          actualRow = 2 - row;
        }

        const boardIndex = actualRow * 3 + col;
        cell.dataset.index = boardIndex;
        cell.dataset.tx = tx;
        cell.dataset.ty = ty;

        cell.addEventListener('click', () => {
          if (this.isClick) this._handleCellClick(boardIndex);
        });

        tile.appendChild(cell);
      }
    }

    return tile;
  }

  _createEdgeArrows(centerTileX, centerTileY) {
    const cfg = getEdgeArrowConfig(this.mode);
    const originX = centerTileX * CELL_2D;
    const originY = centerTileY * CELL_2D;
    const arrowMargin = 20;
    const arrowLen = TILE_SIZE - arrowMargin * 2;
    const hw = 10;
    const outset = hw;

    const addArrow = (side, arrowCfg) => {
      if (!arrowCfg) return;
      const el = document.createElement('div');
      el.className = 'ttt-edge-arrow';
      const arrowW = hw * 2;

      if (side === 'left') {
        el.style.left = (originX - outset - arrowW / 2 + hw) + 'px';
        el.style.top = (originY + arrowMargin) + 'px';
      } else if (side === 'right') {
        el.style.left = (originX + TILE_SIZE + outset - arrowW / 2 - hw) + 'px';
        el.style.top = (originY + arrowMargin) + 'px';
      } else if (side === 'top') {
        el.style.left = (originX + arrowMargin) + 'px';
        el.style.top = (originY - outset - arrowW / 2 + hw) + 'px';
      } else if (side === 'bottom') {
        el.style.left = (originX + arrowMargin) + 'px';
        el.style.top = (originY + TILE_SIZE + outset - arrowW / 2 - hw) + 'px';
      }

      el.appendChild(createArrowSVG(arrowCfg.dir, arrowCfg.color, arrowLen));
      this.els.boardContainer.appendChild(el);
    };

    addArrow('left', cfg.left);
    addArrow('right', cfg.right);
    addArrow('top', cfg.top);
    addArrow('bottom', cfg.bottom);
  }

  _updateBoardPosition() {
    this.els.boardContainer.style.transform =
      `translate(${this.boardOffset.x}px, ${this.boardOffset.y}px)`;
  }

  // ─── 드래그 스크롤 ───

  _setupDrag() {
    const vp = this.els.viewport;

    // 마우스
    vp.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.isClick = true;
      this.dragStart = { x: e.clientX - this.boardOffset.x, y: e.clientY - this.boardOffset.y };
      this.clickStart = { x: e.clientX, y: e.clientY };
    });

    vp.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      if (Math.abs(e.clientX - this.clickStart.x) > 5 ||
          Math.abs(e.clientY - this.clickStart.y) > 5) {
        this.isClick = false;
      }
      if (!this.isClick) {
        if (this.mode === 'torus') {
          this.boardOffset.x = e.clientX - this.dragStart.x;
          this.boardOffset.y = e.clientY - this.dragStart.y;
        } else {
          this.boardOffset.x = e.clientX - this.dragStart.x;
        }
        this._updateBoardPosition();
      }
    });

    vp.addEventListener('mouseup', () => { this.dragging = false; });
    vp.addEventListener('mouseleave', () => { this.dragging = false; });

    // 터치
    vp.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      this.dragging = true;
      this.isClick = true;
      this.dragStart = { x: t.clientX - this.boardOffset.x, y: t.clientY - this.boardOffset.y };
      this.clickStart = { x: t.clientX, y: t.clientY };
    }, { passive: false });

    vp.addEventListener('touchmove', (e) => {
      if (!this.dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      if (Math.abs(t.clientX - this.clickStart.x) > 5 ||
          Math.abs(t.clientY - this.clickStart.y) > 5) {
        this.isClick = false;
      }
      if (!this.isClick) {
        if (this.mode === 'torus') {
          this.boardOffset.x = t.clientX - this.dragStart.x;
          this.boardOffset.y = t.clientY - this.dragStart.y;
        } else {
          this.boardOffset.x = t.clientX - this.dragStart.x;
        }
        this._updateBoardPosition();
      }
    }, { passive: false });

    vp.addEventListener('touchend', (e) => {
      if (this.isClick && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.classList.contains('ttt-cell') && el.dataset.index !== undefined) {
          this._handleCellClick(parseInt(el.dataset.index));
        }
      }
      this.dragging = false;
    });
  }

  // ─── 게임 로직 ───

  _handleCellClick(index) {
    if (!this.gameActive || this.gameOver) return;
    if (this.board[index] !== null) return;
    this._makeMove(index);
  }

  _makeMove(index) {
    this.board[index] = this.currentPlayer;
    this._updateBoard();
    if (this.texture) this._drawTexture();

    if (this.onMove) {
      this.onMove({ player: this.currentPlayer, index, board: [...this.board] });
    }

    const winResult = this._checkWinner();
    if (winResult) {
      this.gameOver = true;
      this.gameActive = false;
      this._highlightWin(winResult);
      this._setStatus(`Player ${winResult.winner} 승리!`, winResult.winner);
      if (this.els.btn3d) this.els.btn3d.style.display = 'inline-block';
      if (this.onGameEnd) {
        this.onGameEnd({ result: 'win', winner: winResult.winner, line: winResult.line, board: [...this.board] });
      }
    } else if (this.board.every(c => c !== null)) {
      this.gameOver = true;
      this.gameActive = false;
      this._setStatus('무승부!', 0);
      if (this.els.btn3d) this.els.btn3d.style.display = 'inline-block';
      if (this.onGameEnd) {
        this.onGameEnd({ result: 'draw', board: [...this.board] });
      }
    } else {
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
      this._setStatus(`Player ${this.currentPlayer} 차례 (${this.currentPlayer === 1 ? 'O' : 'X'})`, this.currentPlayer);
    }
  }

  _checkWinner() {
    if (this.mode === 'plain') {
      return this._checkWinnerPlain();
    }
    // 글로벌 그리드 스캔
    const { G, rMin, cMin, invPerms } = buildGlobalGrid(this.mode, this.board);
    const H = G.length, W = G[0].length;
    const dirs = [[0,1],[1,0],[1,1],[-1,1]];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = G[y][x];
        if (v === null) continue;
        for (const [dy, dx] of dirs) {
          const y1 = y + dy, x1 = x + dx;
          const y2 = y + 2*dy, x2 = x + 2*dx;
          if (y1 < 0 || y1 >= H || x1 < 0 || x1 >= W) continue;
          if (y2 < 0 || y2 >= H || x2 < 0 || x2 >= W) continue;
          if (G[y1][x1] === v && G[y2][x2] === v) {
            const line = [[y,x],[y1,x1],[y2,x2]].map(([Y,X]) => {
              const tr = Math.floor(Y / 3) + rMin;
              const tc = Math.floor(X / 3) + cMin;
              const localIdx = (Y % 3) * 3 + (X % 3);
              const key = `${tr},${tc}`;
              const inv = invPerms.get(key);
              return inv ? inv[localIdx] : localIdx;
            });
            return { winner: v, line: [...new Set(line)] };
          }
        }
      }
    }
    return null;
  }

  _checkWinnerPlain() {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8], // 가로
      [0,3,6],[1,4,7],[2,5,8], // 세로
      [0,4,8],[2,4,6],         // 대각선
    ];
    for (const [a,b,c] of lines) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return { winner: this.board[a], line: [a,b,c] };
      }
    }
    return null;
  }

  _updateBoard() {
    const cells = this.container.querySelectorAll('.ttt-cell');
    cells.forEach(cell => {
      const idx = parseInt(cell.dataset.index);
      const v = this.board[idx];
      cell.textContent = v === 1 ? 'O' : (v === 2 ? 'X' : '');
      cell.className = 'ttt-cell';
      if (v === 1) cell.classList.add('o');
      else if (v === 2) cell.classList.add('x');
    });
  }

  _highlightWin(result) {
    const cells = this.container.querySelectorAll('.ttt-cell');
    cells.forEach(cell => {
      const idx = parseInt(cell.dataset.index);
      if (result.line.includes(idx)) {
        cell.classList.add('win');
      }
    });
  }

  _setStatus(msg, player) {
    const el = this.els.status;
    el.textContent = msg;
    el.className = 'ttt-status';
    if (player === 1) el.classList.add('p1');
    else if (player === 2) el.classList.add('p2');
  }

  // ─── 3D 뷰 ───

  _switchTo2D() {
    this.currentView = '2d';
    this.els.viewport.style.display = 'block';
    if (this.els.container3d) this.els.container3d.classList.remove('active');
    if (this.els.btn3d) this.els.btn3d.textContent = '3D 전환하기';
  }

  async _toggle3D() {
    if (this.currentView === '2d') {
      this.currentView = '3d';
      this.els.viewport.style.display = 'none';
      this.els.container3d.classList.add('active');
      this.els.btn3d.textContent = '2D로 돌아가기';

      if (!this.threeLoaded) {
        await this._load3D();
      }
      if (this.texture) this._drawTexture();
    } else {
      this._switchTo2D();
    }
  }

  async _load3D() {
    // Three.js 동적 로드
    if (!window.THREE) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const THREE = window.THREE;
    const container = this.els.container3d;
    const width = container.clientWidth;
    const height = container.clientHeight || width;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.renderer3d = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer3d.setPixelRatio(window.devicePixelRatio);
    this.renderer3d.setSize(width, height, false);
    this.renderer3d.domElement.style.width = '100%';
    this.renderer3d.domElement.style.height = '100%';
    container.appendChild(this.renderer3d.domElement);

    // 텍스처 캔버스
    this.textureCanvas = document.createElement('canvas');
    this.textureCanvas.width = 512;
    this.textureCanvas.height = 512;
    this.textureCtx = this.textureCanvas.getContext('2d');

    this._drawTexture();
    this.texture = new THREE.CanvasTexture(this.textureCanvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = this.mode === 'mobius' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;

    this._createGameObject(THREE);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    this._setup3DControls();
    this._updateCamera();
    this._animate();
    this.threeLoaded = true;
  }

  _createGameObject(THREE) {
    const material = new THREE.MeshPhongMaterial({
      map: this.texture,
      color: 0xffffff,
      shininess: 30,
      side: this.mode === 'mobius' ? THREE.DoubleSide : THREE.FrontSide,
    });

    let geometry;
    if (this.mode === 'cylinder') {
      const radius = 1.2;
      const height = 2 * Math.PI * radius * 0.8;
      geometry = new THREE.CylinderGeometry(radius, radius, height, 64);
      const capMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 30 });
      this.gameObject = new THREE.Mesh(geometry, [material, capMat, capMat]);
    } else if (this.mode === 'torus') {
      geometry = new THREE.TorusGeometry(2, 0.8, 64, 64);
      this.gameObject = new THREE.Mesh(geometry, material);
    } else if (this.mode === 'mobius') {
      const mobiusFunc = (u, v, target) => {
        const theta = u * Math.PI * 2;
        const w = (v - 0.5) * 2;
        const radius = 2;
        const width = 1;
        const x = (radius + width * w * Math.cos(theta / 2)) * Math.cos(theta);
        const y = (radius + width * w * Math.cos(theta / 2)) * Math.sin(theta);
        const z = width * w * Math.sin(theta / 2);
        target.set(x, z, y);
      };
      geometry = new THREE.ParametricGeometry(mobiusFunc, 100, 20);
      this.gameObject = new THREE.Mesh(geometry, material);
    }

    this.scene.add(this.gameObject);
  }

  _drawTexture() {
    if (!this.textureCtx) return;
    const ctx = this.textureCtx;
    const CS = 512 / 3;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);

    // 격자선
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * CS, 0); ctx.lineTo(i * CS, 512); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, CS); ctx.lineTo(512, CS); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, CS * 2); ctx.lineTo(512, CS * 2); ctx.stroke();

    // 말 그리기
    for (let i = 0; i < 9; i++) {
      if (this.board[i] === null) continue;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = col * CS + CS / 2;
      const cy = row * CS + CS / 2;

      if (this.board[i] === 1) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(cx, cy, CS * 0.32, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        const s = CS * 0.32;
        ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
      }
    }

    if (this.texture) this.texture.needsUpdate = true;
  }

  _updateCamera() {
    if (!this.camera) return;
    const s = this.spherical;
    this.camera.position.x = s.radius * Math.sin(s.phi) * Math.cos(s.theta);
    this.camera.position.y = s.radius * Math.cos(s.phi);
    this.camera.position.z = s.radius * Math.sin(s.phi) * Math.sin(s.theta);
    this.camera.lookAt(0, 0, 0);
  }

  _setup3DControls() {
    const canvas = this.renderer3d.domElement;
    let prevMouse = { x: 0, y: 0 };
    let isDragging = false;

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.spherical.theta += (e.clientX - prevMouse.x) * 0.01;
      this.spherical.phi -= (e.clientY - prevMouse.y) * 0.01;
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
      this._updateCamera();
      prevMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mouseleave', () => { isDragging = false; });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spherical.radius += e.deltaY * 0.01;
      this.spherical.radius = Math.max(4, Math.min(20, this.spherical.radius));
      this._updateCamera();
    }, { passive: false });

    // 터치
    let lastPinch = 0;
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isDragging = false;
        lastPinch = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - prevMouse.x;
        const dy = e.touches[0].clientY - prevMouse.y;
        this.spherical.theta += dx * 0.01;
        this.spherical.phi -= dy * 0.01;
        this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
        this._updateCamera();
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.spherical.radius += (lastPinch - dist) * 0.03;
        this.spherical.radius = Math.max(4, Math.min(20, this.spherical.radius));
        this._updateCamera();
        lastPinch = dist;
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => { isDragging = false; });
  }

  _animate() {
    if (!this.renderer3d) return;
    this.animFrameId = requestAnimationFrame(() => this._animate());
    this.renderer3d.render(this.scene, this.camera);
  }

  _cleanup3D() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.renderer3d) {
      this.renderer3d.dispose();
      this.renderer3d = null;
    }
    if (this.els.container3d) {
      this.els.container3d.innerHTML = '';
    }
    this.scene = null;
    this.camera = null;
    this.gameObject = null;
    this.texture = null;
    this.threeLoaded = false;
  }
}


// ════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════

/**
 * 대전 위젯을 초기화한다.
 *
 * @param {HTMLElement} containerEl
 * @param {Object} options
 * @param {string} options.mode - 'plain'|'cylinder'|'torus'|'mobius'
 * @param {boolean} [options.enable3D=true] - 3D 전환 허용
 * @param {Function} [options.onMove] - 수를 둘 때마다 호출
 * @param {Function} [options.onGameEnd] - 게임 종료 시 호출
 * @returns {TicTacToeGame}
 */
export function initTicTacToe(containerEl, options = {}) {
  return new TicTacToeGame(containerEl, options);
}

/**
 * 분석기 위젯을 초기화한다 (grid-renderer 래핑).
 *
 * @param {HTMLElement} containerEl
 * @param {Object} options — createGridRenderer와 동일한 옵션
 * @returns {GridRenderer}
 */
export function initAnalyzer(containerEl, options = {}) {
  return createGridRenderer(containerEl, options);
}
