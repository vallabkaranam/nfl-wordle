import Game from "../components/Game";
import { getAllPlayers, getDailyPlayer } from "../lib/gameLogic";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [standardDaily, offenseDaily, allPlayers] = await Promise.all([
    getDailyPlayer(false),
    getDailyPlayer(true),
    getAllPlayers()
  ]);

  if (!standardDaily || !offenseDaily) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Error Loading Game</h1>
          <p className="text-zinc-400">Could not fetch daily player data from backend.</p>
          <p className="text-xs text-zinc-600 mt-4">Make sure backend is running on :8000</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-zinc-950">
      <Game standardDaily={standardDaily} offenseDaily={offenseDaily} allPlayers={allPlayers} />
    </main>
  );
}
