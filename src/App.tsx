import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ElementType = 'STR' | 'AGL' | 'TEQ' | 'INT' | 'PHY'
type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR' | 'LR'
type Tab =
  | 'Home'
  | 'Team Builder'
  | 'Character Box'
  | 'Summon'
  | 'Story'
  | 'Events'
  | 'Upgrade'
  | 'Battle'
  | 'Results'
  | 'Login Rewards'

type BattleAction = 'Basic Attack' | 'Super Attack' | 'Ultimate Attack'

interface CharacterTemplate {
  id: string
  name: string
  title: string
  element: ElementType
  rarity: Rarity
  tags: string[]
  featured?: boolean
  baseStats: {
    hp: number
    atk: number
    def: number
    speed: number
  }
  leaderSkill: string
  passiveSkill: string
  superAttack: string
  ultimateAttack: string
  aura: string
}

interface OwnedCharacter {
  level: number
  copies: number
  awakenings: number
}

interface Resources {
  stones: number
  zeni: number
  stamina: number
  maxStamina: number
  medals: number
  capsules: number
}

interface StageDefinition {
  id: string
  chapter: string
  name: string
  mode: 'Story' | 'Event' | 'Endgame'
  staminaCost: number
  enemyName: string
  enemyElement: ElementType
  enemyHP: number
  enemyAtk: number
  enemyDef: number
  rewards: {
    stones: number
    zeni: number
    medals: number
    capsules: number
  }
  modifiers: string[]
}

interface BattleState {
  stageId: string
  enemyName: string
  enemyElement: ElementType
  enemyHP: number
  enemyMaxHP: number
  enemyAtk: number
  enemyDef: number
  teamHP: number
  teamMaxHP: number
  turn: number
  activeSlot: number
  ki: Record<string, number>
  orbGrid: ElementType[]
  log: string[]
}

interface BattleResult {
  outcome: 'Victory' | 'Defeat'
  stageId: string
  rewards: Resources
  summary: string
}

interface LoginState {
  lastClaimDate: string | null
  streak: number
}

interface SaveData {
  resources: Resources
  owned: Record<string, OwnedCharacter>
  team: Array<string | null>
  battle: BattleState | null
  lastResult: BattleResult | null
  login: LoginState
  audioEnabled: boolean
}

interface TeamBonus {
  hpBoost: number
  atkBoost: number
  defBoost: number
  speedBoost: number
  sharedTags: string[]
  leaderText: string
}

interface DerivedCharacter {
  template: CharacterTemplate
  owned: OwnedCharacter
  rarity: Rarity
  maxLevel: number
  stats: {
    hp: number
    atk: number
    def: number
    speed: number
  }
}

interface EffectBurst {
  key: number
  element: ElementType
  intensity: number
}

const STORAGE_KEY = 'gacha-save-v1'
const MAX_TEAM_SIZE = 6
const SINGLE_SUMMON_COST = 5
const MULTI_SUMMON_COST = 50
const GRID_COLUMNS = 5
const TABS: Tab[] = [
  'Home',
  'Team Builder',
  'Character Box',
  'Summon',
  'Story',
  'Events',
  'Upgrade',
  'Battle',
  'Results',
  'Login Rewards',
]
const RARITY_ORDER: Rarity[] = ['N', 'R', 'SR', 'SSR', 'UR', 'LR']
const LEVEL_CAPS: Record<Rarity, number> = {
  N: 20,
  R: 30,
  SR: 40,
  SSR: 60,
  UR: 80,
  LR: 99,
}
const MEDAL_COSTS: Record<Rarity, number> = {
  N: 10,
  R: 20,
  SR: 35,
  SSR: 60,
  UR: 90,
  LR: 0,
}
const ELEMENTS: ElementType[] = ['STR', 'AGL', 'TEQ', 'INT', 'PHY']
const ELEMENT_LABELS: Record<ElementType, string> = {
  STR: 'Strength',
  AGL: 'Agility',
  TEQ: 'Technique',
  INT: 'Insight',
  PHY: 'Physical',
}
const ELEMENT_COLORS: Record<ElementType, string> = {
  STR: '#ef4444',
  AGL: '#3b82f6',
  TEQ: '#22c55e',
  INT: '#a855f7',
  PHY: '#f59e0b',
}
const RARITY_STYLES: Record<Rarity, string> = {
  N: 'from-slate-500 to-slate-700',
  R: 'from-sky-500 to-blue-700',
  SR: 'from-violet-500 to-fuchsia-700',
  SSR: 'from-amber-400 to-orange-600',
  UR: 'from-rose-400 via-orange-500 to-yellow-400',
  LR: 'from-cyan-300 via-violet-500 to-pink-500',
}
const DAILY_REWARD = {
  stones: 15,
  zeni: 5000,
  stamina: 10,
  maxStamina: 0,
  medals: 20,
  capsules: 3,
} satisfies Resources

