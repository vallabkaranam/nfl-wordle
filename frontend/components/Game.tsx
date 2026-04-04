"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Check, Copy, Flame, Share2, Trophy } from "lucide-react";
import {
  checkGuess,
  getPlayerId,
  GuessResult,
  MAX_GUESSES,
  OFFENSIVE_POSITIONS,
  Player,
} from "../lib/gameLogic";
import { trackEvent } from "../lib/analytics";
import { getPreviousPuzzleDate } from "../lib/daily";
import { cn } from "../lib/utils";
import Search from "./Search";

interface GameProps {
  standardDaily: Player;
  offenseDaily: Player;
  allPlayers: Player[];
  dailyKey: string;
}

type GameStatus = "playing" | "won" | "lost";
type GameMode = "standard" | "offense";
type SavedSession = {
  dailyKey: string;
  mode: GameMode;
  guesses: string[];
  gameStatus: GameStatus;
};
type HistoryEntry = {
  dailyKey: string;
  mode: GameMode;
  outcome: "won" | "lost";
  guessCount: number;
};
type PlayerStats = {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDay: string | null;
  history: HistoryEntry[];
};

const STORAGE_KEY_PREFIX = "roster-riddle";
const STATS_STORAGE_KEY = `${STORAGE_KEY_PREFIX}:stats`;
const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastCompletedDay: null,
  history: [],
};

