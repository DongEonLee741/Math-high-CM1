/**
 * grid-renderer.js — 3×3 격자 렌더링 + 경로 시각화 (학습지 탐구용)
 *
 * 기능:
 *  - 3×3 격자 렌더링 (SVG 기반)
 *  - 승리 경로 색상 선 표시 (토글)
 *  - 칸의 가치 숫자 표시 (토글)
 *  - 셀 클릭 → 해당 칸 포함 경로 하이라이트
 *  - 감싸기 경로: 점선 + 화살표
 */

import {
  findAllPaths,
  calculateCellValues,
  getPathsThrough,
  isUniform,
  PRECOMPUTED,
} from './math-engine.js';

// ─── 경로 색상 팔레트 (최대 16개) ───
const PATH_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a',
  '#f4a261', '#264653', '#a855f7', '#06b6d4',
  '#84cc16', '#f97316', '#ec4899', '#14b8a6',
  '#8b5cf6', '#ef4444', '#0ea5e9', '#d946ef',
];

// ─── 기본 설정 ───
const DEFAULTS = {
  cellSize: 80,
  gridGap: 2,
  padding: 40,           // 감싸기 경로 화살표를 위한 외부 패딩
  pathStrokeWidth: 3,
  fontSize: 28,
  valueFontSize: 22,
};

/**
 * 격자 렌더러를 초기화한다.
 *
 * @param {HTMLElement} containerEl - 격자를 삽입할 컨테이너
 * @param {Object} options
 * @param {string} options.spaceType - 'plain'|'cylinder'|'torus'|'mobius'
 * @param {boolean} [options.showPaths=false] - 경로 표시 초기값
 * @param {boolean} [options.showValues=false] - 칸의 가치 표시 초기값
 * @param {boolean} [options.interactive=true] - 셀 클릭 인터랙션 활성화
 * @param {Function} [options.onCellClick] - 셀 클릭 콜백 (r, c, pathIndices)
 * @param {number} [options.cellSize=80] - 셀 크기 (px)
 * @returns {GridRenderer} 렌더러 인스턴스
 */
export function createGridRenderer(containerEl, options = {}) {
  return new GridRenderer(containerEl, options);
}

class GridRenderer {
  constructor(containerEl, options) {
    this.container = containerEl;
    this.spaceType = options.spaceType || 'plain';
    this.showPaths = options.showPaths || false;
    this.showValues = options.showValues || false;
    this.interactive = options.interactive !== false;
    this.onCellClick = options.onCellClick || null;
    this.cellSize = options.cellSize || DEFAULTS.cellSize;

    this.selectedCell = null;     // {r, c} or null
    this.highlightedPaths = [];   // 하이라이트된 경로 인덱스 배열
    this.paths = [];
    this.cellValues = [];

    this._compute();
    this._render();
  }

  // ─── Public API ───

  /** 공간 타입을 변경하고 다시 렌더링한다. */
  setSpaceType(spaceType) {
    this.spaceType = spaceType;
    this.selectedCell = null;
    this.highlightedPaths = [];
    this._compute();
    this._render();
  }

  /** 경로 표시 토글. */
  setShowPaths(show) {
    this.showPaths = show;
    this._updatePathVisibility();
  }

  /** 칸의 가치 표시 토글. */
  setShowValues(show) {
    this.showValues = show;
    this._updateValueVisibility();
  }

  /** 특정 경로들만 하이라이트한다. */
  highlightPathIndices(indices) {
    this.highlightedPaths = indices;
    this._updatePathHighlight();
  }

  /** 선택 해제. */
  clearSelection() {
    this.selectedCell = null;
    this.highlightedPaths = [];
    this._updateCellStyles();
    this._updatePathHighlight();
  }

  /** 현재 상태 정보를 반환한다. */
  getInfo() {
    return {
      spaceType: this.spaceType,
      pathCount: this.paths.length,
      cellValues: this.cellValues,
      uniform: isUniform(this.cellValues),
    };
  }

