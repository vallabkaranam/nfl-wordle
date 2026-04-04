"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Check, Flame, Link2, Mail, Share2, Trophy, Users } from "lucide-react";
import {
  checkGuess,
  FANTASY_POSITIONS,
  getLeaderboard,
  getPlayerId,
  GuessResult,
  LeaderboardEntry,
  MAX_GUESSES,
  Player,
  submitLeaderboardEntry,
  submitWaitlistEmail,
} from "../lib/gameLogic";
import { trackEvent } from "../lib/analytics";
import { cn } from "../lib/utils";
import Search from "./Search";

interface GameProps {
  standardDaily: Player;
  fantasyDaily: Player;
  weeklyTarget: Player | null;
  allPlayers: Player[];
  dailyKey: string;
  weeklyKey: string;
  challengeToken?: string;
  initialView?: string;
}

type GameStatus = "playing" | "won" | "lost";
type PuzzleVariant = "daily-standard" | "daily-fantasy" | "weekly" | "challenge";
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
  leaderboardMode: "standard" | "fantasy" | "weekly" | null;
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
  fantasyDaily,
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
    const fantasyPlayers = allPlayers.filter((player) =>
      FANTASY_POSITIONS.includes(player.position as (typeof FANTASY_POSITIONS)[number])
    );

    if (activeVariant === "daily-fantasy") {
      return {
        variant: activeVariant,
        title: "Daily Fantasy",
        subtitle: "A cleaner daily puzzle built from the fantasy-relevant core: QB, RB, WR, and TE.",
        searchLabel: "Search Fantasy Pool",
        target: fantasyDaily,
        players: fantasyPlayers,
        puzzleType: "daily",
        leaderboardType: "daily",
        leaderboardMode: "fantasy",
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
      title: "Daily Classic",
      subtitle: "The full-roster daily puzzle, including defenders and the biggest non-fantasy stars.",
      searchLabel: "Search Full Roster",
      target: standardDaily,
      players: allPlayers,
      puzzleType: "daily",
      leaderboardType: "daily",
      leaderboardMode: "standard",
      puzzleKey: dailyKey,
      allowsStats: true,
    };
  }, [activeVariant, allPlayers, challengeTarget, challengeToken, dailyKey, fantasyDaily, standardDaily, weeklyKey, weeklyTarget]);

  const storageKey = `${STORAGE_KEY_PREFIX}:${currentConfig.variant}:${currentConfig.puzzleKey}`;
  const guessedIds = useMemo(() => new Set(guesses.map((guess) => getPlayerId(guess.player))), [guesses]);
  const canSubmitLeaderboard =
    currentConfig.leaderboardType !== null && currentConfig.leaderboardMode !== null && gameStatus === "won";
  const displayedLeaderboard = currentConfig.leaderboardType ? leaderboard : [];
  const visibleModes = [
    "the full-roster Classic puzzle",
    "the Fantasy puzzle for QB, RB, WR, and TE",
    weeklyTarget ? "the Weekly spotlight" : null,
    challengeTarget ? "custom challenge links" : null,
  ].filter((value): value is string => Boolean(value));
  const visibleModesDescription = formatList(visibleModes);

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
      fantasyDaily,
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
        try {
          await navigator.share({
            title: "Roster Riddle",
            text: shareText,
            url: window.location.href,
          });
        } catch (shareError) {
          await copyText(shareText);
          setShareStatus("copied");
          console.warn("Native share failed, copied result instead.", shareError);
        }
      } else {
        await copyText(shareText);
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
      await copyText(challengeUrl);
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
    <div className="w-full max-w-[1320px] flex flex-col items-center relative">
      <section className="w-full rounded-[28px] border border-white/10 bg-slate-950/55 shadow-[0_30px_80px_rgba(8,15,30,0.45)] backdrop-blur-xl overflow-hidden mb-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-7">
          <div className="max-w-3xl">
            <p className="text-xs sm:text-sm font-medium tracking-[0.18em] text-emerald-300/90 uppercase">Daily pro football puzzle</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-white">
              Roster <span className="text-emerald-400">Riddle</span>
            </h1>
            <p className="mt-3 text-base sm:text-lg leading-7 text-slate-300">{currentConfig.subtitle}</p>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 p-3 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="How to play"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-7">
          <div className="flex flex-wrap justify-center gap-2 mb-5">
          <ModeTab label="Classic" active={currentConfig.variant === "daily-standard"} onClick={() => switchVariant("daily-standard")} />
          <ModeTab label="Fantasy" active={currentConfig.variant === "daily-fantasy"} onClick={() => switchVariant("daily-fantasy")} />
          {weeklyTarget && <ModeTab label="Weekly" active={currentConfig.variant === "weekly"} onClick={() => switchVariant("weekly")} />}
          {challengeTarget && (
            <ModeTab label="Challenge" active={currentConfig.variant === "challenge"} onClick={() => switchVariant("challenge")} />
          )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6 text-sm text-slate-400">
            <span className="rounded-full bg-white/5 px-3 py-1 text-slate-200">{currentConfig.title}</span>
            <span>{currentConfig.puzzleKey}</span>
            <span>{MAX_GUESSES - guesses.length} guesses left</span>
          </div>

          {gameStatus === "playing" ? (
            <Search players={currentConfig.players} onGuess={handleGuess} guessedIds={guessedIds} label={currentConfig.searchLabel} />
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <ActionButton onClick={handleShareResult} icon={shareStatus === "copied" ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}>
                {shareStatus === "copied" ? "Copied" : "Share result"}
              </ActionButton>
              <ActionButton onClick={handleCopyChallengeLink} icon={<Link2 className="w-4 h-4" />}>
                Create challenge
              </ActionButton>
            </div>
          )}
        </div>
      </section>

      <StatsPanel stats={stats} />

      <div className="w-full grid lg:grid-cols-[minmax(0,2.3fr)_360px] gap-6">
        <section className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4 shadow-[0_18px_50px_rgba(8,15,30,0.28)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-white">Guess board</p>
              <p className="text-sm text-slate-400">Match conference, division, team, position, and jersey number.</p>
            </div>
          </div>
          <div className="grid grid-cols-[1.65fr_repeat(5,minmax(0,1fr))] gap-2.5 w-full text-xs text-slate-400 font-medium text-center mb-3">
            <div className="text-left pl-2">Player</div>
            <div>Conf</div>
            <div>Div</div>
            <div>Team</div>
            <div>Pos</div>
            <div>#</div>
          </div>

          <div className="w-full flex flex-col gap-3 min-h-[390px]">
            {guesses.map((guess) => (
              <div key={getPlayerId(guess.player)} className="grid grid-cols-[1.65fr_repeat(5,minmax(0,1fr))] gap-2.5 items-center">
                <div className="flex items-center gap-3 overflow-hidden bg-white/[0.045] p-3 rounded-2xl border border-white/8 min-h-14">
                  <PlayerBadge player={guess.player} compact />
                  <div className="min-w-0 flex flex-col justify-center">
                    <p className="font-semibold text-sm text-white truncate leading-tight">{guess.player.name}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 leading-none mt-1">
                      <span className="font-semibold text-emerald-300">{guess.player.team}</span>
                      <span>•</span>
                      <span>#{guess.player.jersey_number}</span>
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
                <div key={`empty-${index}`} className="grid grid-cols-[1.65fr_repeat(5,minmax(0,1fr))] gap-2.5 items-center opacity-55">
                  <div className="h-14 bg-white/[0.03] rounded-2xl border border-white/8 border-dashed" />
                  {Array.from({ length: 5 }).map((__, tileIndex) => (
                    <div key={tileIndex} className="h-14 bg-white/[0.03] rounded-2xl border border-white/8 border-dashed" />
                  ))}
                </div>
              ))}
          </div>
        </section>

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

          <div className="px-1 pt-1 text-sm text-slate-400">
            <div className="flex flex-wrap gap-4">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/82 backdrop-blur-md p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-950 border border-white/10 p-6 rounded-[28px] max-w-md w-full shadow-2xl relative" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              ✕
            </button>
            <h2 className="text-2xl font-semibold text-white mb-4">How to play</h2>
            <div className="space-y-4 text-base text-slate-300">
              <p>Use the tabs to move between {visibleModesDescription}.</p>
              <p>Green means exact. Yellow means same conference but wrong division. Arrows tell you whether the jersey number should be higher or lower.</p>
              <p>Finish in fewer guesses to place better on the leaderboard. Weekly mode keeps the same answer all week so friends can compare results more easily.</p>
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
        "px-4 py-2.5 rounded-full border text-sm font-medium transition-all",
        active
          ? "bg-emerald-400 text-zinc-950 border-emerald-400 shadow-[0_10px_26px_rgba(52,211,153,0.18)]"
          : "bg-white/[0.04] text-slate-200 border-white/10 hover:border-white/20 hover:bg-white/[0.06]"
      )}
    >
      {label}
    </button>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-3 rounded-full font-semibold text-sm transition-all",
        disabled
          ? "bg-white/[0.05] text-slate-500 cursor-not-allowed"
          : "bg-emerald-400 text-zinc-950 hover:bg-emerald-300 shadow-[0_12px_30px_rgba(52,211,153,0.18)]"
      )}
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
  const isComplete = gameStatus !== "playing";

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/52 p-5 backdrop-blur-xl">
      <p className="font-semibold text-slate-200 mb-3">{isComplete ? "Round recap" : "Current round"}</p>
      {isComplete ? (
        <div className="flex items-center gap-3 mb-4">
          <PlayerBadge player={player} />
          <div>
            <p className="text-white font-semibold text-lg">{player.name}</p>
            <p className="text-slate-400 text-sm">
              {player.team} • #{player.jersey_number} • {player.position}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 mb-4">
          <p className="text-white font-semibold text-base">No result yet</p>
          <p className="text-slate-400 text-sm mt-2">This panel turns into your recap after the puzzle is solved or you run out of guesses.</p>
        </div>
      )}
      <p className="text-sm text-slate-300 mb-4 leading-6">
        {isComplete ? "Use your finished result to share or create a challenge link." : "Nothing is revealed during play. The answer and sharing actions only appear after the round ends."}
      </p>
      {isComplete && (
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onShare} icon={shareStatus === "copied" ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}>
            {shareStatus === "copied" ? "Copied" : "Share"}
          </ActionButton>
          <ActionButton onClick={onChallenge} icon={<Link2 className="w-4 h-4" />}>
            Challenge
          </ActionButton>
        </div>
      )}
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
  const canSend = canSubmit && nickname.trim().length > 0 && status !== "loading";

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/52 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3 text-slate-300">
        <Users className="w-4 h-4" />
        <p className="font-semibold">Leaderboard</p>
      </div>

      {canSubmit && (
        <form
          className="mb-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) onSubmit();
          }}
        >
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Display Name"
            className="w-full rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              "w-full rounded-full py-3 text-sm font-semibold transition-colors",
              canSend ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300" : "bg-white/[0.05] text-slate-500 cursor-not-allowed"
            )}
          >
            {status === "loading" ? "Saving..." : "Submit Score"}
          </button>
        </form>
      )}

      {status === "error" && <p className="text-sm text-rose-400 mb-3">Leaderboard is unavailable right now.</p>}
      {status === "saved" && <p className="text-sm text-emerald-400 mb-3">Score saved.</p>}
      {status === "loading" && <p className="text-sm text-slate-400 mb-3">Loading leaderboard...</p>}

      <div className="space-y-2">
        {status === "loading" ? null : entries.length === 0 ? (
          <p className="text-sm text-slate-400">No scores yet. Be the first to post one.</p>
        ) : (
          entries.map((entry, index) => (
            <div key={`${entry.name}-${entry.timestamp}`} className="flex items-center justify-between rounded-3xl border border-white/8 px-3 py-3 bg-white/[0.03]">
              <div>
                <p className="text-white font-semibold text-sm">{index + 1}. {entry.name}</p>
                <p className="text-slate-400 text-xs">{entry.mode}</p>
              </div>
              <div className="text-emerald-300 font-semibold">{entry.guess_count}/{MAX_GUESSES}</div>
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
  const canSend = email.trim().length > 0 && status !== "saving";

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/52 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3 text-slate-300">
        <Mail className="w-4 h-4" />
        <p className="font-semibold">Get updates</p>
      </div>
      <p className="text-sm text-slate-300 mb-3 leading-6">Join the launch list for new puzzle modes, weekly events, and feature drops.</p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
      >
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <button
          type="submit"
          disabled={!canSend}
          className={cn(
            "w-full rounded-full py-3 text-sm font-semibold transition-colors",
            canSend ? "bg-zinc-100 text-zinc-950 hover:bg-white" : "bg-white/[0.05] text-slate-500 cursor-not-allowed"
          )}
        >
          {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Join Waitlist"}
        </button>
      </form>
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
        "rounded-full bg-gradient-to-br from-emerald-300 to-cyan-300 text-zinc-950 font-black flex items-center justify-center shrink-0 border border-white/15 shadow-[0_10px_24px_rgba(34,197,94,0.16)]",
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
    <div className="w-full grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
      <StatCard icon={<Trophy className="w-4 h-4" />} label="Games" value={stats.gamesPlayed.toString()} />
      <StatCard icon={<Check className="w-4 h-4" />} label="Wins" value={`${winRate}%`} />
      <StatCard icon={<Flame className="w-4 h-4" />} label="Current Streak" value={stats.currentStreak.toString()} />
      <StatCard icon={<Trophy className="w-4 h-4" />} label="Best Streak" value={stats.bestStreak.toString()} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-sm min-h-[102px]">
      <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Tile({ status, value, arrow }: { status: string; value: string; arrow?: string }) {
  const getColor = (currentStatus: string) => {
    if (currentStatus === "correct") return "bg-emerald-400 border-emerald-400 text-zinc-950";
    if (currentStatus === "close") return "bg-amber-300 border-amber-300 text-zinc-950";
    if (currentStatus === "incorrect" || currentStatus === "higher" || currentStatus === "lower") {
      return "bg-slate-900/90 border-white/10 text-white";
    }
    return "bg-white/[0.03] border-white/8 text-slate-500";
  };

  return (
    <div
      className={cn(
        "h-14 flex flex-col items-center justify-center rounded-2xl border text-center transition-all font-semibold text-sm shadow-sm relative overflow-hidden",
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

function formatList(items: string[]) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard access is unavailable.");
  }

  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();

  const successful = document.execCommand("copy");
  document.body.removeChild(helper);

  if (!successful) {
    throw new Error("Clipboard copy failed.");
  }
}

function getInitialVariant(initialView: string | undefined, challengeTarget: Player | null): PuzzleVariant {
  if (initialView === "weekly") return "weekly";
  if (initialView === "fantasy" || initialView === "offense") return "daily-fantasy";
  if (initialView === "challenge" && challengeTarget) return "challenge";
  return "daily-standard";
}

function getConfigForVariant(
  variant: PuzzleVariant,
  context: {
    standardDaily: Player;
    fantasyDaily: Player;
    weeklyTarget: Player | null;
    allPlayers: Player[];
    dailyKey: string;
    weeklyKey: string;
    challengeTarget: Player | null;
    challengeToken?: string;
  }
) {
  const { allPlayers, challengeTarget, challengeToken, dailyKey, fantasyDaily, standardDaily, weeklyKey, weeklyTarget } = context;
  const fantasyPlayers = allPlayers.filter((player) =>
    FANTASY_POSITIONS.includes(player.position as (typeof FANTASY_POSITIONS)[number])
  );

  if (variant === "daily-fantasy") {
    return {
      variant,
      title: "Daily Fantasy",
      subtitle: "A cleaner daily puzzle built from the fantasy-relevant core: QB, RB, WR, and TE.",
      searchLabel: "Search Fantasy Pool",
      target: fantasyDaily,
      players: fantasyPlayers,
      puzzleType: "daily" as const,
      leaderboardType: "daily" as const,
      leaderboardMode: "fantasy" as const,
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
    title: "Daily Classic",
    subtitle: "The full-roster daily puzzle, including defenders and the biggest non-fantasy stars.",
    searchLabel: "Search Full Roster",
    target: standardDaily,
    players: allPlayers,
    puzzleType: "daily" as const,
    leaderboardType: "daily" as const,
    leaderboardMode: "standard" as const,
    puzzleKey: dailyKey,
    allowsStats: true,
  };
}