const CHARACTER_POOL: CharacterTemplate[] = [
  {
    id: 'sol-ssr',
    name: 'Sol Ren',
    title: 'Sun-Burst Vanguard',
    element: 'STR',
    rarity: 'SSR',
    tags: ['Warrior', 'Hero', 'Royal Bloodline'],
    featured: true,
    baseStats: { hp: 1450, atk: 230, def: 165, speed: 128 },
    leaderSkill: 'STR allies gain +18% HP and +12% ATK for each Hero tag on the team.',
    passiveSkill: 'Builds Solar Edge each turn for bonus crit damage.',
    superAttack: 'Flare Breaker',
    ultimateAttack: 'Radiant Comet Burst',
    aura: 'A blazing royal aura erupts around Sol.',
  },
  {
    id: 'lyra-ssr',
    name: 'Lyra Vale',
    title: 'Storm Halo Tactician',
    element: 'AGL',
    rarity: 'SSR',
    tags: ['Hero', 'Mage', 'God'],
    featured: true,
    baseStats: { hp: 1325, atk: 215, def: 172, speed: 141 },
    leaderSkill: 'AGL and God allies gain +20% Speed and +12% DEF.',
    passiveSkill: 'Converts one random orb into AGL at battle start.',
    superAttack: 'Tempest Nova',
    ultimateAttack: 'Sky Choir Singularity',
    aura: 'Lightning rings shimmer in a halo around Lyra.',
  },
  {
    id: 'kael-sr',
    name: 'Kael Forge',
    title: 'Titan Gear Brawler',
    element: 'PHY',
    rarity: 'SR',
    tags: ['Machine', 'Warrior', 'Hero'],
    baseStats: { hp: 1180, atk: 185, def: 180, speed: 94 },
    leaderSkill: 'Machine allies gain +12% HP and reduce damage taken by 8%.',
    passiveSkill: 'Guards against heavy hits after collecting 4 orbs.',
    superAttack: 'Impact Rivet Smash',
    ultimateAttack: 'Meteor Assembly Cannon',
    aura: 'Steel sparks crackle around Kael.',
  },
  {
    id: 'serin-sr',
    name: 'Serin Wisp',
    title: 'Moonlit Spirit Archer',
    element: 'INT',
    rarity: 'SR',
    tags: ['Hero', 'Beast', 'Mage'],
    baseStats: { hp: 1120, atk: 205, def: 145, speed: 133 },
    leaderSkill: 'INT allies gain +15% ATK and +10% Speed.',
    passiveSkill: 'Attacks again when a 5-orb chain is created.',
    superAttack: 'Phantom Crescent',
    ultimateAttack: 'Silver Moon Cataclysm',
    aura: 'Ghostly feathers spiral around Serin.',
  },
  {
    id: 'toru-r',
    name: 'Toru Pike',
    title: 'Frontline Drill Hero',
    element: 'TEQ',
    rarity: 'R',
    tags: ['Warrior', 'Hero'],
    baseStats: { hp: 980, atk: 160, def: 132, speed: 102 },
    leaderSkill: 'TEQ allies gain +10% ATK.',
    passiveSkill: 'Recovers a little stamina after Story clears.',
    superAttack: 'Cyclone Drill Rush',
    ultimateAttack: 'Impossible Spiral Drive',
    aura: 'A focused green current surrounds Toru.',
  },
  {
    id: 'vexa-ssr',
    name: 'Vexa Noir',
    title: 'Abyss Queen of Ruin',
    element: 'INT',
    rarity: 'SSR',
    tags: ['Villain', 'God', 'Mage'],
    featured: true,
    baseStats: { hp: 1380, atk: 240, def: 150, speed: 136 },
    leaderSkill: 'Villain allies gain +22% ATK and start battles with +2 Ki.',
    passiveSkill: 'Deals extra damage to enemies below 50% HP.',
    superAttack: 'Nightfall Sunder',
    ultimateAttack: 'Oblivion Crown Eclipse',
    aura: 'Dark stars orbit around Vexa.',
  },
  {
    id: 'orik-sr',
    name: 'Orik Fang',
    title: 'Primal Roar Hunter',
    element: 'STR',
    rarity: 'SR',
    tags: ['Beast', 'Warrior', 'Villain'],
    baseStats: { hp: 1230, atk: 198, def: 142, speed: 117 },
    leaderSkill: 'Beast allies gain +14% HP and +10% ATK.',
    passiveSkill: 'Hits harder on 6+ orb chains.',
    superAttack: 'Savage Quake',
    ultimateAttack: 'Howling Worldbreaker',
    aura: 'Crimson claw marks blaze around Orik.',
  },
  {
    id: 'eira-ur',
    name: 'Eira Zenith',
    title: 'Celestial Fusion Guardian',
    element: 'TEQ',
    rarity: 'UR',
    tags: ['Fusion', 'Hero', 'God'],
    featured: true,
    baseStats: { hp: 1620, atk: 252, def: 195, speed: 138 },
    leaderSkill: 'Fusion and God allies gain +24% all stats.',
    passiveSkill: 'Transforms orb chains into shields for the whole rotation.',
    superAttack: 'Starfold Saber',
    ultimateAttack: 'Transcendent Aurora Verdict',
    aura: 'A twin-colored stellar flame swirls around Eira.',
  },
  {
    id: 'drake-lr',
    name: 'Drake Sovereign',
    title: 'Dragon Throne Ascendant',
    element: 'PHY',
    rarity: 'LR',
    tags: ['Dragon', 'Royal Bloodline', 'Hero'],
    featured: true,
    baseStats: { hp: 1850, atk: 285, def: 210, speed: 126 },
    leaderSkill: 'Dragon and Royal Bloodline allies gain +30% HP and +18% ATK.',
    passiveSkill: 'Launches guaranteed Super Attacks after collecting 7 orbs.',
    superAttack: 'Imperial Dragon Crash',
    ultimateAttack: 'Eternal Throne Nova',
    aura: 'Golden dragon scales shimmer through the air.',
  },
  {
    id: 'mira-r',
    name: 'Mira Pulse',
    title: 'Clockwork Support Ace',
    element: 'AGL',
    rarity: 'R',
    tags: ['Machine', 'Hero', 'Mage'],
    baseStats: { hp: 910, atk: 152, def: 140, speed: 124 },
    leaderSkill: 'Support allies gain +1 Ki and +8% DEF.',
    passiveSkill: 'Heals 4% team HP after Events clears.',
    superAttack: 'Pulse Resonance',
    ultimateAttack: 'Chrono Ring Cascade',
    aura: 'A cool blue pulse keeps time around Mira.',
  },
  {
    id: 'raze-n',
    name: 'Raze Cinder',
    title: 'Reckless Ember Cadet',
    element: 'STR',
    rarity: 'N',
    tags: ['Warrior', 'Hero'],
    baseStats: { hp: 720, atk: 118, def: 92, speed: 91 },
    leaderSkill: 'All allies gain +5% HP.',
    passiveSkill: 'Learns quickly from stronger teammates.',
    superAttack: 'Flash Ember Jab',
    ultimateAttack: 'Bursting Rookie Charge',
    aura: 'Tiny sparks trail behind Raze.',
  },
  {
    id: 'nyx-r',
    name: 'Nyx Shade',
    title: 'Silent Rift Duelist',
    element: 'INT',
    rarity: 'R',
    tags: ['Villain', 'Mage', 'Fusion'],
    baseStats: { hp: 940, atk: 168, def: 128, speed: 129 },
    leaderSkill: 'INT allies gain +9% Speed.',
    passiveSkill: 'Dodges once after entering the rotation.',
    superAttack: 'Umbra Twin Slash',
    ultimateAttack: 'Dimensional Rift Burial',
    aura: 'Ink-black ribbons twist around Nyx.',
  },
]

const STORY_STAGES: StageDefinition[] = [
  {
    id: 'story-1',
    chapter: 'Chapter 1',
    name: 'Arrival at Nova City',
    mode: 'Story',
    staminaCost: 8,
    enemyName: 'Raid Captain Ronan',
    enemyElement: 'TEQ',
    enemyHP: 3300,
    enemyAtk: 180,
    enemyDef: 90,
    rewards: { stones: 3, zeni: 1200, medals: 8, capsules: 1 },
    modifiers: ['Clear in under 8 turns for bonus style points.'],
  },
  {
    id: 'story-2',
    chapter: 'Chapter 2',
    name: 'Moon Beast Ambush',
    mode: 'Story',
    staminaCost: 10,
    enemyName: 'Lunar Fang Alpha',
    enemyElement: 'INT',
    enemyHP: 4200,
    enemyAtk: 225,
    enemyDef: 110,
    rewards: { stones: 4, zeni: 1600, medals: 12, capsules: 1 },
    modifiers: ['Beast enemies counter on weak chains.'],
  },
]

const EVENT_STAGES: StageDefinition[] = [
  {
    id: 'event-xp',
    chapter: 'Daily Event',
    name: 'Hyper Training Dome',
    mode: 'Event',
    staminaCost: 12,
    enemyName: 'Gravity Sim Core',
    enemyElement: 'PHY',
    enemyHP: 4000,
    enemyAtk: 210,
    enemyDef: 120,
    rewards: { stones: 2, zeni: 2000, medals: 10, capsules: 3 },
    modifiers: ['Extra capsules drop on victory.'],
  },
  {
    id: 'event-medal',
    chapter: 'Limited Event',
    name: 'Awakening Medal Vault',
    mode: 'Event',
    staminaCost: 14,
    enemyName: 'Vault Warden X',
    enemyElement: 'AGL',
    enemyHP: 4800,
    enemyAtk: 260,
    enemyDef: 140,
    rewards: { stones: 2, zeni: 2400, medals: 20, capsules: 1 },
    modifiers: ['Boss armor increases after turn 5.'],
  },
]

const ENDGAME_STAGES: StageDefinition[] = [
  {
    id: 'end-bossrush',
    chapter: 'Boss Rush',
    name: 'God Ruin Protocol',
    mode: 'Endgame',
    staminaCost: 20,
    enemyName: 'Valkor, World Devourer',
    enemyElement: 'STR',
    enemyHP: 7000,
    enemyAtk: 360,
    enemyDef: 180,
    rewards: { stones: 8, zeni: 5000, medals: 32, capsules: 2 },
    modifiers: ['Clear fast for speed rewards. Super attacks hit harder.'],
  },
  {
    id: 'end-tower',
    chapter: 'Infinite Tower',
    name: 'Floor 21: Endless Halo',
    mode: 'Endgame',
    staminaCost: 18,
    enemyName: 'Halo Warden Seraph',
    enemyElement: 'AGL',
    enemyHP: 7600,
    enemyAtk: 345,
    enemyDef: 210,
    rewards: { stones: 6, zeni: 4200, medals: 28, capsules: 2 },
    modifiers: ['Survival bonus for finishing above 40% HP.'],
  },
]

const ALL_STAGES = [...STORY_STAGES, ...EVENT_STAGES, ...ENDGAME_STAGES]
const TEMPLATE_BY_ID = Object.fromEntries(CHARACTER_POOL.map((character) => [character.id, character])) as Record<
  string,
  CharacterTemplate
>

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function getNextRarity(rarity: Rarity) {
  const nextIndex = Math.min(RARITY_ORDER.indexOf(rarity) + 1, RARITY_ORDER.length - 1)
  return RARITY_ORDER[nextIndex]
}

