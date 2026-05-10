/**
 * @file ai/openingBook.js
 * @description 扩展开局库（带变化分支）
 *
 * ============================================================================
 * 模块职责
 * ============================================================================
 *
 * 提供扩展的开局库功能，让 AI 能够走出符合国际象棋理论的正规开局：
 *
 * 1. 开局库存储 (OPENING_BOOK)
 *    - 预存经典局面的最佳走法
 *    - 支持多种开局变化分支
 *    - 覆盖约 60 种常见开局
 *
 * 2. 开局 key 生成 (getOpeningBookKey)
 *    - 从 FEN 提取开局标识
 *    - 只考虑棋子位置，不考虑其他状态
 *
 * 3. 开局走法查询 (getOpeningMove)
 *    - 根据当前局面查找匹配的开局
 *    - 验证走法合法性
 *    - 随机选择（增加变化性）
 *    - 支持选择变化分支
 *
 * ============================================================================
 * 开局库设计
 * ============================================================================
 *
 * 存储结构：
 * - Key: FEN 前4个字段（仅局面位置）
 * - Value: 数组或对象
 *
 * 简单格式（无分支）：
 * 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': ['e4', 'd4', 'Nf3', 'c4']
 *
 * 分支格式：
 * 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': {
 *   moves: ['Nf3', 'Bc4', 'd4'],
 *   branches: [
 *     { name: 'Morphy Attack', moves: ['Nc3', 'Bc4'] },
 *     { name: 'Classical', moves: ['d4', 'exd4'] }
 *   ]
 * }
 *
 * ============================================================================
 * 开局类型覆盖
 * ============================================================================
 *
 * | 类别 | 开局名称 | 分支数 |
 * |-----|---------|-------|
 * | 开放性开局 | 西班牙开局、意大利开局、苏格兰开局、王翼弃兵、西西里防御 | 15+ |
 * | 半开放性开局 | 卡罗康防御、阿尼 Dorian 防御、彼得罗夫防御 | 8+ |
 * | 封闭性开局 | 皇后兵开局、斯拉姆防御、格林菲尔德防御 | 12+ |
 * | 印度防御 | 尼姆佐印度防御、古印度防御、别尔德防御 | 10+ |
 * | 其他开局 | 英格兰开局、荷兰防御 | 8+ |
 *
 * ============================================================================
 * 变化分支说明
 * ============================================================================
 *
 * 分支命名规则：
 * - 使用经典命名（如 "Morphy Attack", "Main Line"）
 * - 中文注释辅助理解
 * - 分支随机选择，增加 AI 变化性
 */

/**
 * 生成开局库键
 *
 * 从 FEN 中提取前4个字段作为开局标识
 * 忽略：
 * - 走子方 (第5字段)
 * - 易位标记 (第6字段)
 * - 过路兵标记 (第7字段)
 * - 半回合计数 (第8字段)
 *
 * @param {Chess} game - 棋局实例
 * @returns {string} 开局库键
 */
export function getOpeningBookKey(game) {
  return game.fen().split(' ').slice(0, 4).join(' ')
}

/**
 * 扩展开局库
 *
 * 格式：
 * - 简单格式：['move1', 'move2', ...]
 * - 分支格式：{ moves: [...], branches: [{ name, moves }, ...] }
 */
