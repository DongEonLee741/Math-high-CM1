/**
 * math-engine.js — 위상 틱택토 수학 엔진
 *
 * 4종 공간(평면, 원기둥, 토러스, 뫼비우스)의
 * 승리 경로 계산, 칸의 가치 산출, 검산을 수행한다.
 *
 * 좌표계: 1-indexed (r, c) ∈ {1,2,3} × {1,2,3}
 */

// ─── 공간 타입 ───
export const SPACE_TYPES = ['plain', 'cylinder', 'torus', 'mobius'];

// ─── 8방향 벡터 ───
const DIRECTIONS = [
  { dr: 0, dc: 1 },   // →
  { dr: 0, dc: -1 },  // ←
  { dr: 1, dc: 0 },   // ↓
  { dr: -1, dc: 0 },  // ↑
  { dr: 1, dc: 1 },   // ↘
  { dr: -1, dc: -1 }, // ↖
  { dr: -1, dc: 1 },  // ↗
  { dr: 1, dc: -1 },  // ↙
];

/**
 * 한 칸 이동 후 좌표를 반환한다.
 * 공간 규칙에 따라 감싸기(wrap)를 적용한다.
 * 경계 밖이면 null을 반환한다.
 *
 * @param {number} r - 현재 행 (1~3)
 * @param {number} c - 현재 열 (1~3)
 * @param {number} dr - 행 이동량
 * @param {number} dc - 열 이동량
 * @param {string} spaceType - 'plain'|'cylinder'|'torus'|'mobius'
 * @returns {{r: number, c: number}|null}
 */
export function step(r, c, dr, dc, spaceType) {
  let nr = r + dr;
  let nc = c + dc;

  // 열 감싸기 (좌우)
  if (nc > 3) {
    if (spaceType === 'plain') return null;
    nc = nc - 3;
    if (spaceType === 'mobius') nr = 4 - nr; // 행 뒤집힘
  } else if (nc < 1) {
    if (spaceType === 'plain') return null;
    nc = nc + 3;
    if (spaceType === 'mobius') nr = 4 - nr;
  }

  // 행 감싸기 (상하) — 토러스만 상하 연결
  if (nr > 3) {
    if (spaceType !== 'torus') return null;
    nr = nr - 3;
  } else if (nr < 1) {
    if (spaceType !== 'torus') return null;
    nr = nr + 3;
  }

  return { r: nr, c: nc };
}

/**
 * 한 칸 이동 + 뫼비우스 플립 여부를 반환하는 내부 헬퍼.
 * 뫼비우스 경계를 넘으면 mobiusFlip=true를 반환한다.
 * @private
 */
function stepDetailed(r, c, dr, dc, spaceType) {
  let nr = r + dr;
  let nc = c + dc;
  let mobiusFlip = false;

  if (nc > 3) {
    if (spaceType === 'plain') return null;
    nc -= 3;
    if (spaceType === 'mobius') { nr = 4 - nr; mobiusFlip = true; }
  } else if (nc < 1) {
    if (spaceType === 'plain') return null;
    nc += 3;
    if (spaceType === 'mobius') { nr = 4 - nr; mobiusFlip = true; }
  }

  if (nr > 3) {
    if (spaceType !== 'torus') return null;
    nr -= 3;
  } else if (nr < 1) {
    if (spaceType !== 'torus') return null;
    nr += 3;
  }

  return { r: nr, c: nc, mobiusFlip };
}

/**
 * 주어진 공간의 모든 승리 경로(3연속 직선)를 찾는다.
 *
 * 뫼비우스 공간에서는 경계를 넘을 때 dr 방향이 뒤집힌다.
 * 이는 비가향 곡면에서 직선이 경계를 넘으면
 * 행 방향이 반전되기 때문이다.
 *
 * @param {string} spaceType - 'plain'|'cylinder'|'torus'|'mobius'
 * @returns {Array<{cells: Array<{r:number, c:number}>, wraps: number, direction: {dr:number, dc:number}}>}
 */
export function findAllPaths(spaceType) {
  const found = new Set();
  const pathDetails = [];

  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      for (const { dr, dc } of DIRECTIONS) {
        const cells = [{ r, c }];
        let cr = r, cc = c;
        let currentDr = dr;
        let valid = true;
        let wraps = 0;

        for (let s = 0; s < 2; s++) {
          const next = stepDetailed(cr, cc, currentDr, dc, spaceType);
          if (!next) { valid = false; break; }

          if (next.mobiusFlip) {
            wraps++;
            currentDr = -currentDr; // 뫼비우스 경계 통과 후 행 방향 반전
          } else {
            const rawC = cc + dc;
            const rawR = cr + currentDr;
            if (rawC > 3 || rawC < 1) wraps++;
            if (rawR > 3 || rawR < 1) wraps++;
          }

          cells.push({ r: next.r, c: next.c });
          cr = next.r;
          cc = next.c;
        }

        // 유효한 경로: 3칸이 모두 다른 위치
        if (valid && cells.length === 3) {
          const uniqueCheck = new Set(cells.map(p => `${p.r},${p.c}`));
          if (uniqueCheck.size === 3) {
            const key = cells.map(p => `${p.r},${p.c}`).sort().join('|');
            if (!found.has(key)) {
              found.add(key);
              pathDetails.push({ cells, wraps, direction: { dr, dc } });
            }
          }
        }
      }
    }
  }

  return pathDetails;
}