function getDisplayRarity(baseRarity: Rarity, awakenings: number) {
  let current = baseRarity
  for (let step = 0; step < awakenings; step += 1) {
    current = getNextRarity(current)
  }
  return current
}

function createStarterOwned(level: number): OwnedCharacter {
  return {
    level,
    copies: 1,
    awakenings: 0,
  }
}

function createInitialSave(): SaveData {
  return {
    resources: {
      stones: 140,
      zeni: 18000,
      stamina: 60,
      maxStamina: 60,
      medals: 90,
      capsules: 14,
    },
    owned: {
      'sol-ssr': createStarterOwned(18),
      'lyra-ssr': createStarterOwned(18),
      'kael-sr': createStarterOwned(16),
      'serin-sr': createStarterOwned(16),
      'toru-r': createStarterOwned(12),
      'mira-r': createStarterOwned(12),
    },
    team: ['sol-ssr', 'lyra-ssr', 'kael-sr', 'serin-sr', 'toru-r', 'mira-r'],
    battle: null,
    lastResult: null,
    login: {
      lastClaimDate: null,
      streak: 0,
    },
    audioEnabled: true,
  }
}

function normalizeSave(input: Partial<SaveData>) {
  const base = createInitialSave()
  const team = Array.from({ length: MAX_TEAM_SIZE }, (_, index) => input.team?.[index] ?? base.team[index] ?? null)

  return {
    resources: {
      ...base.resources,
      ...input.resources,
    },
    owned: {
      ...base.owned,
      ...input.owned,
    },
    team,
    battle: input.battle ?? base.battle,
    lastResult: input.lastResult ?? base.lastResult,
    login: {
      ...base.login,
      ...input.login,
    },
    audioEnabled: input.audioEnabled ?? base.audioEnabled,
  } satisfies SaveData
}

function loadSave() {
  if (typeof window === 'undefined') {
    return createInitialSave()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createInitialSave()
    }

    return normalizeSave(JSON.parse(raw) as Partial<SaveData>)
  } catch {
    return createInitialSave()
  }
}

function getRandomElement() {
  return ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]
}

function getTypeMultiplier(attacker: ElementType, defender: ElementType) {
  const advantageMap: Record<ElementType, ElementType> = {
    STR: 'TEQ',
    TEQ: 'PHY',
    PHY: 'AGL',
    AGL: 'INT',
    INT: 'STR',
  }
  const disadvantageMap: Record<ElementType, ElementType> = {
    STR: 'INT',
    TEQ: 'STR',
    PHY: 'TEQ',
    AGL: 'PHY',
    INT: 'AGL',
  }

  if (advantageMap[attacker] === defender) {
    return 1.35
  }

  if (disadvantageMap[attacker] === defender) {
    return 0.72
  }

  return 1
}

function getTeamBonus(team: Array<CharacterTemplate | null>): TeamBonus {
  const activeMembers = team.filter((member): member is CharacterTemplate => member !== null)
  if (activeMembers.length === 0) {
    return {
      hpBoost: 0,
      atkBoost: 0,
      defBoost: 0,
      speedBoost: 0,
      sharedTags: [],
      leaderText: 'No leader bonus active.',
    }
  }

  const tagCounts = new Map<string, number>()
  for (const member of activeMembers) {
    for (const tag of member.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  const sharedTags = Array.from(tagCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([tag]) => tag)
    .slice(0, 3)
  const leader = activeMembers[0]
  const matchingElementCount = activeMembers.filter((member) => member.element === leader.element).length

  return {
    hpBoost: 0.06 + sharedTags.length * 0.04 + matchingElementCount * 0.015,
    atkBoost: 0.05 + sharedTags.length * 0.05,
    defBoost: 0.04 + sharedTags.length * 0.03,
    speedBoost: 0.03 + Math.min(sharedTags.length, 2) * 0.02,
    sharedTags,
    leaderText: leader.leaderSkill,
  }
}

function getCharacterDetails(
  template: CharacterTemplate,
  owned: OwnedCharacter,
  teamBonus: TeamBonus,
): DerivedCharacter {
  const rarity = getDisplayRarity(template.rarity, owned.awakenings)
  const maxLevel = LEVEL_CAPS[rarity]
  const levelScale = 1 + (owned.level - 1) * 0.045
  const copyScale = 1 + Math.max(0, owned.copies - 1) * 0.05
  const awakenScale = 1 + owned.awakenings * 0.18
  const totalScale = levelScale * copyScale * awakenScale

  return {
    template,
    owned,
    rarity,
    maxLevel,
    stats: {
      hp: Math.round(template.baseStats.hp * totalScale * (1 + teamBonus.hpBoost)),
      atk: Math.round(template.baseStats.atk * totalScale * (1 + teamBonus.atkBoost)),
      def: Math.round(template.baseStats.def * totalScale * (1 + teamBonus.defBoost)),
      speed: Math.round(template.baseStats.speed * (1 + teamBonus.speedBoost + (owned.level - 1) * 0.003)),
    },
  }
}

function getStageById(stageId: string) {
  return ALL_STAGES.find((stage) => stage.id === stageId) ?? STORY_STAGES[0]
}

function getNeighbors(index: number) {
  const neighbors: number[] = []
  const row = Math.floor(index / GRID_COLUMNS)
  const column = index % GRID_COLUMNS

  if (column > 0) {
    neighbors.push(index - 1)
  }
  if (column < GRID_COLUMNS - 1) {
    neighbors.push(index + 1)
  }
  if (row > 0) {
    neighbors.push(index - GRID_COLUMNS)
  }
  if (row < 3) {
    neighbors.push(index + GRID_COLUMNS)
  }

  return neighbors
}

function findOrbChain(grid: ElementType[], startIndex: number) {
  const target = grid[startIndex]
  const stack = [startIndex]
  const visited = new Set<number>()

  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined || visited.has(current) || grid[current] !== target) {
      continue
    }

    visited.add(current)
    for (const neighbor of getNeighbors(current)) {
      if (!visited.has(neighbor) && grid[neighbor] === target) {
        stack.push(neighbor)
      }
    }
  }

  return Array.from(visited)
}

function hasPlayableChain(grid: ElementType[]) {
  return grid.some((_, index) => findOrbChain(grid, index).length >= 2)
}

function ensurePlayableGrid(grid: ElementType[]) {
  if (hasPlayableChain(grid)) {
    return grid
  }

  const next = [...grid]
  const origin = Math.floor(Math.random() * next.length)
  const neighbors = getNeighbors(origin)
  const forcedNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)]
  next[forcedNeighbor] = next[origin]
  return next
}

function createOrbGrid() {
  return ensurePlayableGrid(Array.from({ length: 20 }, () => getRandomElement()))
}

function replaceOrbChain(grid: ElementType[], chain: number[]) {
  const chainSet = new Set(chain)
  return ensurePlayableGrid(grid.map((orb, index) => (chainSet.has(index) ? getRandomElement() : orb)))
}

function weightedPick<T>(entries: Array<{ value: T; weight: number }>) {
  const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0)
  let roll = Math.random() * totalWeight

  for (const entry of entries) {
    roll -= entry.weight
    if (roll <= 0) {
      return entry.value
    }
  }

  return entries[entries.length - 1].value
}

