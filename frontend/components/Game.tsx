"use client";

import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Player, GuessResult, checkGuess, getAllPlayers } from "../lib/gameLogic";
import { cn } from "../lib/utils";
import Search from "./Search";

interface GameProps {
  standardDaily: Player;
  offenseDaily: Player;
  allPlayers: Player[]; 
}

export default function Game({ standardDaily, offenseDaily, allPlayers: initialPlayers }: GameProps) {
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  
  // V2: Offense Only Filter
  const [offenseOnly, setOffenseOnly] = useState(false);
  const [displayedPlayers, setDisplayedPlayers] = useState<Player[]>(initialPlayers);

  // Active Target Logic
  const activeTarget = offenseOnly ? offenseDaily : standardDaily;

  // Help Modal State
  const [showHelp, setShowHelp] = useState(false);

  // Re-fetch players when filter changes
  useEffect(() => {
    async function updatePlayers() {
      // If we switch to offense only, we filter client side for immediate interaction speed
      // The backend daily logic uses this flag for SEEDING, but for search pool we can filter locally
      if (offenseOnly) {
         setDisplayedPlayers(initialPlayers.filter(p => ['QB', 'RB', 'WR', 'TE', 'FB'].includes(p.position)));
      } else {
         setDisplayedPlayers(initialPlayers);
      }
    }
    updatePlayers();
  }, [offenseOnly, initialPlayers]);

  const handleGuess = (player: Player) => {
    if (gameStatus !== "playing") return;

    const result = checkGuess(activeTarget, player);
    const newGuesses = [...guesses, result]; // Append new guess (Top to Bottom order)
    setGuesses(newGuesses);

    if (result.status.conf === 'correct' && result.status.div === 'correct' && result.status.team === 'correct' && result.status.position === 'correct' && result.status.jersey === 'correct') {
      setGameStatus("won");
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6aaa64', '#ffffff', '#c9b458'] // Brand colors
      });
    } else if (newGuesses.length >= 5) { 
      setGameStatus("lost");
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center relative">
      
      {/* Help Button - Absolute Top Right */}
      <button 
        onClick={() => setShowHelp(true)}
        className="absolute top-4 right-4 z-50 text-zinc-500 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      </button>

      {/* Sticky Header with Search */}
      <div className="sticky top-0 z-40 w-full bg-zinc-950/80 backdrop-blur-md pt-4 pb-2 px-4 shadow-sm border-b border-zinc-900 mb-6">
          <div className="mb-4 text-center">
            <h1 className="text-5xl font-extrabold tracking-tighter text-white uppercase italic transform -skew-x-6">
              NFL <span className="text-brand-green">WORDLE</span>
            </h1>
            <p className="text-zinc-500 font-bold tracking-widest text-xs uppercase mt-1">
                Guess the daily player <span className="text-brand-green">({5 - guesses.length} left)</span>
            </p>
          </div>

          {gameStatus === "playing" && (
            <Search 
                players={displayedPlayers} 
                onGuess={handleGuess} 
                offenseOnly={offenseOnly}
                onFilterChange={setOffenseOnly}
                toggleDisabled={guesses.length > 0} // Only lock the toggle!
                disabled={false} // Never disable the search input while playing
            />
          )}
      </div>

      <div className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-2 w-full max-w-2xl px-2 text-[10px] text-zinc-500 uppercase font-black text-center tracking-widest mb-2">
        <div className="text-left pl-2">Player</div>
        <div>Conf</div>
        <div>Div</div>
        <div>Team</div>
        <div>Pos</div>
        <div>#</div>
      </div>

      <div className="w-full flex flex-col gap-3 min-h-[350px] px-2 pb-20">
        {guesses.map((guess, idx) => (
          <div key={idx} className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-2 items-center">
             {/* Player Name & Info Column */}
             <div className="flex items-center gap-2 overflow-hidden bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                <img src={guess.player.headshot} className="w-8 h-8 rounded-full bg-zinc-800 object-cover shrink-0" alt="" />
                <div className="min-w-0 flex flex-col justify-center">
                    <p className="font-bold text-xs text-white truncate leading-tight uppercase tracking-tight">{guess.player.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 leading-none mt-0.5">
                         <span className="font-black text-brand-green">{guess.player.team}</span>
                    </div>
                </div>
             </div>
             
             {/* Attribute Tiles */}
             <Tile status={guess.status.conf} value={guess.player.conf} />
             <Tile status={guess.status.div} value={guess.player.div} />
             <Tile status={guess.status.team} value={guess.player.team} />
             <Tile status={guess.status.position} value={guess.player.position} />
             <Tile status={guess.status.jersey} value={guess.player.jersey_number.toString()} arrow={guess.comparison.jersey} />
          </div>
        ))}
        
        {/* Placeholder Rows */}
        {gameStatus === 'playing' && Array.from({ length: Math.max(0, 5 - guesses.length) }).map((_, i) => (
             <div key={`empty-${i}`} className="grid grid-cols-[1.5fr_repeat(5,minmax(0,1fr))] gap-2 items-center opacity-30">
                <div className="h-12 bg-zinc-800/50 rounded-lg border border-zinc-800/50 border-dashed"></div>
                {[...Array(5)].map((_, j) => (
                   <div key={j} className="h-12 bg-zinc-800/50 rounded-lg border border-zinc-800/50 border-dashed"></div>
                ))}
             </div>
        ))}
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setShowHelp(false)}>
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
                <h2 className="text-2xl font-black text-white mb-4 uppercase italic">How to Play</h2>
                <div className="space-y-4 text-sm text-zinc-300">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-green rounded border border-brand-green flex items-center justify-center font-bold text-black text-xs">GB</div>
                        <p><span className="text-brand-green font-bold">GREEN</span> means a match!</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-yellow rounded border border-brand-yellow flex items-center justify-center font-bold text-black text-xs">NFC</div>
                        <p><span className="text-brand-yellow font-bold">YELLOW</span> means close (Same Conference, wrong Division).</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-900 rounded border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">UNK</div>
                        <p><span className="text-zinc-500 font-bold">GRAY</span> means no match.</p>
                    </div>
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-zinc-900 rounded border border-zinc-700 flex items-center justify-center font-bold text-white text-xs relative">
                            12
                            <span className="absolute bottom-[-6px] right-0.5 text-2xl leading-none text-white drop-shadow-md font-black">↑</span>
                         </div>
                        <p>Arrows indicate if the value is <span className="font-bold text-white">HIGHER</span> or <span className="font-bold text-white">LOWER</span>.</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Modals remain mostly same but slightly customized */}
      {gameStatus === "won" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-zinc-900 border-2 border-brand-green p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-green/20 via-transparent to-transparent animate-pulse"></div>
            <div className="relative z-10">
                <h2 className="text-6xl font-black text-brand-green mb-6 tracking-tighter italic transform -skew-x-6 drop-shadow-lg">TOUCHDOWN!</h2>
                <div className="relative inline-block mb-6">
                    <img src={activeTarget.headshot} alt={activeTarget.name} className="w-32 h-32 rounded-full border-4 border-brand-green bg-zinc-950 shadow-xl object-cover relative z-10" />
                    <div className="absolute inset-0 rounded-full bg-brand-green blur-md opacity-50"></div>
                </div>
                <p className="text-3xl font-black text-white mb-1 uppercase">{activeTarget.name}</p>
                <div className="flex justify-center gap-2 mb-8">
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-bold text-zinc-400">{activeTarget.team}</span>
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-bold text-zinc-400">#{activeTarget.jersey_number}</span>
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-bold text-zinc-400">{activeTarget.position}</span>
                </div>
                <button onClick={() => window.location.reload()} className="w-full bg-brand-green text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-green-400 hover:scale-105 transition-all shadow-lg hover:shadow-brand-green/30">
                    Play Again
                </button>
            </div>
            </motion.div>
        </div>
      )}
      
      {gameStatus === "lost" && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
             <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-zinc-900 border-2 border-red-600 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl relative"
            >
            <h2 className="text-4xl font-black text-red-600 mb-8 tracking-tighter uppercase italic">Turnover<br/>on Downs</h2>
            <div className="mb-8 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
                 <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-4">The Player Was</p>
                 <img src={activeTarget.headshot} alt={activeTarget.name} className="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-zinc-700 bg-zinc-800 grayscale" />
                 <p className="text-2xl font-black text-white uppercase mb-4">{activeTarget.name}</p>
                 <div className="flex justify-center gap-2">
                    <span className="px-2 py-1 bg-zinc-900 rounded text-xs font-bold text-zinc-400 border border-zinc-700">{activeTarget.team}</span>
                    <span className="px-2 py-1 bg-zinc-900 rounded text-xs font-bold text-zinc-400 border border-zinc-700">#{activeTarget.jersey_number}</span>
                    <span className="px-2 py-1 bg-zinc-900 rounded text-xs font-bold text-zinc-400 border border-zinc-700">{activeTarget.position}</span>
                </div>
            </div>
            <button onClick={() => window.location.reload()} className="w-full bg-zinc-800 text-white font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-zinc-700 transition-all border border-zinc-700">
                Try Again
            </button>
            </motion.div>
        </div>
      )}
    </div>
  );
}

// Inline Tile component for simplicity in the complex grid
function Tile({ status, value, arrow }: { status: string; value: string; arrow?: string }) {
    const getColor = (s: string) => {
        if (s === 'correct') return 'bg-brand-green border-brand-green text-black';
        if (s === 'close') return 'bg-brand-yellow border-brand-yellow text-black'; // Not really used in NFL Wordle context usually? but partial matches exist
        if (s === 'incorrect' || s === 'higher' || s === 'lower') return 'bg-zinc-900 border-zinc-700 text-white'; 
        return 'bg-zinc-800 border-zinc-800 text-zinc-500'; // Fallback for unknown states 
    };

    return (
        <div className={cn(
            "h-12 flex flex-col items-center justify-center rounded-md border text-center transition-all font-bold text-xs uppercase shadow-sm relative overflow-hidden",
            getColor(status)
        )}>
            <span className="z-10 relative">{value}</span>
            {arrow && (
                <span className="absolute bottom-0 right-0.5 text-2xl leading-none text-white drop-shadow-md font-black pointer-events-none">{arrow}</span>
            )}
            {/* Glass shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
        </div>
    )
}
