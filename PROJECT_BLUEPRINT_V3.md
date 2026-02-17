# MISSION: NFL Wordle Production Overhaul

## 1. Deterministic Daily Logic (Backend)
- **Season:** Fetch full 2025-2026 roster data. "Active" means anyone on a roster.
- **Jersey Fix:** Cast `jersey_number` to an integer (fix the "0" bug).
- **The Seeding Algorithm:** - Use `date.today()` as a seed to pick the `daily_target` player.
  - If `offense_only` is TRUE, use `seed + 100` to pick an alternate target from the offensive subset.
  - This ensures every user worldwide has the same two possible daily players.

## 2. Gameplay & Rules
- **Guess Limit:** Exactly 5 guesses.
- **Toggle Lock:** The "Offense Only" toggle MUST be disabled (locked) immediately after the first guess is submitted.
- **Offense Definition:** QB, RB, WR, TE, FB.

## 3. UI/UX "Next Level" Styling
- **Layout:** Move the Search Box to the TOP (sticky header).
- **Results List:** For every guess, display the [Player Name] and [Team Icon] to the left of the 5 attribute tiles.
- **Winning:** On win (within 5 guesses), show a "TOUCHDOWN!" modal with 🏈 and 🎉 confetti (use `canvas-confetti`).
- **Losing:** On loss (5 guesses), show "TURNOVER ON DOWNS" and reveal the target player.
- **Branding:** - Browser `<title>` and `<h1>` must be "NFL Wordle".
  - Font: Use a bold, condensed "Athletic" sans-serif.
  - Background: `bg-zinc-950` with a subtle football-field grid pattern.

## 4. Search & Performance
- **Fuzzy Matching:** Initialize `fuse.js` on the frontend for lightning-fast name filtering.
- **Fix Errors:** Ensure all hydration errors are resolved by wrapping search components in `useEffect`.