export default function Game({ standardDaily, offenseDaily, allPlayers: initialPlayers, dailyKey }: GameProps) {
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [offenseOnly, setOffenseOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [isReady, setIsReady] = useState(false);
  const hasTrackedStart = useRef(false);

  const activeMode: GameMode = offenseOnly ? "offense" : "standard";
  const activeTarget = offenseOnly ? offenseDaily : standardDaily;
  const storageKey = `${STORAGE_KEY_PREFIX}:${dailyKey}`;
  const displayedPlayers = useMemo(
    () =>
      offenseOnly
        ? initialPlayers.filter((player) => OFFENSIVE_POSITIONS.includes(player.position as (typeof OFFENSIVE_POSITIONS)[number]))
        : initialPlayers,
    [initialPlayers, offenseOnly]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(() => {
      const rawStats = window.localStorage.getItem(STATS_STORAGE_KEY);
      setStats(rawStats ? parseStats(rawStats) : DEFAULT_STATS);

      const savedSession = window.localStorage.getItem(storageKey);
      if (savedSession) {
        const parsed = parseSession(savedSession);
        if (parsed && parsed.dailyKey === dailyKey) {
          const savedMode = parsed.mode === "offense";
          const restoredTarget = savedMode ? offenseDaily : standardDaily;
          const restoredGuesses = parsed.guesses
            .map((id) => initialPlayers.find((player) => getPlayerId(player) === id))
            .filter((player): player is Player => Boolean(player))
            .map((player) => checkGuess(restoredTarget, player));

          setOffenseOnly(savedMode);
          setGuesses(restoredGuesses);
          setGameStatus(parsed.gameStatus);
        }
      }

      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [dailyKey, initialPlayers, offenseDaily, standardDaily, storageKey]);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;

    const payload: SavedSession = {
      dailyKey,
      mode: activeMode,
      guesses: guesses.map((guess) => getPlayerId(guess.player)),
      gameStatus,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [activeMode, dailyKey, gameStatus, guesses, isReady, storageKey]);

  useEffect(() => {
    if (!isReady || hasTrackedStart.current) return;

    hasTrackedStart.current = true;
    trackEvent({
      name: "session_started",
      puzzle_date: dailyKey,
      mode: activeMode,
    });
  }, [activeMode, dailyKey, isReady]);

  useEffect(() => {
    if (shareStatus !== "copied") return;

    const timeout = window.setTimeout(() => setShareStatus("idle"), 2500);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  const guessedIds = useMemo(() => new Set(guesses.map((guess) => getPlayerId(guess.player))), [guesses]);

  const completeSession = ({
    nextStatus,
    nextGuesses,
    nextMode,
  }: {
    nextStatus: Exclude<GameStatus, "playing">;
    nextGuesses: GuessResult[];
    nextMode: GameMode;
  }) => {
    const updatedStats = recordCompletion({
      previousStats: stats,
      dailyKey,
      gameStatus: nextStatus,
      mode: nextMode,
      guessCount: nextGuesses.length,
    });

    setStats(updatedStats);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));
    }

    trackEvent({
      name: nextStatus === "won" ? "game_won" : "game_lost",
      puzzle_date: dailyKey,
      mode: nextMode,
      outcome: nextStatus,
      guess_count: nextGuesses.length,
    });
  };

  const handleGuess = (player: Player) => {
    if (gameStatus !== "playing") return;

    const result = checkGuess(activeTarget, player);
    const nextGuesses = [...guesses, result];
    setGuesses(nextGuesses);

    trackEvent({
      name: "guess_submitted",
      puzzle_date: dailyKey,
      mode: activeMode,
      guess_count: nextGuesses.length,
      metadata: {
        player_team: player.team,
        player_position: player.position,
      },
    });

    if (isWinningGuess(result)) {
      setGameStatus("won");
      completeSession({ nextStatus: "won", nextGuesses, nextMode: activeMode });
      confetti({
        particleCount: 160,
        spread: 72,
        origin: { y: 0.6 },
        colors: ["#9FE870", "#0C0E12", "#F7D65B"],
      });
      return;
    }

    if (nextGuesses.length >= MAX_GUESSES) {
      setGameStatus("lost");
      completeSession({ nextStatus: "lost", nextGuesses, nextMode: activeMode });
    }
  };

  const handleShare = async () => {
    const shareText = buildShareText({
      dailyKey,
      mode: activeMode,
      guesses,
      gameStatus,
      url: typeof window === "undefined" ? process.env.NEXT_PUBLIC_SITE_URL || "" : window.location.origin,
    });

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Roster Riddle",
          text: shareText,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        setShareStatus("copied");
      }

      trackEvent({
        name: "result_shared",
        puzzle_date: dailyKey,
        mode: activeMode,
        outcome: gameStatus === "playing" ? undefined : gameStatus,
        guess_count: guesses.length,
      });
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  return (
    <div className="w-full max-w-3xl flex flex-col items-center relative">
      <button
        onClick={() => setShowHelp(true)}
        className="absolute top-4 right-4 z-50 text-zinc-500 hover:text-white transition-colors"
        aria-label="How to play"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      <div className="sticky top-0 z-40 w-full bg-zinc-950/85 backdrop-blur-md pt-4 pb-3 px-4 shadow-sm border-b border-zinc-900 mb-6">
        <div className="mb-4 text-center">
          <p className="text-[11px] font-black tracking-[0.35em] text-emerald-300/80 uppercase">Daily Pro Football Puzzle</p>
          <h1 className="text-5xl font-extrabold tracking-tight text-white uppercase italic transform -skew-x-6">
            Roster <span className="text-emerald-400">Riddle</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase mt-2">
            Find the player in <span className="text-emerald-400">{MAX_GUESSES - guesses.length} guesses left</span>
          </p>
        </div>

        {gameStatus === "playing" ? (
          <Search
            players={displayedPlayers}
            onGuess={handleGuess}
            offenseOnly={offenseOnly}
            onFilterChange={setOffenseOnly}
            toggleDisabled={guesses.length > 0}
            disabled={false}
            guessedIds={guessedIds}
          />
        ) : (
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-400 text-zinc-950 font-black uppercase tracking-[0.2em] text-xs hover:bg-emerald-300 transition-colors"
            >
              {shareStatus === "copied" ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {shareStatus === "copied" ? "Copied" : "Share Result"}
            </button>
            <p className="text-[11px] text-zinc-500 uppercase tracking-[0.25em]">
              {gameStatus === "won" ? "Come back tomorrow to protect the streak." : "Spoiler-free share text is ready."}
            </p>
          </div>
        )}
      </div>

      <StatsPanel stats={stats} />

      <div className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-2 w-full max-w-3xl px-2 text-[10px] text-zinc-500 uppercase font-black text-center tracking-widest mb-2">
        <div className="text-left pl-2">Player</div>
        <div>Conf</div>
        <div>Div</div>
        <div>Team</div>
        <div>Pos</div>
        <div>#</div>
      </div>

      <div className="w-full flex flex-col gap-3 min-h-[350px] px-2 pb-12">
        {guesses.map((guess) => (
          <div key={getPlayerId(guess.player)} className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-2 items-center">
            <div className="flex items-center gap-3 overflow-hidden bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
              <PlayerBadge player={guess.player} compact />
              <div className="min-w-0 flex flex-col justify-center">
                <p className="font-bold text-xs text-white truncate leading-tight uppercase tracking-tight">{guess.player.name}</p>
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 leading-none mt-0.5">
                  <span className="font-black text-emerald-400">{guess.player.team}</span>
                </div>
              </div>
            </div>

            <Tile status={guess.status.conf} value={guess.player.conf} />
            <Tile status={guess.status.div} value={guess.player.div} />
            <Tile status={guess.status.team} value={guess.player.team} />
            <Tile status={guess.status.position} value={guess.player.position} />
            <Tile status={guess.status.jersey} value={guess.player.jersey_number.toString()} arrow={guess.comparison.jersey} />
          </div>
        ))}

        {gameStatus === "playing" &&
          Array.from({ length: Math.max(0, MAX_GUESSES - guesses.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-2 items-center opacity-30">
              <div className="h-12 bg-zinc-800/50 rounded-lg border border-zinc-800/50 border-dashed" />
              {Array.from({ length: 5 }).map((__, tileIndex) => (
                <div key={tileIndex} className="h-12 bg-zinc-800/50 rounded-lg border border-zinc-800/50 border-dashed" />
              ))}
            </div>
          ))}
      </div>

      <div className="w-full max-w-3xl px-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
          <p className="font-black uppercase tracking-[0.2em] text-[11px] text-zinc-500 mb-3">Public Launch Notes</p>
          <p>
            Roster Riddle is an unofficial pro football guessing game. It uses team, conference, division, and roster context only.
            Results are saved on this device so players can finish the daily puzzle later and keep a local streak.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setShowHelp(false)}
        >
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl max-w-md w-full shadow-2xl relative" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
              ✕
            </button>
            <h2 className="text-2xl font-black text-white mb-4 uppercase italic">How to Play</h2>
            <div className="space-y-4 text-sm text-zinc-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-400 rounded border border-emerald-400 flex items-center justify-center font-bold text-black text-xs">NYJ</div>
                <p>
                  <span className="text-emerald-400 font-bold">GREEN</span> means an exact match.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-300 rounded border border-amber-300 flex items-center justify-center font-bold text-black text-xs">AFC</div>
                <p>
                  <span className="text-amber-300 font-bold">YELLOW</span> means close. Here that means the conference matches but the division does not.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-900 rounded border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">WR</div>
                <p>
                  <span className="text-zinc-500 font-bold">GRAY</span> means no match.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-900 rounded border border-zinc-700 flex items-center justify-center font-bold text-white text-xs relative">
                  12
                  <span className="absolute bottom-[-6px] right-0.5 text-2xl leading-none text-white drop-shadow-md font-black">↑</span>
                </div>
                <p>Arrows show whether the hidden jersey number is higher or lower than your guess.</p>
              </div>
              <div className="text-xs text-zinc-500 uppercase tracking-[0.2em]">Switching to offense-only locks in after your first guess.</div>
            </div>
          </div>
        </div>
      )}

      {gameStatus === "won" && (
        <ResultModal
          tone="success"
          title="Puzzle Solved"
          subtitle="You found today's player."
          player={activeTarget}
          onShare={handleShare}
          shareStatus={shareStatus}
        />
      )}

      {gameStatus === "lost" && (
        <ResultModal
          tone="danger"
          title="Out of Guesses"
          subtitle="Today's answer is below."
          player={activeTarget}
          onShare={handleShare}
          shareStatus={shareStatus}
        />
      )}
    </div>
  );
}

function PlayerBadge({ player, compact = false }: { player: Player; compact?: boolean }) {
  const initials = player.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-emerald-400/80 to-cyan-400/60 text-zinc-950 font-black flex items-center justify-center shrink-0 border border-white/15",
        compact ? "w-10 h-10 text-xs" : "w-24 h-24 text-2xl"
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function ResultModal({
  title,
  subtitle,
  player,
  onShare,
  shareStatus,
  tone,
}: {
  title: string;
  subtitle: string;
  player: Player;
  onShare: () => void;
  shareStatus: "idle" | "copied";
  tone: "success" | "danger";
}) {
  const accentClass = tone === "success" ? "border-emerald-400" : "border-rose-500";
  const buttonClass =
    tone === "success"
      ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
      : "bg-rose-500 text-white hover:bg-rose-400";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn("bg-zinc-900 border-2 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden", accentClass)}
      >
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white mb-2 tracking-tight uppercase italic">{title}</h2>
          <p className="text-zinc-400 uppercase tracking-[0.25em] text-[11px] mb-6">{subtitle}</p>
          <div className="flex justify-center mb-5">
            <PlayerBadge player={player} />
          </div>
          <p className="text-3xl font-black text-white mb-2 uppercase">{player.name}</p>
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-bold text-zinc-300">{player.team}</span>
            <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-bold text-zinc-300">#{player.jersey_number}</span>
            <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-bold text-zinc-300">{player.position}</span>
          </div>
          <button
            onClick={onShare}
            className={cn("w-full font-black uppercase tracking-[0.2em] py-4 rounded-xl transition-all inline-flex items-center justify-center gap-2", buttonClass)}
          >
            {shareStatus === "copied" ? <Copy className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {shareStatus === "copied" ? "Copied" : "Share Result"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatsPanel({ stats }: { stats: PlayerStats }) {
  const winRate = stats.gamesPlayed === 0 ? 0 : Math.round((stats.wins / stats.gamesPlayed) * 100);

  return (
    <div className="w-full grid md:grid-cols-4 gap-3 px-2 mb-6">
      <StatCard icon={<Trophy className="w-4 h-4" />} label="Games" value={stats.gamesPlayed.toString()} />
      <StatCard icon={<Check className="w-4 h-4" />} label="Wins" value={`${winRate}%`} />
      <StatCard icon={<Flame className="w-4 h-4" />} label="Current Streak" value={stats.currentStreak.toString()} />
      <StatCard icon={<Trophy className="w-4 h-4" />} label="Best Streak" value={stats.bestStreak.toString()} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="flex items-center gap-2 text-zinc-500 uppercase tracking-[0.2em] text-[10px] font-black">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function Tile({ status, value, arrow }: { status: string; value: string; arrow?: string }) {
  const getColor = (currentStatus: string) => {
    if (currentStatus === "correct") return "bg-emerald-400 border-emerald-400 text-zinc-950";
    if (currentStatus === "close") return "bg-amber-300 border-amber-300 text-zinc-950";
    if (currentStatus === "incorrect" || currentStatus === "higher" || currentStatus === "lower") {
      return "bg-zinc-900 border-zinc-700 text-white";
    }
    return "bg-zinc-800 border-zinc-800 text-zinc-500";
  };

  return (
    <div
      className={cn(
        "h-12 flex flex-col items-center justify-center rounded-md border text-center transition-all font-bold text-xs uppercase shadow-sm relative overflow-hidden",
        getColor(status)
      )}
    >
      <span className="z-10 relative">{value}</span>
      {arrow && <span className="absolute bottom-0 right-0.5 text-2xl leading-none text-white drop-shadow-md font-black pointer-events-none">{arrow}</span>}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
    </div>
  );
}

function isWinningGuess(result: GuessResult) {
  return (
    result.status.conf === "correct" &&
    result.status.div === "correct" &&
    result.status.team === "correct" &&
    result.status.position === "correct" &&
    result.status.jersey === "correct"
  );
}

function parseSession(rawValue: string): SavedSession | null {
  try {
    const value = JSON.parse(rawValue) as SavedSession;
    if (!value || typeof value !== "object") return null;
    if (typeof value.dailyKey !== "string" || !Array.isArray(value.guesses)) return null;
    return value;
  } catch {
    return null;
  }
}

function parseStats(rawValue: string): PlayerStats {
  try {
    const value = JSON.parse(rawValue) as Partial<PlayerStats>;
    return {
      ...DEFAULT_STATS,
      ...value,
      history: Array.isArray(value.history) ? value.history.slice(0, 30) : [],
    };
  } catch {
    return DEFAULT_STATS;
  }
}

function recordCompletion({
  previousStats,
  dailyKey,
  gameStatus,
  mode,
  guessCount,
}: {
  previousStats: PlayerStats;
  dailyKey: string;
  gameStatus: Exclude<GameStatus, "playing">;
  mode: GameMode;
  guessCount: number;
}) {
  const existingIndex = previousStats.history.findIndex((entry) => entry.dailyKey === dailyKey && entry.mode === mode);
  const nextHistoryEntry: HistoryEntry = {
    dailyKey,
    mode,
    outcome: gameStatus,
    guessCount,
  };

  const nextHistory =
    existingIndex >= 0
      ? previousStats.history.map((entry, index) => (index === existingIndex ? nextHistoryEntry : entry))
      : [nextHistoryEntry, ...previousStats.history].slice(0, 30);

  const gamesPlayed = nextHistory.length;
  const wins = nextHistory.filter((entry) => entry.outcome === "won").length;
  const previousDay = getPreviousPuzzleDate(dailyKey);
  const keepsStreak =
    gameStatus === "won" &&
    previousStats.lastCompletedDay &&
    previousStats.lastCompletedDay === previousDay;
  const currentStreak =
    gameStatus === "won" ? (keepsStreak ? previousStats.currentStreak + 1 : 1) : 0;

  return {
    gamesPlayed,
    wins,
    currentStreak,
    bestStreak: Math.max(previousStats.bestStreak, currentStreak),
    lastCompletedDay: gameStatus === "won" ? dailyKey : previousStats.lastCompletedDay,
    history: nextHistory,
  };
}

function buildShareText({
  dailyKey,
  mode,
  guesses,
  gameStatus,
  url,
}: {
  dailyKey: string;
  mode: GameMode;
  guesses: GuessResult[];
  gameStatus: GameStatus;
  url: string;
}) {
  const score = gameStatus === "won" ? guesses.length.toString() : "X";
  const modeLabel = mode === "offense" ? "Offense" : "Standard";
  const grid = guesses
    .map((guess) =>
      [guess.status.conf, guess.status.div, guess.status.team, guess.status.position, guess.status.jersey]
        .map((status) => {
          if (status === "correct") return "🟩";
          if (status === "close") return "🟨";
          return "⬛";
        })
        .join("")
    )
    .join("\n");

  return [`Roster Riddle ${dailyKey}`, `${modeLabel} ${score}/${MAX_GUESSES}`, grid, url].filter(Boolean).join("\n");
}