function summonCharacter(guaranteedSSR: boolean) {
  const rarityPool = guaranteedSSR
    ? [
        { value: 'SSR' as const, weight: 70 },
        { value: 'UR' as const, weight: 22 },
        { value: 'LR' as const, weight: 8 },
      ]
    : [
        { value: 'N' as const, weight: 28 },
        { value: 'R' as const, weight: 30 },
        { value: 'SR' as const, weight: 25 },
        { value: 'SSR' as const, weight: 12 },
        { value: 'UR' as const, weight: 4 },
        { value: 'LR' as const, weight: 1 },
      ]

  const rolledRarity = weightedPick(rarityPool)
  const eligible = CHARACTER_POOL.filter(
    (character) => RARITY_ORDER.indexOf(character.rarity) >= RARITY_ORDER.indexOf(rolledRarity),
  )
  const featuredPool = eligible.filter((character) => character.featured)
  const finalPool = featuredPool.length > 0 && Math.random() < 0.45 ? featuredPool : eligible

  return finalPool[Math.floor(Math.random() * finalPool.length)]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function useAudioEngine(enabled: boolean, mode: 'menu' | 'battle') {
  const contextRef = useRef<AudioContext | null>(null)
  const loopRef = useRef<number | null>(null)

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) {
      return null
    }

    if (!contextRef.current) {
      contextRef.current = new AudioContextCtor()
    }

    if (contextRef.current.state === 'suspended') {
      void contextRef.current.resume()
    }

    return contextRef.current
  }, [])

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.03) => {
      if (!enabled) {
        return
      }

      const context = ensureContext()
      if (!context) {
        return
      }

      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.value = frequency
      gain.gain.value = volume
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + duration)
      gain.gain.setValueAtTime(volume, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    },
    [enabled, ensureContext],
  )

  useEffect(() => {
    if (!enabled) {
      if (loopRef.current) {
        window.clearInterval(loopRef.current)
        loopRef.current = null
      }
      return
    }

    ensureContext()
    if (loopRef.current) {
      window.clearInterval(loopRef.current)
    }

    const pattern = mode === 'battle' ? [130, 196, 164] : [262, 330, 392]
    let step = 0
    loopRef.current = window.setInterval(() => {
      const note = pattern[step % pattern.length]
      playTone(note, 0.18, mode === 'battle' ? 'square' : 'triangle', mode === 'battle' ? 0.025 : 0.02)
      step += 1
    }, mode === 'battle' ? 1600 : 2300)

    return () => {
      if (loopRef.current) {
        window.clearInterval(loopRef.current)
        loopRef.current = null
      }
    }
  }, [enabled, mode, playTone, ensureContext])

  return { playTone }
}

function BattleCanvas({ burst }: { burst: EffectBurst }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * ratio
      canvas.height = canvas.clientHeight * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const color = ELEMENT_COLORS[burst.element]
    const particles = Array.from({ length: 14 + burst.intensity }, () => ({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      size: 2 + Math.random() * 6,
      velocity: 1 + Math.random() * 3,
    }))

    let frame = 0
    let animationFrame = 0

    const draw = () => {
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      const alpha = Math.max(0, 1 - frame / 28)

      context.fillStyle = `rgba(255,255,255,${alpha * 0.1})`
      context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

      context.strokeStyle = color
      context.lineWidth = 5
      context.beginPath()
      context.moveTo(24, canvas.clientHeight - 28)
      context.lineTo(canvas.clientWidth - 24, 30)
      context.stroke()

      for (const particle of particles) {
        context.fillStyle = `${color}${Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')}`
        context.beginPath()
        context.arc(
          particle.x + frame * particle.velocity * 2,
          particle.y - frame * particle.velocity,
          particle.size * alpha,
          0,
          Math.PI * 2,
        )
        context.fill()
      }

      frame += 1
      if (frame <= 28) {
        animationFrame = window.requestAnimationFrame(draw)
      } else {
        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      }
    }

    draw()
    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [burst])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full rounded-[2rem]" />
}