/**
 * 경로 목록으로부터 각 칸의 가치(해당 칸을 지나는 경로 수)를 계산한다.
 *
 * @param {Array<{cells: Array<{r:number, c:number}>}>} paths
 * @returns {number[][]} 3×3 배열 (0-indexed)
 */
export function calculateCellValues(paths) {
  const values = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (const path of paths) {
    for (const { r, c } of path.cells) {
      values[r - 1][c - 1]++;
    }
  }

  return values;
}

/**
 * 검산: Σ(칸의 가치) === (경로 수) × 3
 *
 * @param {Array} paths - findAllPaths 결과
 * @param {number[][]} cellValues - calculateCellValues 결과
 * @returns {{sum: number, expected: number, valid: boolean}}
 */
export function verifyChecksum(paths, cellValues) {
  const sum = cellValues.flat().reduce((a, b) => a + b, 0);
  const expected = paths.length * 3;
  return { sum, expected, valid: sum === expected };
}

/**
 * 특정 칸을 지나는 경로 인덱스 목록을 반환한다.
 *
 * @param {Array} paths - findAllPaths 결과
 * @param {number} r - 행 (1~3)
 * @param {number} c - 열 (1~3)
 * @returns {number[]} 해당 칸을 포함하는 경로의 인덱스 배열
 */
export function getPathsThrough(paths, r, c) {
  const result = [];
  for (let i = 0; i < paths.length; i++) {
    if (paths[i].cells.some(p => p.r === r && p.c === c)) {
      result.push(i);
    }
  }
  return result;
}

/**
 * 균등 여부를 판정한다.
 * 모든 칸의 가치가 동일하면 균등(uniform).
 *
 * @param {number[][]} cellValues - 3×3 칸의 가치 배열
 * @returns {boolean}
 */
export function isUniform(cellValues) {
  const first = cellValues[0][0];
  return cellValues.every(row => row.every(v => v === first));
}

// ─── 사전 계산된 상수 (성능 최적화 + 검증 기준) ───
export const PRECOMPUTED = {
  plain:    { pathCount: 8,  cellValues: [[3,2,3],[2,4,2],[3,2,3]], uniform: false },
  cylinder: { pathCount: 12, cellValues: [[4,4,4],[4,4,4],[4,4,4]], uniform: true  },
  torus:    { pathCount: 12, cellValues: [[4,4,4],[4,4,4],[4,4,4]], uniform: true  },
  mobius:   { pathCount: 16, cellValues: [[6,6,6],[4,4,4],[6,6,6]], uniform: false },
};

/**
 * 런타임 자가 검증.
 * 앱 로드 시 실행하여 수학 엔진의 정확성을 보장한다.
 *
 * @returns {boolean} 모든 테스트 통과 여부
 */
export function selfTest() {
  let allPassed = true;

  for (const space of SPACE_TYPES) {
    const paths = findAllPaths(space);
    const expectedCount = PRECOMPUTED[space].pathCount;

    // 경로 수 확인
    if (paths.length !== expectedCount) {
      console.error(`[math-engine] ${space}: 경로 수 불일치! 계산=${paths.length}, 기대=${expectedCount}`);
      allPassed = false;
      continue;
    }

    // 칸의 가치 확인
    const cv = calculateCellValues(paths);
    const expectedCV = PRECOMPUTED[space].cellValues;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (cv[r][c] !== expectedCV[r][c]) {
          console.error(`[math-engine] ${space}: 칸의 가치 불일치 (${r},${c}) 계산=${cv[r][c]}, 기대=${expectedCV[r][c]}`);
          allPassed = false;
        }
      }
    }

    // 검산
    const check = verifyChecksum(paths, cv);
    if (!check.valid) {
      console.error(`[math-engine] ${space}: 검산 실패! sum=${check.sum}, expected=${check.expected}`);
      allPassed = false;
    }

    // 균등 여부
    if (isUniform(cv) !== PRECOMPUTED[space].uniform) {
      console.error(`[math-engine] ${space}: 균등 여부 불일치!`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('%c✅ math-engine selfTest 통과', 'color: green; font-weight: bold');
  } else {
    console.error('❌ math-engine selfTest 실패!');
  }

  return allPassed;
}