  /** 컨테이너를 비우고 다시 렌더링한다. */
  refresh() {
    this._render();
  }

  destroy() {
    this.container.innerHTML = '';
  }

  // ─── Internal ───

  _compute() {
    this.paths = findAllPaths(this.spaceType);
    this.cellValues = calculateCellValues(this.paths);
  }

  _render() {
    this.container.innerHTML = '';

    const cs = this.cellSize;
    const gap = DEFAULTS.gridGap;
    const pad = DEFAULTS.padding;
    const gridW = cs * 3 + gap * 2;
    const gridH = cs * 3 + gap * 2;
    const svgW = gridW + pad * 2;
    const svgH = gridH + pad * 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', '100%');
    svg.style.maxWidth = `${svgW}px`;
    svg.style.display = 'block';
    svg.style.margin = '0 auto';
    svg.style.userSelect = 'none';
    this.svg = svg;
    this.gridOriginX = pad;
    this.gridOriginY = pad;

    // 배경
    const bg = this._svgEl('rect', {
      x: 0, y: 0, width: svgW, height: svgH,
      fill: '#fafafa', rx: 8,
    });
    svg.appendChild(bg);

    // 격자 배경
    const gridBg = this._svgEl('rect', {
      x: pad, y: pad, width: gridW, height: gridH,
      fill: '#fff', stroke: '#333', 'stroke-width': 2, rx: 4,
    });
    svg.appendChild(gridBg);

    // 경로 레이어 (셀 아래)
    this.pathGroup = this._svgEl('g', { class: 'paths-layer' });
    svg.appendChild(this.pathGroup);

    // 셀
    this.cellElements = {};
    this.cellTexts = {};
    this.cellValueTexts = {};

    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        const { x, y } = this._cellXY(r, c);

        // 셀 사각형
        const rect = this._svgEl('rect', {
          x, y, width: cs, height: cs,
          fill: '#ffffff', stroke: '#ccc', 'stroke-width': 1.5, rx: 4,
          class: 'grid-cell', cursor: this.interactive ? 'pointer' : 'default',
        });
        this.cellElements[`${r},${c}`] = rect;
        svg.appendChild(rect);

        // 좌표 라벨 (작게)
        const label = this._svgEl('text', {
          x: x + 6, y: y + 14,
          'font-size': 10, fill: '#aaa', 'font-family': 'monospace',
        });
        label.textContent = `(${r},${c})`;
        svg.appendChild(label);

        // 칸의 가치 텍스트
        const valueTxt = this._svgEl('text', {
          x: x + cs / 2, y: y + cs / 2 + 8,
          'font-size': DEFAULTS.valueFontSize, fill: '#2563eb',
          'font-weight': 'bold', 'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          opacity: this.showValues ? 1 : 0,
          'pointer-events': 'none',
        });
        valueTxt.textContent = this.cellValues[r - 1][c - 1];
        this.cellValueTexts[`${r},${c}`] = valueTxt;
        svg.appendChild(valueTxt);

        // 클릭 이벤트
        if (this.interactive) {
          rect.addEventListener('click', () => this._onCellClick(r, c));
          // 터치 지원
          rect.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._onCellClick(r, c);
          });
        }
      }
    }

    // 경로 그리기
    this._drawPaths();

    this.container.appendChild(svg);
  }

  _cellXY(r, c) {
    const cs = this.cellSize;
    const gap = DEFAULTS.gridGap;
    return {
      x: this.gridOriginX + (c - 1) * (cs + gap),
      y: this.gridOriginY + (r - 1) * (cs + gap),
    };
  }

  _cellCenter(r, c) {
    const { x, y } = this._cellXY(r, c);
    return { cx: x + this.cellSize / 2, cy: y + this.cellSize / 2 };
  }

  _drawPaths() {
    this.pathGroup.innerHTML = '';
    this.pathElements = [];

    for (let i = 0; i < this.paths.length; i++) {
      const path = this.paths[i];
      const color = PATH_COLORS[i % PATH_COLORS.length];
      const isWrapping = path.wraps > 0;
      const group = this._svgEl('g', {
        class: `path-line path-${i}`,
        opacity: this.showPaths ? 0.7 : 0,
        'pointer-events': 'none',
      });

      if (!isWrapping) {
        // 일반 경로: 직선
        const points = path.cells.map(p => {
          const { cx, cy } = this._cellCenter(p.r, p.c);
          return `${cx},${cy}`;
        }).join(' ');

        const line = this._svgEl('polyline', {
          points,
          fill: 'none', stroke: color,
          'stroke-width': DEFAULTS.pathStrokeWidth,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        });
        group.appendChild(line);
      } else {
        // 감싸기 경로: 각 구간을 따로 그림 + 점선 표시
        this._drawWrappingPath(group, path, color);
      }

      this.pathGroup.appendChild(group);
      this.pathElements.push(group);
    }
  }

  _drawWrappingPath(group, path, color) {
    const cells = path.cells;

    for (let i = 0; i < cells.length - 1; i++) {
      const from = cells[i];
      const to = cells[i + 1];
      const { cx: x1, cy: y1 } = this._cellCenter(from.r, from.c);
      const { cx: x2, cy: y2 } = this._cellCenter(to.r, to.c);

      // 두 셀이 인접한지 확인 (맨해튼 거리 기준)
      const dr = Math.abs(to.r - from.r);
      const dc = Math.abs(to.c - from.c);
      const isAdjacent = dr <= 1 && dc <= 1;

      if (isAdjacent) {
        // 인접: 실선
        const line = this._svgEl('line', {
          x1, y1, x2, y2,
          stroke: color,
          'stroke-width': DEFAULTS.pathStrokeWidth,
          'stroke-linecap': 'round',
        });
        group.appendChild(line);
      } else {
        // 감싸기 구간: 각 셀에서 가장자리로 향하는 점선 + 화살표
        this._drawWrapSegment(group, from, to, color);
      }
    }
  }

  _drawWrapSegment(group, from, to, color) {
    const cs = this.cellSize;
    const gap = DEFAULTS.gridGap;
    const pad = DEFAULTS.padding;
    const { cx: fx, cy: fy } = this._cellCenter(from.r, from.c);
    const { cx: tx, cy: ty } = this._cellCenter(to.r, to.c);

    // from 셀에서 격자 가장자리로
    const edgeFrom = this._getEdgePoint(from, to);
    // to 셀에서 격자 반대쪽 가장자리로
    const edgeTo = this._getEdgePoint(to, from);

    // from → 가장자리 (점선)
    const line1 = this._svgEl('line', {
      x1: fx, y1: fy, x2: edgeFrom.x, y2: edgeFrom.y,
      stroke: color, 'stroke-width': DEFAULTS.pathStrokeWidth,
      'stroke-dasharray': '6,4', 'stroke-linecap': 'round',
    });
    group.appendChild(line1);

    // 가장자리 → to (점선)
    const line2 = this._svgEl('line', {
      x1: edgeTo.x, y1: edgeTo.y, x2: tx, y2: ty,
      stroke: color, 'stroke-width': DEFAULTS.pathStrokeWidth,
      'stroke-dasharray': '6,4', 'stroke-linecap': 'round',
    });
    group.appendChild(line2);

    // 화살표 마커 (from 쪽)
    this._drawArrowHead(group, fx, fy, edgeFrom.x, edgeFrom.y, color);
  }

  _getEdgePoint(cell, otherCell) {
    const cs = this.cellSize;
    const gap = DEFAULTS.gridGap;
    const { cx, cy } = this._cellCenter(cell.r, cell.c);

    // 감싸기 방향 추론: cell과 otherCell 사이 거리가 큰 방향
    const dc = otherCell.c - cell.c;
    const dr = otherCell.r - cell.r;

    let ex = cx, ey = cy;
    const gridLeft = this.gridOriginX;
    const gridRight = this.gridOriginX + cs * 3 + gap * 2;
    const gridTop = this.gridOriginY;
    const gridBottom = this.gridOriginY + cs * 3 + gap * 2;

    // 열 감싸기 (큰 차이 = 감싸기)
    if (Math.abs(dc) > 1) {
      if (dc > 0) {
        ex = gridLeft - 4; // 왼쪽 가장자리로 나감
      } else {
        ex = gridRight + 4; // 오른쪽 가장자리로 나감
      }
    }

    // 행 감싸기
    if (Math.abs(dr) > 1) {
      if (dr > 0) {
        ey = gridTop - 4;
      } else {
        ey = gridBottom + 4;
      }
    }

    return { x: ex, y: ey };
  }

  _drawArrowHead(group, x1, y1, x2, y2, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 8;
    const ax = x2 - size * Math.cos(angle - Math.PI / 6);
    const ay = y2 - size * Math.sin(angle - Math.PI / 6);
    const bx = x2 - size * Math.cos(angle + Math.PI / 6);
    const by = y2 - size * Math.sin(angle + Math.PI / 6);

    const arrow = this._svgEl('polygon', {
      points: `${x2},${y2} ${ax},${ay} ${bx},${by}`,
      fill: color,
    });
    group.appendChild(arrow);
  }

  _onCellClick(r, c) {
    if (this.selectedCell && this.selectedCell.r === r && this.selectedCell.c === c) {
      // 같은 셀 재클릭 → 선택 해제
      this.clearSelection();
      return;
    }

    this.selectedCell = { r, c };
    const indices = getPathsThrough(this.paths, r, c);
    this.highlightedPaths = indices;

    this._updateCellStyles();
    this._updatePathHighlight();

    if (this.onCellClick) {
      this.onCellClick(r, c, indices);
    }
  }

  _updateCellStyles() {
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        const key = `${r},${c}`;
        const rect = this.cellElements[key];
        const isSelected = this.selectedCell && this.selectedCell.r === r && this.selectedCell.c === c;

        // 선택된 셀 또는 하이라이트 경로에 포함된 셀
        const isInHighlight = this.highlightedPaths.some(idx => {
          return this.paths[idx].cells.some(p => p.r === r && p.c === c);
        });

        if (isSelected) {
          rect.setAttribute('fill', '#D6EAF8');
          rect.setAttribute('stroke', '#2563eb');
          rect.setAttribute('stroke-width', '2.5');
        } else if (isInHighlight) {
          rect.setAttribute('fill', '#FFF9C4');
          rect.setAttribute('stroke', '#e9c46a');
          rect.setAttribute('stroke-width', '2');
        } else {
          rect.setAttribute('fill', '#ffffff');
          rect.setAttribute('stroke', '#ccc');
          rect.setAttribute('stroke-width', '1.5');
        }
      }
    }
  }

  _updatePathVisibility() {
    if (!this.pathElements) return;
    for (let i = 0; i < this.pathElements.length; i++) {
      const el = this.pathElements[i];
      if (this.showPaths) {
        el.setAttribute('opacity', this.highlightedPaths.length > 0
          ? (this.highlightedPaths.includes(i) ? 0.9 : 0.15)
          : 0.7);
      } else {
        // showPaths OFF 일 때도 하이라이트된 경로는 표시
        el.setAttribute('opacity', this.highlightedPaths.includes(i) ? 0.9 : 0);
      }
    }
  }

  _updatePathHighlight() {
    if (!this.pathElements) return;
    for (let i = 0; i < this.pathElements.length; i++) {
      const el = this.pathElements[i];
      if (this.highlightedPaths.length > 0) {
        if (this.highlightedPaths.includes(i)) {
          el.setAttribute('opacity', '0.9');
        } else {
          el.setAttribute('opacity', this.showPaths ? '0.15' : '0');
        }
      } else {
        el.setAttribute('opacity', this.showPaths ? '0.7' : '0');
      }
    }
  }

  _updateValueVisibility() {
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        const txt = this.cellValueTexts[`${r},${c}`];
        txt.setAttribute('opacity', this.showValues ? 1 : 0);
      }
    }
  }

  _svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }
}

export { GridRenderer };