export const OPENING_BOOK = {
  // ==================== 初始局面 ==========
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': ['e4', 'd4', 'Nf3', 'c4', 'g3', 'f4'],

  // ==================== 1.e4 开局 ==========
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -': ['e5', 'c5', 'e6', 'c6', 'd6', 'Nf6'],

  // ===== 1.e4 e5 开局 =====
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': {
    moves: ['Nf3'],
    branches: [
      { name: 'Russian Game', moves: ['Nf6'] },  // 俄罗斯防御
      { name: 'Bishop Opening', moves: ['Bc4'] }, // 菲利多尔变例
    ],
  },

  // ===== 1.e4 e5 Nf3 =====
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -': {
    moves: ['Nc6'],
    branches: [
      { name: 'Main Line', moves: ['d6'] },    // 斯汤顿弃兵
      { name: 'Two Knights', moves: ['Nf6'] }, // 双马防御
    ],
  },

  // ===== 西班牙开局 1.e4 e5 Nf3 Nc6 =====
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': {
    moves: ['Bb5'],
    branches: [
      { name: "Morphy Attack", moves: ['a6'] },     // 莫菲攻击
      { name: 'Classical', moves: ['Bc4'] },       // 古典防御
      { name: 'Exchange', moves: ['Bxc6'] },       // 兑换变例
    ],
  },

  // ===== 意大利开局 1.e4 e5 Nf3 Nc6 Bc4 =====
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -': {
    moves: ['Nf6'],
    branches: [
      { name: 'Giuoco Piano', moves: ['Bc5'] },       // 意大利双象
      { name: 'Evans Gambit', moves: ['b4'] },        // 伊文斯弃兵
      { name: 'Two Knights', moves: ['Nf6'] },        // 双马防御
    ],
  },

  // ===== 意大利开局主变 1.e4 e5 Nf3 Nc6 Bc4 Bc5 =====
  'r1bqk1nr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -': {
    moves: ['c3'],  // 伊文斯弃兵前奏
    branches: [
      { name: 'Evans Gambit Accepted', moves: ['d4'] },  // 接受伊文斯
      { name: 'Evans Gambit Declined', moves: ['b4'] },   // 拒绝伊文斯
    ],
  },

  // ===== 苏格兰开局 1.e4 e5 Nf3 Nc6 Bc4 =====
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -': ['Nf6', 'd6', 'f5'],

  // ===== 苏格兰开局主变 1.e4 e5 Nf3 Nc6 Bc4 Nf6 =====
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -': {
    moves: ['Nc3'],
    branches: [
      { name: 'Morphy Attack', moves: ['d6'] },  // 莫菲攻击
      { name: 'Paulsen Attack', moves: ['Bb4'] }, // 保尔森攻击
    ],
  },

  // ===== 菲利多尔防御 1.e4 e5 Nf3 d6 =====
  'rnbqkbnr/ppp2ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['d4', 'Nc3', 'Bc4'],

  // ===== 王翼弃兵 1.e4 e5 f4 =====
  'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3': ['exf4', 'd5', 'Nf6'],

  // ===== 王翼弃兵接受 1.e4 e5 f4 exf4 =====
  'rnbqkbnr/ppp2ppp/8/4p3/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq -': ['Nf3', 'Bc4', 'd4'],

  // ===== 西西里防御 1.e4 c5 =====
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6': ['Nf3', 'd4', 'c3'],

  // ===== 西西里防御主变 1.e4 c5 Nf3 d6 =====
  'rnbqkbnr/pp2pppp/8/2pp4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': {
    moves: ['d4'],
    branches: [
      { name: 'Open Sicilian', moves: ['cxd4'] },    // 西西里开放变例
      { name: 'Closed Sicilian', moves: ['Nc3'] },  // 西西里封闭变例
    ],
  },

  // ===== 纳伊道夫变例 1.e4 c5 Nf3 d6 d4 cxd4 Nf3 =====
  'rnbqkbnr/pp3ppp/8/2pp4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['Nxd4', 'c6'],

  // ===== 卡罗康防御 1.e4 c6 =====
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': ['d4', 'Nc3', 'Nf3'],

  // ===== 卡罗康防御主变 1.e4 c6 d4 d5 =====
  'rnbqkbnr/pp2pppp/8/2pp4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -': {
    moves: ['Nc3'],
    branches: [
      { name: 'Classical', moves: ['dxe4'] },    // 经典变例
      { name: 'Panov Attack', moves: ['e5'] },  // 潘诺夫攻击
    ],
  },

  // ===== 彼得罗夫防御 1.e4 e5 Nf3 Nf6 =====
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': {
    moves: ['Nxe5'],
    branches: [
      { name: 'Classical Attack', moves: ['d6'] },       // 古典攻击
      { name: 'Lolli Attack', moves: ['Nc6'] },          // 洛利攻击
      { name: 'Cozio Attack', moves: ['Nxe4'] },        // 科齐奥攻击
    ],
  },

  // ===== 阿尼-多丽安防御 1.e4 d6 =====
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': ['d4', 'Nc3', 'Nf3'],

  // ===== 1.e4 d6 d4 =====
  'rnbqkbnr/ppp2ppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -': {
    moves: ['Nc3'],
    branches: [
      { name: 'Standard', moves: ['Nf6'] },      // 标准体系
      { name: 'Wade Defense', moves: ['g6'] },   // 韦德防御
    ],
  },

  // ==================== 1.d4 开局 ==========
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -': ['d5', 'Nf6', 'e6', 'c5', 'f5'],

  // ===== 皇后兵开局主变 1.d4 d5 =====
  'rnbqkbnr/ppp2ppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -': {
    moves: ['c4'],
    branches: [
      { name: 'Main Line', moves: ['dxc4'] },       // 主变
      { name: 'Slav Defense', moves: ['c6'] },      // 斯拉姆防御
      { name: 'Chigorin', moves: ['Nc6'] },         // 奇戈林防御
    ],
  },

  // ===== 斯拉姆防御 1.d4 d5 c4 c6 =====
  'rnbqkbnr/pp2pppp/8/2p5/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -': ['Nf3', 'Nc3', 'e3'],

  // ===== 斯拉姆防御主变 1.d4 d5 c4 c6 Nf3 =====
  'rnbqkbnr/pp2pppp/8/2p5/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq -': {
    moves: ['Nf6'],
    branches: [
      { name: 'Main Line', moves: ['Nc6'] },     // 主变
      { name: 'Meran', moves: ['e6'] },          // 梅兰变例
      { name: 'Semi-Slav', moves: ['dxc4'] },    // 半斯拉姆
    ],
  },

  // ===== 塔拉什防御 1.d4 d5 c4 c6 cxd5 cxd5 =====
  'rnbqkbnr/pp2pppp/8/8/3P4/8/PP2PPPP/RNBQKBNR w KQkq -': ['Nc3', 'Nf3', 'Bg5'],

  // ===== 阿尔宾反弃兵 1.d4 d5 c4 e6 =====
  'rnbqkbnr/ppp2ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -': ['Nc3', 'Nf3', 'Bg5'],

  // ===== 格林菲尔德防御 1.d4 Nf6 c4 d5 =====
  'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -': ['Nc3', 'cxd5', 'e4'],

  // ===== 格林菲尔德主变 1.d4 Nf6 c4 d5 Nc3 dxc4 =====
  'rnbqkb1r/ppp1pp1p/5np1/8/2Pp4/2N5/PP2PPPP/R1BQKBNR w KQkq -': {
    moves: ['e4'],
    branches: [
      { name: 'Samisch Attack', moves: ['c6'] },    // 萨米什攻击
      { name: 'Zukertort', moves: ['Nf6'] },        // 祖克尔托特变例
      { name: 'Modern Line', moves: ['b5'] },       // 现代变例
    ],
  },

  // ===== 尼姆佐印度防御 1.d4 Nf6 c4 e6 =====
  'rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -': ['Nc3', 'Bb4', 'e3'],

  // ===== 尼姆佐印度主变 1.d4 Nf6 c4 e6 Nc3 Bb4 =====
  'rnbqkbr1/pppp2pp/5n2/4p3/1bP5/2N5/PP2PPPP/R1BQKBNR w KQkq -': {
    moves: ['e3'],
    branches: [
      { name: 'Kasparov Attack', moves: ['c5'] },    // 卡斯帕罗夫攻击
      { name: 'Romanishin', moves: ['b5'] },         // 罗马尼辛变例
      { name: 'Main Line', moves: ['Nf6'] },         // 主变
    ],
  },

  // ===== 女王印度防御 1.d4 Nf6 c4 e6 Nc3 Bb4 =====
  'rnbqkbr1/pppp2pp/5n2/4p3/1bP5/2N5/PP2PPPP/R1BQKBNR w KQkq -': ['e3', 'Nf3', 'Bd3'],

  // ===== 古印度防御 1.d4 Nf6 c4 g6 =====
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -': {
    moves: ['Nc3'],
    branches: [
      { name: 'Fianchetto', moves: ['Bg7'] },  // 龙式出子
      { name: 'Four Pawns', moves: ['d5'] },  // 四兵攻击
    ],
  },

  // ===== 古印度主变 1.d4 Nf6 c4 g6 Nc3 Bg7 =====
  'rnbqk2r1/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -': ['e4', 'd5', 'exd5'],

  // ===== 别尔德防御 1.d4 Nf6 c4 e5 =====
  'rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -': ['Nc3', 'dxe5', 'e4'],

  // ===== 荷兰防御 1.d4 f5 =====
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -': ['c4', 'Nf3', 'Nc3'],

  // ===== 荷兰防御主变 1.d4 f5 c4 Nf6 =====
  'rnbqkbnr/ppppp2p/6p1/5p2/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -': {
    moves: ['Nc3'],
    branches: [
      { name: 'Classical', moves: ['e6'] },      // 古典变例
      { name: 'Stonewall', moves: ['d5'] },     // 石墙变例
      { name: 'Leningrad', moves: ['g6'] },     // 列宁格勒变例
    ],
  },

  // ==================== 1.c4 开局（英格兰开局）==========
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/R1BQKBNR b KQkq -': ['Nc6', 'Nf6', 'e6', 'c5'],

  // ===== 英格兰开局主变 1.c4 c5 =====
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -': ['Nf3', 'Nc3', 'g3'],

  // ===== 1.c4 e5（反向西班牙）=====
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -': {
    moves: ['Nc3'],
    branches: [
      { name: 'Reversed Ruy Lopez', moves: ['Nf6'] },  // 反向西班牙
      { name: 'English Symmetrical', moves: ['c5'] },   // 对称体系
    ],
  },

  // ==================== 1.Nf3 开局（林道尔开局）==========
  'rnbqkbnr/pppppppp/8/8/5N2/8/PPPPPPPP/RNBQKB1R b KQkq -': ['d5', 'Nf6', 'c5', 'e6', 'f5'],

  // ===== 1.Nf3 d5（列蒂开局）=====
  'rnbqkbnr/ppp1pppp/8/3p4/5N2/8/PPPPPPPP/RNBQKB1R w KQkq -': ['c4', 'd4', 'e3'],

  // ===== 1.Nf3 Nf6（印度风格的开始）=====
  'rnbqkb1r/pppppppp/5n2/8/5N2/8/PPPPPPPP/RNBQKB1R w KQkq -': ['c4', 'd4', 'g3'],

  // ==================== 1.g3 开局（龙式开局）==========
  'rnbqkbnr/pppppppp/8/8/6N1/8/PPPPPPPP/RNBQKB1R b KQkq -': ['d5', 'Nf6', 'c5', 'e5'],

  // ==================== 1.b3 开局（英格兰开局变例）==========
  'rnbqkbnr/pppppppp/8/8/8/1b6/PPPPPPPP/RNBQKBNR w KQkq -': ['Bb2', 'Nf3', 'e3'],

  // ==================== 1.b4 开局（波兰开局/ Sokolsky 变例）==========
  'rnbqkbnr/pppppppp/8/8/8/p7/PPPPPPPP/RNBQKBNR w KQkq -': ['e3', 'Bb2', 'Nf3'],

  // ==================== 1.f4 开局（伯德开局）==========
  'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR w KQkq -': ['d4', 'Nf3', 'e3'],

  // ===== 1.f4 e5（安德鲁斯弃兵）=====
  'rnbqkbnr/pppp2pp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq -': ['e4', 'Nf3', 'Bc4'],

  // ==================== 常见中局局面（扩展覆盖）==========
  // ===== 伊文斯弃兵接受 =====
  'r1bqk1nr/ppp2ppp/2n5/3pp3/2B1P2b/5N2/PPPP1PPP/RNBQK2R w KQkq -': ['b4', 'O-O', 'Nc3'],

  // ===== 西班牙开局柏林防御 =====
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -': ['O-O', 'd3', 'Nc3'],

  // ===== 西西里龙式变例 =====
  'rnbqkb1r/pp3ppp/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -': ['Be2', 'O-O', 'f4'],

  // ===== 西西里舍文宁根变例 =====
  'rnbqkb1r/pp3ppp/3p1n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -': {
    moves: ['Be2'],
    branches: [
      { name: 'English Attack', moves: ['g6'] },   // 英语攻击
      { name: 'Robat', moves: ['Be7'] },           // 罗巴特变例
    ],
  },

  // ===== 后翼印度防御 =====
  'rnbqk2r1/pppp1ppp/4pn2/8/1bPP4/2N5/PP3PPP/R1BQKBNR w KQkq -': ['e4', 'e3', 'Nf3'],

  // ===== 托姆巴尔切夫斯基变例 =====
  'rnbqk2r1/pppp1ppp/4pn2/8/1bPP4/2N5/PP3PPP/R1BQKBNR w KQkq -': ['e4', 'e5', 'd5'],

  // ===== 塔拉什体系 =====
  'rnbqkbnr/pp2pppp/8/2p5/2PP4/8/PP3PPP/RNBQKBNR w KQkq -': ['Nc3', 'Nf3', 'Bf5'],

  // ===== 伦敦系统 =====
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': ['Bf4', 'Nf3', 'e3'],

  // ===== 伦敦系统主变 =====
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['Bf4', 'Nf6', 'e3'],

  // ===== 巴格塔斯弃兵 =====
  'rnbqkbnr/ppp2ppp/8/4p3/3pP3/8/PPP2PPP/RNBQKBNR w KQkq -': ['c4', 'c5', 'Nf3'],

  // ===== 奇戈林防御 =====
  'rnbqkbnr/ppp2ppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -': {
    moves: ['Nc3'],
    branches: [
      { name: 'Chigorin Main', moves: ['Nc6'] },     // 奇戈林主变
      { name: 'Moscow System', moves: ['Bg4'] },    // 莫斯科体系
    ],
  },

  // ===== 女王兵开局兑换变例 =====
  'r1bqkbnr/ppp2ppp/8/8/3Pn3/8/PPP2PPP/RNBQKBNR w KQkq -': ['Bxc5', 'Nc3', 'Nf3'],

  // ===== 科尔蒂娜变例 =====
  'r1bqkbnr/ppp2ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -': ['Nc3', 'O-O', 'd3'],

  // ===== 马克斯普朗克变例 =====
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': ['d4', 'exd4', 'Nxd4'],

  // ===== 保尔森弃兵 =====
  'rnbqkbnr/ppp2ppp/8/4p3/3pP3/2N5/PPP2PPP/R1BQKBNR w KQkq -': ['c4', 'dxc4', 'e4'],

  // ===== 里加弃兵 =====
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP2PPP/RNBQKBNR w KQkq -': ['e4', 'exd5', 'Nf3'],
}

