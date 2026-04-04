"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Check, Flame, Link2, Mail, Share2, Trophy, Users } from "lucide-react";
import {
  checkGuess,
  getLeaderboard,
  getPlayerId,
  GuessResult,
  LeaderboardEntry,
  MAX_GUESSES,
  OFFENSIVE_POSITIONS,
  Player,
  submitLeaderboardEntry,
  submitWaitlistEmail,
} from "../lib/gameLogic";
import { trackEvent } from "../lib/analytics";
import { cn } from "../lib/utils";
import Search from "./Search";

interface GameProps {
  standardDaily: Player;
  offenseDaily: Player;
  weeklyTarget: Player | null;
  allPlayers: Player[];
  dailyKey: string;
  weeklyKey: string;
  challengeToken?: string;
  initialView?: string;
}

type GameStatus = "playing" | "won" | "lost";
type PuzzleVariant = "daily-standard" | "daily-offense" | "weekly" | "challenge";
type SavedSession = {
  guesses: string[];
  gameStatus: GameStatus;
};
type HistoryEntry = {
  puzzleKey: string;
  variant: PuzzleVariant;
  outcome: "won" | "lost";
  guessCount: number;
};
type PlayerStats = {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedKey: string | null;
  history: HistoryEntry[];
};
type VariantConfig = {
  variant: PuzzleVariant;
  title: string;
  subtitle: string;
  searchLabel: string;
  target: Player;
  players: Player[];
  puzzleType: "daily" | "weekly" | "challenge";
  leaderboardType: "daily" | "weekly" | null;
  leaderboardMode: "standard" | "offense" | "weekly" | null;
  puzzleKey: string;
  allowsStats: boolean;
};

const STORAGE_KEY_PREFIX = "roster-riddle";
const STATS_STORAGE_KEY = `${STORAGE_KEY_PREFIX}:stats`;
const NICKNAME_STORAGE_KEY = `${STORAGE_KEY_PREFIX}:nickname`;
const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastCompletedKey: null,
  history: [],
};

