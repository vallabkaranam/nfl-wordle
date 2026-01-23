export interface Player {
  name: string;
  team: string;
  position: string;
  jersey_number: number;
  headshot: string;
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
}

const BACKEND_URL = 'http://localhost:8000';

export async function getDailyPlayer(): Promise<Player | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/daily`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch daily player');
    return res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/players`);
    if (!res.ok) throw new Error('Failed to fetch players');
    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
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
          ? 'higher'
          : 'lower',
    },
  };
}