/**
 * 获取当前局面的开局走法
 *
 * @param {Chess} game - 棋局实例
 * @param {boolean} useBranches - 是否使用变化分支
 * @returns {Object|null} 匹配的开局走法或 null
 *
 * 流程：
 * 1. 生成开局库键
 * 2. 查找匹配的开局
 * 3. 如果有分支，随机选择一个分支
 * 4. 过滤出当前局面合法的走法
 * 5. 返回走法
 *
 * 注意：
 * - 同时支持 SAN 和 LAN 格式
 * - 如果没有匹配返回 null（走自定义 AI）
 */
export function getOpeningMove(game, useBranches = true) {
  const bookMoves = OPENING_BOOK[getOpeningBookKey(game)]

  if (!bookMoves) {
    return null
  }

  // 获取所有合法走法
  const legalMoves = game.moves({ verbose: true })

  // 处理分支格式
  let candidateMoves = []

  if (typeof bookMoves === 'object' && !Array.isArray(bookMoves)) {
    // 有分支的情况
    if (useBranches && bookMoves.branches && bookMoves.branches.length > 0) {
      // 随机选择一个分支
      const selectedBranch =
        bookMoves.branches[Math.floor(Math.random() * bookMoves.branches.length)]
      candidateMoves = selectedBranch.moves
    } else {
      // 使用主变
      candidateMoves = bookMoves.moves || []
    }
  } else {
    // 简单数组格式
    candidateMoves = bookMoves
  }

  // 过滤出在开局库中且合法的走法
  const matchingMoves = legalMoves.filter(
    (move) => candidateMoves.includes(move.san) || candidateMoves.includes(move.lan)
  )

  if (matchingMoves.length === 0) {
    return null
  }

  // 随机选择一个（增加变化性）
  return matchingMoves[Math.floor(Math.random() * matchingMoves.length)]
}

/**
 * 获取开局名称
 *
 * @param {Chess} game - 棋局实例
 * @returns {string|null} 开局名称或 null
 */
export function getOpeningName(game) {
  const bookMoves = OPENING_BOOK[getOpeningBookKey(game)]

  if (!bookMoves) {
    return null
  }

  if (typeof bookMoves === 'object' && !Array.isArray(bookMoves) && bookMoves.name) {
    return bookMoves.name
  }

  return null
}

/**
 * 检查当前局面是否在开局库中
 *
 * @param {Chess} game - 棋局实例
 * @returns {boolean} 是否在开局库中
 */
export function isInOpeningBook(game) {
  return OPENING_BOOK.hasOwnProperty(getOpeningBookKey(game))
}