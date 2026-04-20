export const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
}

export const LOWER_VALUE_MARGIN = 30

export const POSITION_TABLES = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [0, 0, 0, 5, 5, 0, 0, 0],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
}

export const DIFFICULTY_LEVELS = [
  {
    key: 'beginner',
    label: '新手',
    depth: 2,
    randomRange: 24,
    usePositionalEval: false,
    positionalWeight: 1,
    centerWeight: 0,
    attackWeight: 0,
  },
  {
    key: 'medium',
    label: '中等',
    depth: 3,
    randomRange: 8,
    usePositionalEval: true,
    positionalWeight: 2,
    centerWeight: 28,
    attackWeight: 0.1,
    blunderWeight: 1.35,
    coordinationWeight: 0.08,
    pawnStructureWeight: 0.12,
    tacticalWeight: 1,
    useOpeningBook: true,
    openingWeight: 28,
    castlePawnWeight: 18,
  },
  {
    key: 'hard',
    label: '困难',
    depth: 4,
    engine: 'stockfish',
    stockfishDepth: 8,
    randomRange: 8,
    usePositionalEval: true,
    positionalWeight: 1,
    centerWeight: 18,
    attackWeight: 0.08,
    blunderWeight: 0.7,
    coordinationWeight: 0.06,
    pawnStructureWeight: 0.1,
    tacticalWeight: 0.8,
    useOpeningBook: true,
    openingWeight: 28,
  },
  {
    key: 'master',
    label: '大师',
    depth: 4,
    engine: 'stockfish',
    stockfishDepth: 16,
    randomRange: 8,
    usePositionalEval: true,
    positionalWeight: 1,
    centerWeight: 18,
    attackWeight: 0.08,
    blunderWeight: 0.7,
    coordinationWeight: 0.06,
    pawnStructureWeight: 0.1,
    tacticalWeight: 0.8,
    useOpeningBook: true,
    openingWeight: 28,
  },
]

export const DIFFICULTY_BY_KEY = Object.fromEntries(
  DIFFICULTY_LEVELS.map((difficulty) => [difficulty.key, difficulty])
)

export const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5'])

export const DEVELOPMENT_SQUARES = {
  w: {
    knights: ['b1', 'g1'],
    bishops: ['c1', 'f1'],
    queen: 'd1',
    king: 'e1',
    castledSquares: ['g1', 'c1'],
  },
  b: {
    knights: ['b8', 'g8'],
    bishops: ['c8', 'f8'],
    queen: 'd8',
    king: 'e8',
    castledSquares: ['g8', 'c8'],
  },
}

export const LINE_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
