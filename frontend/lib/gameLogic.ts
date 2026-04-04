export interface Player {
  name: string;
  team: string;
  position: string;
  jersey_number: number;
  conf: string;
  div: string;
}

export interface GuessResult {
  player: Player;
  status: {
    conf: 'correct' | 'incorrect';
    div: 'correct' | 'close' | 'incorrect';
    team: 'correct' | 'incorrect';
    position: 'correct' | 'incorrect';
    jersey: 'correct' | 'higher' | 'lower' | 'incorrect';
  };
  comparison: {
     jersey: '↑' | '↓' | undefined;
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const MAX_GUESSES = 5;
export const OFFENSIVE_POSITIONS = ["QB", "RB", "WR", "TE", "FB"] as const;

function isPlayer(value: unknown): value is Player {
  if (!value || typeof value !== "object") return false;

  const player = value as Record<string, unknown>;
  return (
    typeof player.name === "string" &&
    typeof player.team === "string" &&
    typeof player.position === "string" &&
    typeof player.jersey_number === "number" &&
    typeof player.conf === "string" &&
    typeof player.div === "string"
  );
}

export async function getDailyPlayer(offenseOnly: boolean = false): Promise<Player | null> {
  try {
    const url = new URL(`${BACKEND_URL}/api/daily`);
    if (offenseOnly) {
      url.searchParams.set('offense_only', 'true');
    }
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch daily player');
    const player = await res.json();
    return isPlayer(player) ? player : null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function getAllPlayers(offenseOnly: boolean = false): Promise<Player[]> {
  try {
    const url = new URL(`${BACKEND_URL}/api/players`);
    if (offenseOnly) {
      url.searchParams.set('offense_only', 'true');
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Failed to fetch players');
    const players = await res.json();
    return Array.isArray(players) ? players.filter(isPlayer) : [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export function getPlayerId(player: Player) {
  return `${player.name}::${player.team}::${player.jersey_number}`;
}

export function checkGuess(target: Player, guess: Player): GuessResult {
  return {
    player: guess,
    status: {
      conf: guess.conf === target.conf ? 'correct' : 'incorrect',
      div:
        guess.div === target.div
          ? 'correct'
          : guess.conf === target.conf
          ? 'close' // Same conference, wrong division
          : 'incorrect',
      team: guess.team === target.team ? 'correct' : 'incorrect',
      position: guess.position === target.position ? 'correct' : 'incorrect',
      jersey:
        guess.jersey_number === target.jersey_number
          ? 'correct'
          : guess.jersey_number < target.jersey_number
          ? 'higher' // Guess is lower than target, so target is higher (UP arrow usually means "Go Higher")
          : 'lower', // Guess is higher than target, so target is lower ("Go Lower")
    },
    comparison: {
        jersey: guess.jersey_number < target.jersey_number ? '↑' : guess.jersey_number > target.jersey_number ? '↓' : undefined
    }
  };
}