function CharacterCard({
  character,
  selected,
  onClick,
}: {
  character: DerivedCharacter
  selected: boolean
  onClick: () => void
}) {
  const gradient = RARITY_STYLES[character.rarity]
  const tagLabel = character.template.tags.slice(0, 2).join(' • ')

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl border p-4 text-left transition ${
        selected
          ? 'border-cyan-300 bg-slate-900 shadow-[0_0_30px_rgba(34,211,238,0.25)]'
          : 'border-white/10 bg-slate-900/70 hover:border-white/25'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-center text-xs font-black uppercase tracking-[0.3em] text-white shadow-lg`}
        >
          {character.template.element}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-white">{character.template.name}</h3>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">
              {character.rarity}
            </span>
          </div>
          <p className="text-sm text-slate-300">{character.template.title}</p>
          <p className="mt-1 text-xs text-slate-400">{tagLabel}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="text-slate-400">HP</div>
          <div className="font-semibold text-white">{character.stats.hp}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="text-slate-400">ATK</div>
          <div className="font-semibold text-white">{character.stats.atk}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="text-slate-400">DEF</div>
          <div className="font-semibold text-white">{character.stats.def}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-2">
          <div className="text-slate-400">LV</div>
          <div className="font-semibold text-white">
            {character.owned.level}/{character.maxLevel}
          </div>
        </div>
      </div>
    </button>
  )
}

function App() {
  const [save, setSave] = useState<SaveData>(loadSave)
  const [activeTab, setActiveTab] = useState<Tab>('Home')
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('sol-ssr')
  const [notice, setNotice] = useState<string | null>(null)
  const [summonResults, setSummonResults] = useState<CharacterTemplate[]>([])
  const [burst, setBurst] = useState<EffectBurst>({ key: 0, element: 'STR', intensity: 0 })
  const battleMode = activeTab === 'Battle' && save.battle ? 'battle' : 'menu'
  const { playTone } = useAudioEngine(save.audioEnabled, battleMode)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
  }, [save])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timeout = window.setTimeout(() => setNotice(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const teamTemplates = useMemo(
    () => save.team.map((memberId) => (memberId ? TEMPLATE_BY_ID[memberId] ?? null : null)),
    [save.team],
  )
  const teamBonus = useMemo(() => getTeamBonus(teamTemplates), [teamTemplates])
  const ownedCharacters = useMemo(() => {
    return Object.entries(save.owned)
      .map(([characterId, owned]) => getCharacterDetails(TEMPLATE_BY_ID[characterId], owned, teamBonus))
      .sort((left, right) => {
        const rarityDifference = RARITY_ORDER.indexOf(right.rarity) - RARITY_ORDER.indexOf(left.rarity)
        if (rarityDifference !== 0) {
          return rarityDifference
        }

        return right.stats.atk - left.stats.atk
      })
  }, [save.owned, teamBonus])

  const resolvedSelectedCharacterId =
    ownedCharacters.find((character) => character.template.id === selectedCharacterId)?.template.id ??
    ownedCharacters[0]?.template.id ??
    'sol-ssr'
  const selectedCharacter =
    ownedCharacters.find((character) => character.template.id === resolvedSelectedCharacterId) ?? ownedCharacters[0] ?? null
  const canClaimDaily = save.login.lastClaimDate !== getTodayKey()

  const showNotice = (message: string) => {
    setNotice(message)
  }

  const triggerBurst = (element: ElementType, intensity: number) => {
    setBurst((previous) => ({
      key: previous.key + 1,
      element,
      intensity,
    }))
  }

  const updateSave = (updater: (previous: SaveData) => SaveData) => {
    setSave((previous) => updater(previous))
  }

  const toggleAudio = () => {
    playTone(420, 0.08, 'triangle')
    updateSave((previous) => ({
      ...previous,
      audioEnabled: !previous.audioEnabled,
    }))
  }

  const toggleFullscreen = async () => {
    playTone(520, 0.08, 'sawtooth')
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen()
    }
  }

  const assignCharacterToSlot = (characterId: string) => {
    playTone(540, 0.07, 'triangle')
    updateSave((previous) => {
      const nextTeam = [...previous.team]
      const existingSlot = nextTeam.findIndex((memberId) => memberId === characterId)
      if (existingSlot >= 0) {
        nextTeam[existingSlot] = null
      }
      nextTeam[selectedSlot] = characterId

      return {
        ...previous,
        team: nextTeam,
      }
    })
    setSelectedCharacterId(characterId)
    showNotice(`Assigned ${TEMPLATE_BY_ID[characterId].name} to slot ${selectedSlot + 1}.`)
  }

  const clearSelectedSlot = () => {
    const memberId = save.team[selectedSlot]
    if (!memberId) {
      return
    }

    playTone(220, 0.06, 'square')
    updateSave((previous) => {
      const nextTeam = [...previous.team]
      nextTeam[selectedSlot] = null
      return {
        ...previous,
        team: nextTeam,
      }
    })
    showNotice(`Removed ${TEMPLATE_BY_ID[memberId].name} from the team.`)
  }

  const runSummon = (count: 1 | 10) => {
    const cost = count === 10 ? MULTI_SUMMON_COST : SINGLE_SUMMON_COST
    if (save.resources.stones < cost) {
      showNotice('Not enough Dragon Stones for that summon.')
      playTone(160, 0.14, 'square')
      return
    }

    const pulls = Array.from({ length: count }, (_, index) => summonCharacter(count === 10 && index === count - 1))
    const next = structuredClone(save)
    next.resources.stones -= cost
    for (const pulled of pulls) {
      const owned = next.owned[pulled.id]
      if (owned) {
        owned.copies += 1
        next.resources.zeni += 500 + RARITY_ORDER.indexOf(pulled.rarity) * 350
      } else {
        next.owned[pulled.id] = {
          level: 1,
          copies: 1,
          awakenings: 0,
        }
        const firstOpenSlot = next.team.findIndex((memberId) => memberId === null)
        if (firstOpenSlot >= 0) {
          next.team[firstOpenSlot] = pulled.id
        }
      }
    }

    playTone(720, 0.12, 'triangle')
    navigator.vibrate?.(20)
    setSave(next)
    setSummonResults(pulls)
    const rarePull = pulls.some((character) => RARITY_ORDER.indexOf(character.rarity) >= RARITY_ORDER.indexOf('SSR'))
    triggerBurst(rarePull ? pulls[pulls.length - 1].element : 'PHY', rarePull ? 12 : 7)
    showNotice(count === 10 ? 'Multi-summon complete. Guaranteed SSR slot delivered.' : 'Single summon complete.')
  }

  const trainSelectedCharacter = () => {
    if (!selectedCharacter) {
      return
    }

    if (save.resources.capsules <= 0) {
      showNotice('You need training capsules first.')
      playTone(180, 0.1, 'square')
      return
    }

    const levelGain = 5
    playTone(620, 0.12, 'triangle')

    updateSave((previous) => {
      const next = structuredClone(previous)
      const owned = next.owned[selectedCharacter.template.id]
      const currentRarity = getDisplayRarity(selectedCharacter.template.rarity, owned.awakenings)
      const maxLevel = LEVEL_CAPS[currentRarity]
      owned.level = Math.min(maxLevel, owned.level + levelGain)
      next.resources.capsules -= 1
      next.resources.zeni = Math.max(0, next.resources.zeni - 450)
      return next
    })

    showNotice(`${selectedCharacter.template.name} gained training experience.`)
  }

  const awakenSelectedCharacter = () => {
    if (!selectedCharacter) {
      return
    }

    const nextRarity = getNextRarity(selectedCharacter.rarity)
    if (nextRarity === selectedCharacter.rarity) {
      showNotice('This unit has reached the highest awakening tier.')
      playTone(180, 0.1, 'square')
      return
    }

    const medalCost = MEDAL_COSTS[selectedCharacter.rarity]
    if (save.resources.medals < medalCost) {
      showNotice('Not enough awakening medals.')
      playTone(180, 0.1, 'square')
      return
    }

    if (selectedCharacter.owned.level < selectedCharacter.maxLevel) {
      showNotice('Reach max level before awakening.')
      playTone(180, 0.1, 'square')
      return
    }

    playTone(840, 0.14, 'sawtooth')
    triggerBurst(selectedCharacter.template.element, 14)
    updateSave((previous) => {
      const next = structuredClone(previous)
      next.owned[selectedCharacter.template.id].awakenings += 1
      next.resources.medals -= medalCost
      next.resources.zeni = Math.max(0, next.resources.zeni - 1200)
      return next
    })
    showNotice(`${selectedCharacter.template.name} awakened to ${nextRarity}.`)
  }

  const startStage = (stage: StageDefinition) => {
    if (save.team.some((memberId) => memberId === null)) {
      showNotice('Fill all 6 team slots before entering battle.')
      playTone(160, 0.12, 'square')
      return
    }

    if (save.resources.stamina < stage.staminaCost) {
      showNotice('Not enough stamina for this stage.')
      playTone(160, 0.12, 'square')
      return
    }

    const stageTeam = save.team
      .map((memberId) => (memberId ? getCharacterDetails(TEMPLATE_BY_ID[memberId], save.owned[memberId], teamBonus) : null))
      .filter((member): member is DerivedCharacter => member !== null)

    const teamHP = stageTeam.reduce((total, member) => total + member.stats.hp, 0)
    const battle: BattleState = {
      stageId: stage.id,
      enemyName: stage.enemyName,
      enemyElement: stage.enemyElement,
      enemyHP: stage.enemyHP,
      enemyMaxHP: stage.enemyHP,
      enemyAtk: stage.enemyAtk,
      enemyDef: stage.enemyDef,
      teamHP,
      teamMaxHP: teamHP,
      turn: 1,
      activeSlot: 0,
      ki: Object.fromEntries(stageTeam.map((member) => [member.template.id, stage.mode === 'Endgame' ? 2 : 0])),
      orbGrid: createOrbGrid(),
      log: [`${stage.name} begins. Connect matching Ki orbs to attack.`],
    }

    playTone(360, 0.18, 'triangle')
    updateSave((previous) => ({
      ...previous,
      resources: {
        ...previous.resources,
        stamina: previous.resources.stamina - stage.staminaCost,
      },
      battle,
    }))
    setActiveTab('Battle')
    showNotice(`${stage.name} started.`)
  }

  const resolveBattleAction = (orbIndex: number) => {
    if (!save.battle) {
      return
    }

    const battle = save.battle
    const chain = findOrbChain(battle.orbGrid, orbIndex)
    if (chain.length < 2) {
      showNotice('Connect at least 2 adjacent orbs to attack.')
      playTone(180, 0.1, 'square')
      return
    }

    const slotId = save.team[battle.activeSlot]
    if (!slotId) {
      showNotice('Active slot is empty.')
      return
    }

    const actingCharacter = getCharacterDetails(TEMPLATE_BY_ID[slotId], save.owned[slotId], teamBonus)
    const orbElement = battle.orbGrid[orbIndex]
    let outcomeTab: Tab | null = null
    playTone(orbElement === actingCharacter.template.element ? 760 : 540, 0.12, 'triangle')
    navigator.vibrate?.(30)
    triggerBurst(orbElement, chain.length + 6)
    triggerBurst(orbElement, chain.length + 6)

    const next = structuredClone(save)
    const liveBattle = next.battle
    if (!liveBattle) {
      return
    }

    const currentSlotId = next.team[liveBattle.activeSlot]
    if (!currentSlotId) {
      return
    }

    const currentCharacter = getCharacterDetails(TEMPLATE_BY_ID[currentSlotId], next.owned[currentSlotId], teamBonus)
    const currentKi = liveBattle.ki[currentSlotId] ?? 0
    const kiGain = chain.length + (orbElement === currentCharacter.template.element ? 2 : 0)
    const nextKi = Math.min(24, currentKi + kiGain)
    liveBattle.ki[currentSlotId] = nextKi

    let attackType: BattleAction = 'Basic Attack'
    if (nextKi >= 18) {
      attackType = 'Ultimate Attack'
    } else if (nextKi >= 12) {
      attackType = 'Super Attack'
    }

    const typeMultiplier = getTypeMultiplier(currentCharacter.template.element, liveBattle.enemyElement)
    const chainMultiplier = 1 + chain.length * 0.17
    const skillMultiplier = attackType === 'Ultimate Attack' ? 2.3 : attackType === 'Super Attack' ? 1.6 : 1
    const damage = Math.max(
      120,
      Math.round(currentCharacter.stats.atk * chainMultiplier * skillMultiplier * typeMultiplier - liveBattle.enemyDef * 0.55),
    )

    liveBattle.enemyHP = Math.max(0, liveBattle.enemyHP - damage)
    liveBattle.orbGrid = replaceOrbChain(liveBattle.orbGrid, chain)
    liveBattle.log.unshift(
      `${currentCharacter.template.name} used ${attackType} for ${damage} damage with a ${chain.length}-orb ${orbElement} chain.`,
    )

    if (liveBattle.enemyHP <= 0) {
      const stage = getStageById(liveBattle.stageId)
      next.resources.stones += stage.rewards.stones
      next.resources.zeni += stage.rewards.zeni
      next.resources.medals += stage.rewards.medals
      next.resources.capsules += stage.rewards.capsules
      next.lastResult = {
        outcome: 'Victory',
        stageId: liveBattle.stageId,
        rewards: {
          stones: stage.rewards.stones,
          zeni: stage.rewards.zeni,
          stamina: 0,
          maxStamina: 0,
          medals: stage.rewards.medals,
          capsules: stage.rewards.capsules,
        },
        summary: `${currentCharacter.template.name} finished ${liveBattle.enemyName} with a cinematic ${attackType.toLowerCase()}.`,
      }
      next.battle = null
      outcomeTab = 'Results'
      setSave(next)
      if (outcomeTab) {
        playTone(880, 0.2, 'sawtooth')
        setActiveTab(outcomeTab)
      }
      return
    }

    const enemyDamage = Math.max(
      80,
      Math.round(
        liveBattle.enemyAtk * getTypeMultiplier(liveBattle.enemyElement, currentCharacter.template.element) -
          currentCharacter.stats.def * 0.32,
      ),
    )
    liveBattle.teamHP = Math.max(0, liveBattle.teamHP - enemyDamage)
    liveBattle.log.unshift(`${liveBattle.enemyName} countered for ${enemyDamage} damage.`)
    liveBattle.activeSlot = (liveBattle.activeSlot + 1) % MAX_TEAM_SIZE
    liveBattle.turn += 1

    if (liveBattle.teamHP <= 0) {
      next.lastResult = {
        outcome: 'Defeat',
        stageId: liveBattle.stageId,
        rewards: {
          stones: 0,
          zeni: 250,
          stamina: 0,
          maxStamina: 0,
          medals: 2,
          capsules: 0,
        },
        summary: `${liveBattle.enemyName} survived the rush, but the team still salvaged battle data.`,
      }
      next.resources.zeni += 250
      next.resources.medals += 2
      next.battle = null
      outcomeTab = 'Results'
    }

    setSave(next)

    if (outcomeTab) {
      playTone(outcomeTab === 'Results' ? 880 : 200, 0.2, 'sawtooth')
      setActiveTab(outcomeTab)
    }
  }

  const claimDailyReward = () => {
    if (!canClaimDaily) {
      showNotice('Daily reward already claimed.')
      return
    }

    playTone(660, 0.16, 'triangle')
    updateSave((previous) => ({
      ...previous,
      resources: {
        stones: previous.resources.stones + DAILY_REWARD.stones,
        zeni: previous.resources.zeni + DAILY_REWARD.zeni,
        stamina: Math.min(previous.resources.maxStamina, previous.resources.stamina + DAILY_REWARD.stamina),
        maxStamina: previous.resources.maxStamina,
        medals: previous.resources.medals + DAILY_REWARD.medals,
        capsules: previous.resources.capsules + DAILY_REWARD.capsules,
      },
      login: {
        lastClaimDate: getTodayKey(),
        streak: previous.login.streak + 1,
      },
    }))
    showNotice('Daily reward claimed. Login streak extended.')
  }

  const resetProgress = () => {
    playTone(240, 0.12, 'square')
    const fresh = createInitialSave()
    setSave(fresh)
    setSummonResults([])
    setSelectedCharacterId('sol-ssr')
    setActiveTab('Home')
    showNotice('Progress reset to the starter roster.')
  }

  const currentBattleMembers = save.team
    .map((memberId) => (memberId ? getCharacterDetails(TEMPLATE_BY_ID[memberId], save.owned[memberId], teamBonus) : null))
    .filter((member): member is DerivedCharacter => member !== null)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_38%),linear-gradient(180deg,_#020617,_#0f172a_36%,_#111827)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-32 pt-4 sm:px-6">
        <header className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Mobile Anime Gacha RPG</p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Astral Legends: Ki Breakers</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Build a six-fighter squad, summon rare units, awaken heroes, and clear story, event, and endgame
                content with touch-friendly ki-orb combat.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[240px]">
              <button
                type="button"
                onClick={toggleAudio}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white"
              >
                {save.audioEnabled ? 'Audio On' : 'Audio Off'}
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white"
              >
                Fullscreen
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('Login Rewards')}
                className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100"
              >
                Login Rewards
              </button>
              <button
                type="button"
                onClick={resetProgress}
                className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100"
              >
                Reset Save
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-3xl border border-amber-300/15 bg-amber-400/10 p-3">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Stones</p>
              <p className="mt-1 text-2xl font-black text-white">{save.resources.stones}</p>
            </div>
            <div className="rounded-3xl border border-emerald-300/15 bg-emerald-400/10 p-3">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Zeni</p>
              <p className="mt-1 text-2xl font-black text-white">{formatNumber(save.resources.zeni)}</p>
            </div>
            <div className="rounded-3xl border border-sky-300/15 bg-sky-400/10 p-3">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-200">Stamina</p>
              <p className="mt-1 text-2xl font-black text-white">
                {save.resources.stamina}/{save.resources.maxStamina}
              </p>
            </div>
            <div className="rounded-3xl border border-violet-300/15 bg-violet-400/10 p-3">
              <p className="text-xs uppercase tracking-[0.3em] text-violet-200">Medals</p>
              <p className="mt-1 text-2xl font-black text-white">{save.resources.medals}</p>
            </div>
            <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/10 p-3">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Capsules</p>
              <p className="mt-1 text-2xl font-black text-white">{save.resources.capsules}</p>
            </div>
          </div>
        </header>

        <main className="mt-5 grid flex-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5">
            {activeTab === 'Home' && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Featured banner</p>
                      <h2 className="mt-2 text-2xl font-black text-white">Celestial Impact Festival</h2>
                      <p className="mt-3 text-sm text-slate-300">
                        Multi-summons guarantee SSR or better, featured units have boosted rates, and duplicate pulls
                        convert into limit-break copies plus bonus zeni.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
                        {['Guaranteed SSR on multi', 'Featured LR/UR chance', 'Persistent local save', 'Offline PWA menus'].map(
                          (tag) => (
                            <span key={tag} className="rounded-full bg-white/10 px-3 py-1">
                              {tag}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                      {ownedCharacters.slice(0, 4).map((character) => (
                        <div
                          key={character.template.id}
                          className={`rounded-3xl border border-white/10 bg-gradient-to-br ${RARITY_STYLES[character.rarity]} p-[1px]`}
                        >
                          <div className="rounded-[calc(1.5rem-1px)] bg-slate-950/85 p-3">
                            <p className="text-xs uppercase tracking-[0.3em] text-white/80">{character.rarity}</p>
                            <p className="mt-2 text-lg font-black text-white">{character.template.name}</p>
                            <p className="text-xs text-white/75">{character.template.aura}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                <div className="grid gap-5 md:grid-cols-2">
                  <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Team bonus</p>
                        <h2 className="mt-2 text-xl font-black text-white">Leader & Tags</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('Team Builder')}
                        className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-100"
                      >
                        Edit Team
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{teamBonus.leaderText}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-3xl bg-white/5 p-3">
                        <p className="text-slate-400">HP Bonus</p>
                        <p className="mt-1 text-xl font-black text-white">+{Math.round(teamBonus.hpBoost * 100)}%</p>
                      </div>
                      <div className="rounded-3xl bg-white/5 p-3">
                        <p className="text-slate-400">ATK Bonus</p>
                        <p className="mt-1 text-xl font-black text-white">+{Math.round(teamBonus.atkBoost * 100)}%</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {teamBonus.sharedTags.length > 0 ? (
                        teamBonus.sharedTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-100">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                          Mix matching tags to unlock stronger bonuses.
                        </span>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                    <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Content overview</p>
                    <h2 className="mt-2 text-xl font-black text-white">Playable Modes</h2>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="rounded-3xl bg-white/5 p-4">
                        <p className="font-semibold text-white">Story Chapters</p>
                        <p>Mission stages, boss fights, and quick clear objectives.</p>
                      </div>
                      <div className="rounded-3xl bg-white/5 p-4">
                        <p className="font-semibold text-white">Daily & Medal Events</p>
                        <p>Farm capsules, zeni, and medals for powering up your roster.</p>
                      </div>
                      <div className="rounded-3xl bg-white/5 p-4">
                        <p className="font-semibold text-white">Endgame Challenges</p>
                        <p>Boss Rush and Infinite Tower stages with harder modifiers and better rewards.</p>
                      </div>
                    </div>
                  </section>
                </div>
              </>
            )}

            {activeTab === 'Team Builder' && (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">6-character team building</p>
                    <h2 className="mt-2 text-2xl font-black text-white">Choose Your Formation</h2>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedSlot}
                    className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100"
                  >
                    Clear Selected Slot
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {save.team.map((memberId, index) => {
                    const member = memberId ? TEMPLATE_BY_ID[memberId] : null
                    return (
                      <button
                        key={`slot-${index}`}
                        type="button"
                        onClick={() => setSelectedSlot(index)}
                        className={`rounded-3xl border p-4 text-left ${
                          selectedSlot === index
                            ? 'border-cyan-300 bg-cyan-400/10'
                            : 'border-white/10 bg-white/5 hover:border-white/25'
                        }`}
                      >
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Slot {index + 1}</p>
                        <p className="mt-2 text-sm font-bold text-white">{member?.name ?? 'Empty Slot'}</p>
                        <p className="mt-1 text-xs text-slate-400">{member ? member.title : 'Tap a unit below to assign.'}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 grid gap-4">
                  {ownedCharacters.map((character) => (
                    <CharacterCard
                      key={character.template.id}
                      character={character}
                      selected={selectedCharacterId === character.template.id}
                      onClick={() => assignCharacterToSlot(character.template.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'Character Box' && (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Character inventory</p>
                <h2 className="mt-2 text-2xl font-black text-white">Character Box</h2>
                <div className="mt-5 grid gap-4">
                  {ownedCharacters.map((character) => (
                    <CharacterCard
                      key={character.template.id}
                      character={character}
                      selected={selectedCharacterId === character.template.id}
                      onClick={() => {
                        playTone(520, 0.07, 'triangle')
                        setSelectedCharacterId(character.template.id)
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'Summon' && (
              <section className="space-y-5">
                <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                  <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Flashy summon system</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Summon Gate</h2>
                  <p className="mt-3 text-sm text-slate-300">
                    Featured banners, duplicate handling, dramatic pull reveals, and guaranteed SSR on every multi.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => runSummon(1)}
                      className="rounded-3xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-4 text-sm font-black uppercase tracking-[0.3em] text-slate-950"
                    >
                      Single • {SINGLE_SUMMON_COST} Stones
                    </button>
                    <button
                      type="button"
                      onClick={() => runSummon(10)}
                      className="rounded-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 px-5 py-4 text-sm font-black uppercase tracking-[0.3em] text-slate-950"
                    >
                      Multi • {MULTI_SUMMON_COST} Stones • SSR Guaranteed
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {summonResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5"
                    >
                      <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Summon results</p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {summonResults.map((character, index) => (
                          <motion.div
                            key={`${character.id}-${index}`}
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className={`rounded-3xl border border-white/10 bg-gradient-to-br ${RARITY_STYLES[getDisplayRarity(
                              character.rarity,
                              0,
                            )]} p-[1px]`}
                          >
                            <div className="rounded-[calc(1.5rem-1px)] bg-slate-950/85 p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                                    {character.rarity} • {character.element}
                                  </p>
                                  <p className="mt-2 text-lg font-black text-white">{character.name}</p>
                                  <p className="text-sm text-white/70">{character.title}</p>
                                </div>
                                <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                                  {save.owned[character.id] ? `Copies ${save.owned[character.id].copies}` : 'New'}
                                </div>
                              </div>
                              <p className="mt-3 text-sm text-white/80">{character.aura}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {(activeTab === 'Story' || activeTab === 'Events') && (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">
                  {activeTab === 'Story' ? 'Story chapters' : 'Daily & limited events'}
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">{activeTab}</h2>
                <div className="mt-5 grid gap-4">
                  {(activeTab === 'Story' ? STORY_STAGES : EVENT_STAGES).map((stage) => (
                    <div key={stage.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{stage.chapter}</p>
                          <h3 className="mt-2 text-xl font-bold text-white">{stage.name}</h3>
                          <p className="mt-1 text-sm text-slate-300">
                            Enemy: {stage.enemyName} • {ELEMENT_LABELS[stage.enemyElement]} • {stage.enemyHP} HP
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {stage.modifiers.map((modifier) => (
                              <span key={modifier} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                                {modifier}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => startStage(stage)}
                          className="rounded-3xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-4 text-sm font-black uppercase tracking-[0.3em] text-slate-950"
                        >
                          Start • {stage.staminaCost} Stamina
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'Upgrade' && selectedCharacter && (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Progression systems</p>
                <h2 className="mt-2 text-2xl font-black text-white">Upgrade & Awakening</h2>
                <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className={`rounded-[2rem] bg-gradient-to-br ${RARITY_STYLES[selectedCharacter.rarity]} p-[1px]`}>
                    <div className="rounded-[calc(2rem-1px)] bg-slate-950/90 p-5">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">{selectedCharacter.rarity}</p>
                      <h3 className="mt-2 text-2xl font-black text-white">{selectedCharacter.template.name}</h3>
                      <p className="text-sm text-white/75">{selectedCharacter.template.title}</p>
                      <p className="mt-4 text-sm text-white/80">{selectedCharacter.template.aura}</p>
                      <div className="mt-5 space-y-3 text-sm">
                        <p className="rounded-2xl bg-white/5 p-3 text-white">
                          <span className="font-semibold text-cyan-200">Leader:</span> {selectedCharacter.template.leaderSkill}
                        </p>
                        <p className="rounded-2xl bg-white/5 p-3 text-white">
                          <span className="font-semibold text-cyan-200">Passive:</span> {selectedCharacter.template.passiveSkill}
                        </p>
                        <p className="rounded-2xl bg-white/5 p-3 text-white">
                          <span className="font-semibold text-cyan-200">Super:</span> {selectedCharacter.template.superAttack}
                        </p>
                        <p className="rounded-2xl bg-white/5 p-3 text-white">
                          <span className="font-semibold text-cyan-200">Ultimate:</span> {selectedCharacter.template.ultimateAttack}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-3xl bg-white/5 p-3">
                        <p className="text-xs text-slate-400">HP</p>
                        <p className="mt-1 text-xl font-black text-white">{selectedCharacter.stats.hp}</p>
                      </div>
                      <div className="rounded-3xl bg-white/5 p-3">
                        <p className="text-xs text-slate-400">ATK</p>
                        <p className="mt-1 text-xl font-black text-white">{selectedCharacter.stats.atk}</p>
                      </div>
                      <div className="rounded-3xl bg-white/5 p-3">
                        <p className="text-xs text-slate-400">DEF</p>
                        <p className="mt-1 text-xl font-black text-white">{selectedCharacter.stats.def}</p>
                      </div>
                      <div className="rounded-3xl bg-white/5 p-3">
                        <p className="text-xs text-slate-400">SPD</p>
                        <p className="mt-1 text-xl font-black text-white">{selectedCharacter.stats.speed}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-white/5 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">Level Progress</span>
                        <span className="font-semibold text-white">
                          {selectedCharacter.owned.level}/{selectedCharacter.maxLevel}
                        </span>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                          style={{
                            width: `${(selectedCharacter.owned.level / selectedCharacter.maxLevel) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-slate-400">
                        Copies: {selectedCharacter.owned.copies} • Awakening Steps: {selectedCharacter.owned.awakenings}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={trainSelectedCharacter}
                        className="rounded-3xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-slate-950"
                      >
                        Train • 1 Capsule
                      </button>
                      <button
                        type="button"
                        onClick={awakenSelectedCharacter}
                        className="rounded-3xl bg-gradient-to-r from-violet-400 to-pink-500 px-5 py-4 text-sm font-black uppercase tracking-[0.25em] text-white"
                      >
                        Awaken • {MEDAL_COSTS[selectedCharacter.rarity]} Medals
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'Battle' && (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                {save.battle ? (
                  <>
                    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 p-5">
                      <BattleCanvas burst={burst} />
                      <div className="relative z-10 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                        <div>
                          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Battle Phase</p>
                          <h2 className="mt-2 text-2xl font-black text-white">{getStageById(save.battle.stageId).name}</h2>
                          <p className="mt-2 text-sm text-slate-300">
                            Connect adjacent matching Ki orbs. Bigger chains raise damage and charge Super/Ultimate attacks.
                          </p>

                          <div className="mt-5 space-y-4">
                            <div className="rounded-3xl bg-white/5 p-4">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-white">{save.battle.enemyName}</p>
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                                  {save.battle.enemyElement}
                                </span>
                              </div>
                              <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
                                  style={{ width: `${(save.battle.enemyHP / save.battle.enemyMaxHP) * 100}%` }}
                                />
                              </div>
                              <p className="mt-2 text-sm text-slate-300">
                                HP {save.battle.enemyHP}/{save.battle.enemyMaxHP}
                              </p>
                            </div>

                            <div className="rounded-3xl bg-white/5 p-4">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-white">Team HP</p>
                                <p className="text-sm text-slate-300">
                                  {save.battle.teamHP}/{save.battle.teamMaxHP}
                                </p>
                              </div>
                              <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                                  style={{ width: `${(save.battle.teamHP / save.battle.teamMaxHP) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[2rem] border border-white/10 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Rotation</p>
                          <div className="mt-4 grid gap-3">
                            {currentBattleMembers.map((member, index) => (
                              <div
                                key={member.template.id}
                                className={`rounded-3xl border p-3 ${
                                  save.battle?.activeSlot === index
                                    ? 'border-cyan-300 bg-cyan-400/10'
                                    : 'border-white/10 bg-white/5'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-white">{member.template.name}</p>
                                    <p className="text-xs text-slate-400">
                                      {member.template.element} • Ki {(save.battle?.ki[member.template.id] ?? 0).toString()}
                                    </p>
                                  </div>
                                  <div className="text-right text-xs text-slate-300">
                                    <p>ATK {member.stats.atk}</p>
                                    <p>DEF {member.stats.def}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-5 gap-2">
                      {save.battle.orbGrid.map((orb, index) => (
                        <button
                          key={`${orb}-${index}`}
                          type="button"
                          onClick={() => resolveBattleAction(index)}
                          className="aspect-square rounded-[1.25rem] border border-white/10 p-1 shadow-lg transition hover:scale-[1.03]"
                          style={{
                            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), ${ELEMENT_COLORS[orb]})`,
                          }}
                          aria-label={`Collect ${orb} orb ${index + 1}`}
                        />
                      ))}
                    </div>

                    <div className="mt-5 rounded-[2rem] border border-white/10 bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Battle log</p>
                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        {save.battle.log.slice(0, 6).map((entry) => (
                          <p key={entry} className="rounded-2xl bg-white/5 p-3">
                            {entry}
                          </p>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/5 p-10 text-center">
                    <p className="text-lg font-semibold text-white">No battle is active right now.</p>
                    <p className="mt-2 text-sm text-slate-300">Start a Story or Event stage to enter combat.</p>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'Results' && (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Battle summary</p>
                <h2 className="mt-2 text-2xl font-black text-white">Results</h2>
                {save.lastResult ? (
                  <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                    <div
                      className={`rounded-[2rem] p-[1px] ${
                        save.lastResult.outcome === 'Victory'
                          ? 'bg-gradient-to-br from-emerald-300 to-cyan-400'
                          : 'bg-gradient-to-br from-rose-300 to-orange-500'
                      }`}
                    >
                      <div className="rounded-[calc(2rem-1px)] bg-slate-950/90 p-5">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/70">{save.lastResult.stageId}</p>
                        <h3 className="mt-2 text-3xl font-black text-white">{save.lastResult.outcome}</h3>
                        <p className="mt-3 text-sm text-slate-300">{save.lastResult.summary}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['Stones', save.lastResult.rewards.stones],
                        ['Zeni', save.lastResult.rewards.zeni],
                        ['Medals', save.lastResult.rewards.medals],
                        ['Capsules', save.lastResult.rewards.capsules],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-3xl bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
                          <p className="mt-2 text-2xl font-black text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-300">Clear a stage to populate the results panel.</p>
                )}
              </section>
            )}

            {activeTab === 'Login Rewards' && (
              <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Daily progression</p>
                <h2 className="mt-2 text-2xl font-black text-white">Login Rewards</h2>
                <div className="mt-5 grid gap-5 md:grid-cols-[0.7fr_1.3fr]">
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-slate-300">Current streak</p>
                    <p className="mt-2 text-4xl font-black text-white">{save.login.streak} days</p>
                    <button
                      type="button"
                      onClick={claimDailyReward}
                      className="mt-5 w-full rounded-3xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.3em] text-slate-950"
                    >
                      {canClaimDaily ? 'Claim Reward' : 'Already Claimed'}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['Dragon Stones', DAILY_REWARD.stones],
                      ['Zeni', DAILY_REWARD.zeni],
                      ['Stamina', DAILY_REWARD.stamina],
                      ['Awakening Medals', DAILY_REWARD.medals],
                      ['Training Capsules', DAILY_REWARD.capsules],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-3xl bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</p>
                        <p className="mt-2 text-2xl font-black text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Selected unit</p>
              {selectedCharacter ? (
                <>
                  <div className={`mt-3 rounded-[2rem] bg-gradient-to-br ${RARITY_STYLES[selectedCharacter.rarity]} p-[1px]`}>
                    <div className="rounded-[calc(2rem-1px)] bg-slate-950/85 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                            {selectedCharacter.rarity} • {selectedCharacter.template.element}
                          </p>
                          <h2 className="mt-2 text-2xl font-black text-white">{selectedCharacter.template.name}</h2>
                          <p className="text-sm text-white/75">{selectedCharacter.template.title}</p>
                        </div>
                        <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                          Copies {selectedCharacter.owned.copies}
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-white/85">{selectedCharacter.template.aura}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedCharacter.template.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/85">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-3xl bg-white/5 p-3">
                      <p className="text-slate-400">Super</p>
                      <p className="mt-1 font-semibold text-white">{selectedCharacter.template.superAttack}</p>
                    </div>
                    <div className="rounded-3xl bg-white/5 p-3">
                      <p className="text-slate-400">Ultimate</p>
                      <p className="mt-1 font-semibold text-white">{selectedCharacter.template.ultimateAttack}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-300">Summon or unlock a character to inspect details here.</p>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Quick access</p>
              <div className="mt-4 grid gap-3">
                {[
                  ['Home', 'Overview of banners, bonuses, and progression.'],
                  ['Summon', 'Pull featured units and handle duplicates.'],
                  ['Story', 'Advance chapters with stamina-based missions.'],
                  ['Events', 'Farm capsules, medals, and challenge rewards.'],
                  ['Upgrade', 'Train, awaken, and prep for endgame.'],
                  ['Results', 'Review your most recent clear.'],
                ].map(([tab, description]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      playTone(520, 0.07, 'triangle')
                      setActiveTab(tab as Tab)
                    }}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left hover:border-white/25"
                  >
                    <p className="font-semibold text-white">{tab}</p>
                    <p className="mt-1 text-sm text-slate-400">{description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Endgame lineup</p>
              <div className="mt-4 space-y-3">
                {ENDGAME_STAGES.map((stage) => (
                  <div key={stage.id} className="rounded-3xl bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{stage.name}</p>
                        <p className="text-sm text-slate-400">{stage.enemyName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startStage(stage)}
                        className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-100"
                      >
                        Launch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto grid max-w-6xl grid-cols-5 gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  playTone(460, 0.05, 'triangle')
                  setActiveTab(tab)
                }}
                className={`rounded-2xl px-2 py-3 text-[11px] font-bold uppercase tracking-[0.18em] ${
                  activeTab === tab
                    ? 'bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.4)]'
                    : 'bg-white/5 text-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </nav>

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed bottom-28 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border border-cyan-300/30 bg-slate-950/95 px-4 py-3 text-center text-sm font-semibold text-cyan-50 shadow-2xl"
            >
              {notice}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default App
