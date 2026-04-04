export interface Player {
  name: string;
  team: string;
  position: string;
  jersey_number: number;
  conf: string;
  div: string;
}

export interface LeaderboardEntry {
  name: string;
  guess_count: number;
  mode: string;
  puzzle_key: string;
  puzzle_type: string;
  timestamp: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  mode: string;
  puzzle_key: string;
  puzzle_type: string;
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
export const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

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

export async function getDailyPlayer(fantasyOnly: boolean = false): Promise<Player | null> {
  try {
    const url = new URL(`${BACKEND_URL}/api/daily`);
    if (fantasyOnly) {
      url.searchParams.set('fantasy_only', 'true');
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

export async function getAllPlayers(fantasyOnly: boolean = false): Promise<Player[]> {
  try {
    const url = new URL(`${BACKEND_URL}/api/players`);
    if (fantasyOnly) {
      url.searchParams.set('fantasy_only', 'true');
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

export async function getWeeklyPlayer(): Promise<Player | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/weekly`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch weekly player");
    const player = await res.json();
    return isPlayer(player) ? player : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getLeaderboard(puzzleType: "daily" | "weekly", mode: "standard" | "fantasy" | "weekly", puzzleKey: string) {
  const url = new URL(`${BACKEND_URL}/api/leaderboard`);
  url.searchParams.set("puzzle_type", puzzleType);
  url.searchParams.set("mode", mode);
  url.searchParams.set("puzzle_key", puzzleKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return (await res.json()) as LeaderboardResponse;
}

export async function submitLeaderboardEntry(payload: {
  name: string;
  puzzle_type: "daily" | "weekly";
  mode: "standard" | "fantasy" | "weekly";
  puzzle_key: string;
  guess_count: number;
}) {
  const res = await fetch(`${BACKEND_URL}/api/leaderboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit leaderboard score");
  return (await res.json()) as { status: string; entries: LeaderboardEntry[] };
}

export async function submitWaitlistEmail(payload: { email: string; source: string }) {
  const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save email");
  return (await res.json()) as { status: string; count: number };
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