export default function Game({
  standardDaily,
  offenseDaily,
  weeklyTarget,
  allPlayers,
  dailyKey,
  weeklyKey,
  challengeToken,
  initialView,
}: GameProps) {
  const challengeTarget = useMemo(() => decodeChallengeToken(challengeToken, allPlayers), [allPlayers, challengeToken]);
  const initialVariant = getInitialVariant(initialView, challengeTarget);

  const [activeVariant, setActiveVariant] = useState<PuzzleVariant>(initialVariant);
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [showHelp, setShowHelp] = useState(false);
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [nickname, setNickname] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<"idle" | "loading" | "error" | "saved">("idle");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isReady, setIsReady] = useState(false);
  const hasTrackedStart = useRef<string | null>(null);

  const currentConfig = useMemo<VariantConfig>(() => {
    const offensivePlayers = allPlayers.filter((player) =>
      OFFENSIVE_POSITIONS.includes(player.position as (typeof OFFENSIVE_POSITIONS)[number])
    );

    if (activeVariant === "daily-offense") {
      return {
        variant: activeVariant,
        title: "Daily Offense",
        subtitle: "A sharper daily puzzle using only offensive skill players.",
        searchLabel: "Search Offense",
        target: offenseDaily,
        players: offensivePlayers,
        puzzleType: "daily",
        leaderboardType: "daily",
        leaderboardMode: "offense",
        puzzleKey: dailyKey,
        allowsStats: true,
      };
    }

    if (activeVariant === "weekly" && weeklyTarget) {
      return {
        variant: activeVariant,
        title: "Weekly Spotlight",
        subtitle: "One featured player all week long for a steadier social challenge.",
        searchLabel: "Search Weekly Spotlight",
        target: weeklyTarget,
        players: allPlayers,
        puzzleType: "weekly",
        leaderboardType: "weekly",
        leaderboardMode: "weekly",
        puzzleKey: weeklyKey,
        allowsStats: true,
      };
    }

    if (activeVariant === "challenge" && challengeTarget) {
      return {
        variant: activeVariant,
        title: "Friend Challenge",
        subtitle: "A custom challenge link made by another player.",
        searchLabel: "Search Challenge Pool",
        target: challengeTarget,
        players: allPlayers,
        puzzleType: "challenge",
        leaderboardType: null,
        leaderboardMode: null,
        puzzleKey: challengeToken || getPlayerId(challengeTarget),
        allowsStats: false,
      };
    }

    return {
      variant: "daily-standard",
      title: "Daily Standard",
      subtitle: "The main daily puzzle across the full roster.",
      searchLabel: "Search Active Roster",
      target: standardDaily,
      players: allPlayers,
      puzzleType: "daily",
      leaderboardType: "daily",
      leaderboardMode: "standard",
      puzzleKey: dailyKey,
      allowsStats: true,
    };
  }, [activeVariant, allPlayers, challengeTarget, challengeToken, dailyKey, offenseDaily, standardDaily, weeklyKey, weeklyTarget]);

  const storageKey = `${STORAGE_KEY_PREFIX}:${currentConfig.variant}:${currentConfig.puzzleKey}`;
  const guessedIds = useMemo(() => new Set(guesses.map((guess) => getPlayerId(guess.player))), [guesses]);
  const canSubmitLeaderboard =
    currentConfig.leaderboardType !== null && currentConfig.leaderboardMode !== null && gameStatus === "won";
  const displayedLeaderboard = currentConfig.leaderboardType ? leaderboard : [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(() => {
      const rawStats = window.localStorage.getItem(STATS_STORAGE_KEY);
      setStats(rawStats ? parseStats(rawStats) : DEFAULT_STATS);
      setNickname(window.localStorage.getItem(NICKNAME_STORAGE_KEY) || "");
      restoreVariantSession(storageKey, currentConfig.target, currentConfig.players, setGuesses, setGameStatus);
      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentConfig.players, currentConfig.target, storageKey]);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;

    const payload: SavedSession = {
      guesses: guesses.map((guess) => getPlayerId(guess.player)),
      gameStatus,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [gameStatus, guesses, isReady, storageKey]);

  useEffect(() => {
    if (!isReady) return;

    const trackingKey = `${currentConfig.variant}:${currentConfig.puzzleKey}`;
    if (hasTrackedStart.current === trackingKey) return;

    hasTrackedStart.current = trackingKey;
    trackEvent({
      name: "session_started",
      puzzle_date: currentConfig.puzzleKey,
      mode: currentConfig.variant,
    });
  }, [currentConfig.puzzleKey, currentConfig.variant, isReady]);

  useEffect(() => {
    if (shareStatus !== "copied") return;

    const timeout = window.setTimeout(() => setShareStatus("idle"), 2500);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  useEffect(() => {
    if (!currentConfig.leaderboardType || !currentConfig.leaderboardMode) {
      return;
    }

    let cancelled = false;

    void getLeaderboard(currentConfig.leaderboardType, currentConfig.leaderboardMode, currentConfig.puzzleKey)
      .then((response) => {
        if (!cancelled) {
          setLeaderboard(response.entries);
          setLeaderboardStatus("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLeaderboardStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentConfig.leaderboardMode, currentConfig.leaderboardType, currentConfig.puzzleKey]);

  const switchVariant = (nextVariant: PuzzleVariant) => {
    setActiveVariant(nextVariant);
    setShareStatus("idle");
    setLeaderboardStatus("idle");
    const nextConfig = getConfigForVariant(nextVariant, {
      allPlayers,
      challengeTarget,
      challengeToken,
      dailyKey,
      offenseDaily,
      standardDaily,
      weeklyKey,
      weeklyTarget,
    });
    const nextStorageKey = `${STORAGE_KEY_PREFIX}:${nextConfig.variant}:${nextConfig.puzzleKey}`;
    restoreVariantSession(nextStorageKey, nextConfig.target, nextConfig.players, setGuesses, setGameStatus);
  };

  const completeSession = (nextStatus: Exclude<GameStatus, "playing">, nextGuesses: GuessResult[]) => {
    if (!currentConfig.allowsStats) {
      return;
    }

    const updatedStats = recordCompletion({
      previousStats: stats,
      puzzleKey: `${currentConfig.variant}:${currentConfig.puzzleKey}`,
      variant: currentConfig.variant,
      gameStatus: nextStatus,
      guessCount: nextGuesses.length,
    });

    setStats(updatedStats);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));
    }

    trackEvent({
      name: nextStatus === "won" ? "game_won" : "game_lost",
      puzzle_date: currentConfig.puzzleKey,
      mode: currentConfig.variant,
      outcome: nextStatus,
      guess_count: nextGuesses.length,
    });
  };

  const handleGuess = (player: Player) => {
    if (gameStatus !== "playing") return;

    const result = checkGuess(currentConfig.target, player);
    const nextGuesses = [...guesses, result];
    setGuesses(nextGuesses);

    trackEvent({
      name: "guess_submitted",
      puzzle_date: currentConfig.puzzleKey,
      mode: currentConfig.variant,
      guess_count: nextGuesses.length,
      metadata: {
        player_team: player.team,
        player_position: player.position,
      },
    });

    if (isWinningGuess(result)) {
      setGameStatus("won");
      completeSession("won", nextGuesses);
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
      completeSession("lost", nextGuesses);
    }
  };

  const handleShareResult = async () => {
    const shareText = buildShareText({
      config: currentConfig,
      guesses,
      gameStatus,
      url: typeof window === "undefined" ? process.env.NEXT_PUBLIC_SITE_URL || "" : window.location.href,
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
        puzzle_date: currentConfig.puzzleKey,
        mode: currentConfig.variant,
        outcome: gameStatus === "playing" ? undefined : gameStatus,
        guess_count: guesses.length,
      });
    } catch (error) {
      console.error("Share failed", error);
    }
  };

  const handleCopyChallengeLink = async () => {
    const token = encodeChallengeToken(currentConfig.target);
    const baseUrl = typeof window === "undefined" ? process.env.NEXT_PUBLIC_SITE_URL || "" : window.location.origin;
    const challengeUrl = `${baseUrl}/?view=challenge&challenge=${encodeURIComponent(token)}`;

    try {
      await navigator.clipboard.writeText(challengeUrl);
      setShareStatus("copied");
      trackEvent({
        name: "challenge_link_created",
        puzzle_date: currentConfig.puzzleKey,
        mode: currentConfig.variant,
      });
    } catch (error) {
      console.error("Challenge link failed", error);
    }
  };

  const handleSubmitScore = async () => {
    if (!canSubmitLeaderboard || !nickname.trim() || !currentConfig.leaderboardType || !currentConfig.leaderboardMode) {
      return;
    }

    try {
      setLeaderboardStatus("loading");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname.trim());
      }

      const response = await submitLeaderboardEntry({
        name: nickname.trim(),
        puzzle_type: currentConfig.leaderboardType,
        mode: currentConfig.leaderboardMode,
        puzzle_key: currentConfig.puzzleKey,
        guess_count: guesses.length,
      });
      setLeaderboard(response.entries);
      setLeaderboardStatus("saved");
    } catch (error) {
      console.error(error);
      setLeaderboardStatus("error");
    }
  };

  const handleWaitlistSubmit = async () => {
    if (!waitlistEmail.trim()) return;

    try {
      setWaitlistStatus("saving");
      await submitWaitlistEmail({ email: waitlistEmail.trim(), source: currentConfig.variant });
      setWaitlistStatus("saved");
      setWaitlistEmail("");
    } catch (error) {
      console.error(error);
      setWaitlistStatus("error");
    }
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-center relative">
      <button
        onClick={() => setShowHelp(true)}
        className="absolute top-4 right-4 z-50 text-zinc-500 hover:text-white transition-colors"
        aria-label="How to play"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      <div className="sticky top-0 z-40 w-full bg-zinc-950/90 backdrop-blur-md pt-4 pb-3 px-4 shadow-sm border-b border-zinc-900 mb-6">
        <div className="mb-4 text-center">
          <p className="text-[11px] font-black tracking-[0.35em] text-emerald-300/80 uppercase">Daily Pro Football Puzzle</p>
          <h1 className="text-5xl font-extrabold tracking-tight text-white uppercase italic transform -skew-x-6">
            Roster <span className="text-emerald-400">Riddle</span>
          </h1>
          <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase mt-2">{currentConfig.subtitle}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <ModeTab label="Daily" active={currentConfig.variant === "daily-standard"} onClick={() => switchVariant("daily-standard")} />
          <ModeTab label="Offense" active={currentConfig.variant === "daily-offense"} onClick={() => switchVariant("daily-offense")} />
          {weeklyTarget && <ModeTab label="Weekly" active={currentConfig.variant === "weekly"} onClick={() => switchVariant("weekly")} />}
          {challengeTarget && (
            <ModeTab label="Challenge" active={currentConfig.variant === "challenge"} onClick={() => switchVariant("challenge")} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-4 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span>{currentConfig.title}</span>
          <span>{currentConfig.puzzleKey}</span>
          <span>{MAX_GUESSES - guesses.length} guesses left</span>
        </div>

        {gameStatus === "playing" ? (
          <Search players={currentConfig.players} onGuess={handleGuess} guessedIds={guessedIds} label={currentConfig.searchLabel} />
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <ActionButton onClick={handleShareResult} icon={shareStatus === "copied" ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}>
              {shareStatus === "copied" ? "Copied" : "Share Result"}
            </ActionButton>
            <ActionButton onClick={handleCopyChallengeLink} icon={<Link2 className="w-4 h-4" />}>
              Challenge A Friend
            </ActionButton>
          </div>
        )}
      </div>

      <StatsPanel stats={stats} />

      <div className="w-full grid lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-6 px-2">
        <div>
          <div className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-2 w-full text-[10px] text-zinc-500 uppercase font-black text-center tracking-widest mb-2">
            <div className="text-left pl-2">Player</div>
            <div>Conf</div>
            <div>Div</div>
            <div>Team</div>
            <div>Pos</div>
            <div>#</div>
          </div>

          <div className="w-full flex flex-col gap-3 min-h-[350px] pb-8">
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
        </div>

        <aside className="space-y-4">
          <ResultCard
            gameStatus={gameStatus}
            player={currentConfig.target}
            onShare={handleShareResult}
            onChallenge={handleCopyChallengeLink}
            shareStatus={shareStatus}
          />

          <LeaderboardCard
            entries={displayedLeaderboard}
            status={leaderboardStatus}
            canSubmit={canSubmitLeaderboard}
            nickname={nickname}
            setNickname={setNickname}
            onSubmit={handleSubmitScore}
          />

          <WaitlistCard
            email={waitlistEmail}
            status={waitlistStatus}
            setEmail={setWaitlistEmail}
            onSubmit={handleWaitlistSubmit}
          />

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            <p className="font-black uppercase tracking-[0.2em] text-[11px] text-zinc-500 mb-3">Launch Notes</p>
            <p>Roster Riddle now supports daily and weekly play, challenge links, a lightweight public leaderboard, and local streak tracking.</p>
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl max-w-md w-full shadow-2xl relative" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
              ✕
            </button>
            <h2 className="text-2xl font-black text-white mb-4 uppercase italic">How to Play</h2>
            <div className="space-y-4 text-sm text-zinc-300">
              <p>Use the tabs to switch between the main daily puzzle, the offense-only daily puzzle, the weekly spotlight, and any custom challenge link.</p>
              <p>Green means exact, yellow means close conference match, and arrows tell you whether the jersey number should be higher or lower.</p>
              <p>Win in fewer guesses to post a better leaderboard score. Weekly mode uses the same featured player all week so sharing and competing is easier.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-full border text-xs font-black uppercase tracking-[0.2em] transition-colors",
        active ? "bg-emerald-400 text-zinc-950 border-emerald-400" : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500"
      )}
    >
      {label}
    </button>
  );
}

function ActionButton({ children, icon, onClick }: { children: ReactNode; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-400 text-zinc-950 font-black uppercase tracking-[0.2em] text-xs hover:bg-emerald-300 transition-colors"
    >
      {icon}
      {children}
    </button>
  );
}

function ResultCard({
  gameStatus,
  player,
  onShare,
  onChallenge,
  shareStatus,
}: {
  gameStatus: GameStatus;
  player: Player;
  onShare: () => void;
  onChallenge: () => void;
  shareStatus: "idle" | "copied";
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="font-black uppercase tracking-[0.2em] text-[11px] text-zinc-500 mb-3">Result</p>
      <div className="flex items-center gap-3 mb-4">
        <PlayerBadge player={player} />
        <div>
          <p className="text-white font-black uppercase">{player.name}</p>
          <p className="text-zinc-400 text-sm">
            {player.team} • #{player.jersey_number} • {player.position}
          </p>
        </div>
      </div>
      <p className="text-sm text-zinc-300 mb-4">
        {gameStatus === "playing" ? "Solve the current puzzle, then share your result or create a custom challenge link." : "Today's target is shown here for your recap and challenge flow."}
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={onShare} icon={shareStatus === "copied" ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}>
          {shareStatus === "copied" ? "Copied" : "Share"}
        </ActionButton>
        <ActionButton onClick={onChallenge} icon={<Link2 className="w-4 h-4" />}>
          Challenge
        </ActionButton>
      </div>
    </div>
  );
}

function LeaderboardCard({
  entries,
  status,
  canSubmit,
  nickname,
  setNickname,
  onSubmit,
}: {
  entries: LeaderboardEntry[];
  status: "idle" | "loading" | "error" | "saved";
  canSubmit: boolean;
  nickname: string;
  setNickname: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-2 mb-3 text-zinc-500">
        <Users className="w-4 h-4" />
        <p className="font-black uppercase tracking-[0.2em] text-[11px]">Leaderboard</p>
      </div>

      {canSubmit && (
        <div className="mb-4 space-y-2">
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Display Name"
            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400"
          />
          <button
            onClick={onSubmit}
            className="w-full rounded-xl bg-emerald-400 text-zinc-950 py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-emerald-300 transition-colors"
          >
            Submit Score
          </button>
        </div>
      )}

      {status === "error" && <p className="text-sm text-rose-400 mb-3">Leaderboard is unavailable right now.</p>}
      {status === "saved" && <p className="text-sm text-emerald-400 mb-3">Score saved.</p>}
      {status === "loading" && <p className="text-sm text-zinc-500 mb-3">Loading leaderboard...</p>}

      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No scores yet. Be the first to post one.</p>
        ) : (
          entries.map((entry, index) => (
            <div key={`${entry.name}-${entry.timestamp}`} className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2">
              <div>
                <p className="text-white font-bold text-sm">{index + 1}. {entry.name}</p>
                <p className="text-zinc-500 text-xs uppercase tracking-[0.2em]">{entry.mode}</p>
              </div>
              <div className="text-emerald-400 font-black">{entry.guess_count}/{MAX_GUESSES}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WaitlistCard({
  email,
  status,
  setEmail,
  onSubmit,
}: {
  email: string;
  status: "idle" | "saving" | "saved" | "error";
  setEmail: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-2 mb-3 text-zinc-500">
        <Mail className="w-4 h-4" />
        <p className="font-black uppercase tracking-[0.2em] text-[11px]">Get Updates</p>
      </div>
      <p className="text-sm text-zinc-300 mb-3">Join the launch list for new puzzle modes, weekly events, and feature drops.</p>
      <div className="space-y-2">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button
          onClick={onSubmit}
          className="w-full rounded-xl bg-zinc-100 text-zinc-950 py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-white transition-colors"
        >
          {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Join Waitlist"}
        </button>
      </div>
      {status === "error" && <p className="text-sm text-rose-400 mt-3">Could not save that email.</p>}
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
        compact ? "w-10 h-10 text-xs" : "w-16 h-16 text-xl"
      )}
      aria-hidden="true"
    >
      {initials}
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
    if (!value || typeof value !== "object" || !Array.isArray(value.guesses)) return null;
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
      history: Array.isArray(value.history) ? value.history.slice(0, 40) : [],
    };
  } catch {
    return DEFAULT_STATS;
  }
}

function restoreVariantSession(
  storageKey: string,
  target: Player,
  players: Player[],
  setGuesses: (value: GuessResult[]) => void,
  setGameStatus: (value: GameStatus) => void
) {
  if (typeof window === "undefined") return;

  const savedSession = window.localStorage.getItem(storageKey);
  if (!savedSession) {
    setGuesses([]);
    setGameStatus("playing");
    return;
  }

  const parsed = parseSession(savedSession);
  if (!parsed) {
    setGuesses([]);
    setGameStatus("playing");
    return;
  }

  const restoredGuesses = parsed.guesses
    .map((id) => players.find((player) => getPlayerId(player) === id))
    .filter((player): player is Player => Boolean(player))
    .map((player) => checkGuess(target, player));

  setGuesses(restoredGuesses);
  setGameStatus(parsed.gameStatus);
}

function recordCompletion({
  previousStats,
  puzzleKey,
  variant,
  gameStatus,
  guessCount,
}: {
  previousStats: PlayerStats;
  puzzleKey: string;
  variant: PuzzleVariant;
  gameStatus: "won" | "lost";
  guessCount: number;
}) {
  const existingIndex = previousStats.history.findIndex((entry) => entry.puzzleKey === puzzleKey && entry.variant === variant);
  const nextEntry: HistoryEntry = {
    puzzleKey,
    variant,
    outcome: gameStatus,
    guessCount,
  };

  const nextHistory =
    existingIndex >= 0
      ? previousStats.history.map((entry, index) => (index === existingIndex ? nextEntry : entry))
      : [nextEntry, ...previousStats.history].slice(0, 40);

  const gamesPlayed = nextHistory.length;
  const wins = nextHistory.filter((entry) => entry.outcome === "won").length;
  const previousDateMatch = previousStats.lastCompletedKey?.match(/\d{4}-\d{2}-\d{2}$/)?.[0] || null;
  const currentDatePart = puzzleKey.match(/\d{4}-\d{2}-\d{2}$/)?.[0] || null;
  const previousKey = previousDateMatch ? getPreviousDate(previousDateMatch) : null;
  const keepsStreak = gameStatus === "won" && previousKey !== null && currentDatePart !== null && previousKey === currentDatePart;
  const currentStreak = gameStatus === "won" ? (keepsStreak ? previousStats.currentStreak + 1 : 1) : 0;

  return {
    gamesPlayed,
    wins,
    currentStreak,
    bestStreak: Math.max(previousStats.bestStreak, currentStreak),
    lastCompletedKey: gameStatus === "won" ? puzzleKey : previousStats.lastCompletedKey,
    history: nextHistory,
  };
}

function buildShareText({
  config,
  guesses,
  gameStatus,
  url,
}: {
  config: VariantConfig;
  guesses: GuessResult[];
  gameStatus: GameStatus;
  url: string;
}) {
  const score = gameStatus === "won" ? guesses.length.toString() : "X";
  const grid = guesses
    .map((guess) =>
      [guess.status.conf, guess.status.div, guess.status.team, guess.status.position, guess.status.jersey]
        .map((status) => (status === "correct" ? "🟩" : status === "close" ? "🟨" : "⬛"))
        .join("")
    )
    .join("\n");

  return [`Roster Riddle ${config.title}`, `${config.puzzleKey} ${score}/${MAX_GUESSES}`, grid, url].filter(Boolean).join("\n");
}

function encodeChallengeToken(player: Player) {
  const payload = JSON.stringify({ playerId: getPlayerId(player) });
  return encodeBase64(payload).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeChallengeToken(token: string | undefined, players: Player[]) {
  if (!token) return null;

  try {
    const normalized = token.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(decodeBase64(padded)) as { playerId?: string };
    if (!parsed.playerId) return null;
    return players.find((player) => getPlayerId(player) === parsed.playerId) || null;
  } catch {
    return null;
  }
}

function getPreviousDate(day: string) {
  const parsed = new Date(`${day}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function encodeBase64(value: string) {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  throw new Error("Base64 encoding is unavailable.");
}

function decodeBase64(value: string) {
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(value);
  }
  throw new Error("Base64 decoding is unavailable.");
}

function getInitialVariant(initialView: string | undefined, challengeTarget: Player | null): PuzzleVariant {
  if (initialView === "weekly") return "weekly";
  if (initialView === "offense") return "daily-offense";
  if (initialView === "challenge" && challengeTarget) return "challenge";
  return "daily-standard";
}

function getConfigForVariant(
  variant: PuzzleVariant,
  context: {
    standardDaily: Player;
    offenseDaily: Player;
    weeklyTarget: Player | null;
    allPlayers: Player[];
    dailyKey: string;
    weeklyKey: string;
    challengeTarget: Player | null;
    challengeToken?: string;
  }
) {
  const { allPlayers, challengeTarget, challengeToken, dailyKey, offenseDaily, standardDaily, weeklyKey, weeklyTarget } = context;
  const offensivePlayers = allPlayers.filter((player) =>
    OFFENSIVE_POSITIONS.includes(player.position as (typeof OFFENSIVE_POSITIONS)[number])
  );

  if (variant === "daily-offense") {
    return {
      variant,
      title: "Daily Offense",
      subtitle: "A sharper daily puzzle using only offensive skill players.",
      searchLabel: "Search Offense",
      target: offenseDaily,
      players: offensivePlayers,
      puzzleType: "daily" as const,
      leaderboardType: "daily" as const,
      leaderboardMode: "offense" as const,
      puzzleKey: dailyKey,
      allowsStats: true,
    };
  }

  if (variant === "weekly" && weeklyTarget) {
    return {
      variant,
      title: "Weekly Spotlight",
      subtitle: "One featured player all week long for a steadier social challenge.",
      searchLabel: "Search Weekly Spotlight",
      target: weeklyTarget,
      players: allPlayers,
      puzzleType: "weekly" as const,
      leaderboardType: "weekly" as const,
      leaderboardMode: "weekly" as const,
      puzzleKey: weeklyKey,
      allowsStats: true,
    };
  }

  if (variant === "challenge" && challengeTarget) {
    return {
      variant,
      title: "Friend Challenge",
      subtitle: "A custom challenge link made by another player.",
      searchLabel: "Search Challenge Pool",
      target: challengeTarget,
      players: allPlayers,
      puzzleType: "challenge" as const,
      leaderboardType: null,
      leaderboardMode: null,
      puzzleKey: challengeToken || getPlayerId(challengeTarget),
      allowsStats: false,
    };
  }

  return {
    variant: "daily-standard" as const,
    title: "Daily Standard",
    subtitle: "The main daily puzzle across the full roster.",
    searchLabel: "Search Active Roster",
    target: standardDaily,
    players: allPlayers,
    puzzleType: "daily" as const,
    leaderboardType: "daily" as const,
    leaderboardMode: "standard" as const,
    puzzleKey: dailyKey,
    allowsStats: true,
  };
}
