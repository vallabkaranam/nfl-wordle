import Game from "../components/Game";
import { getPuzzleDate, getWeeklyPuzzleKey } from "../lib/daily";
import { getAllPlayers, getDailyPlayer, getWeeklyPlayer } from "../lib/gameLogic";

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const dailyKey = getPuzzleDate();
  const weeklyKey = getWeeklyPuzzleKey();
  const challenge = typeof resolvedSearchParams.challenge === "string" ? resolvedSearchParams.challenge : undefined;
  const initialView = typeof resolvedSearchParams.view === "string" ? resolvedSearchParams.view : undefined;

  const [standardDaily, fantasyDaily, weeklyTarget, allPlayers] = await Promise.all([
    getDailyPlayer(false),
    getDailyPlayer(true),
    getWeeklyPlayer(),
    getAllPlayers()
  ]);

  if (!standardDaily || !fantasyDaily) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Error Loading Game</h1>
          <p className="text-zinc-400">Could not load the daily puzzle right now.</p>
          <p className="text-xs text-zinc-600 mt-4">Check the API health endpoint and deployment logs before launch.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6 sm:py-8">
      <Game
        standardDaily={standardDaily}
        fantasyDaily={fantasyDaily}
        weeklyTarget={weeklyTarget}
        allPlayers={allPlayers}
        dailyKey={dailyKey}
        weeklyKey={weeklyKey}
        challengeToken={challenge}
        initialView={initialView}
      />
    </main>
  );
}
