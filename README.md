# Astral Legends: Ki Breakers

A playable mobile-first anime gacha RPG built with React, TypeScript, Tailwind CSS, Framer Motion, and Vite.

## Included gameplay

- 6-character team builder with element, rarity, tags, passives, leader skills, super attacks, and ultimate attacks
- Single and multi-summon banner with guaranteed SSR on multis and duplicate copy handling
- Character leveling and awakening with medals and capsules
- Turn-based ki-orb battle system with type advantage and canvas effects
- Story, event, and endgame stages with stamina costs and rewards
- Daily login rewards and persistent autosave with localStorage
- PWA manifest and offline asset caching for installable mobile play
- Lightweight generated audio cues for menu, summon, and battle moments

## Getting started

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

## Notes

- Save data is stored in browser localStorage under `gacha-save-v1`
- Use the fullscreen button or install prompt on supported mobile browsers for an app-like experience
