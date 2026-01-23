"use client";

import { useState, useEffect } from "react";
import { Player, GuessResult, checkGuess, getAllPlayers } from "../lib/gameLogic";
import GuessRow from "./GuessRow";
import Search from "./Search";
import { motion } from "framer-motion";

interface GameProps {
  dailyPlayer: Player;
  allPlayers: Player[]; // Initial server-side load
}

export default function Game({ dailyPlayer, allPlayers: initialPlayers }: GameProps) {
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  
  // V2: Offense Only Filter
  const [offenseOnly, setOffenseOnly] = useState(false);
  const [displayedPlayers, setDisplayedPlayers] = useState<Player[]>(initialPlayers);

  // Re-fetch players when filter changes
  useEffect(() => {
    async function updatePlayers() {
      // Optimistic filter if allPlayers already has everything? 
      // Actually backend does the filtering efficiently, but we already loaded allPlayers on initial load.
      // If V2 spec implies backend filtering, we should use it.
      // However, initialPlayers (all) is passed.
      // If we switch to offense only, we can just filter client side for speed since we have the data.
      // BUT, if the requirement is "Update endpoint... to accept ?offense_only=true", we should demonstrate that usage.
      // Let's call API to be safe and robust for future scaling.
      
      const newPlayers = await getAllPlayers(offenseOnly);
      setDisplayedPlayers(newPlayers);
    }
    updatePlayers();
  }, [offenseOnly]);

  const handleGuess = (player: Player) => {
    if (gameStatus !== "playing") return;

    const result = checkGuess(dailyPlayer, player);
    const newGuesses = [...guesses, result]; // Append new guess
    setGuesses(newGuesses);

    if (result.status.conf === 'correct' && result.status.div === 'correct' && result.status.team === 'correct' && result.status.position === 'correct' && result.status.jersey === 'correct') {
      setGameStatus("won");
    } else if (newGuesses.length >= 5) { // V2: Limit to 5
      setGameStatus("lost");
    }
  };

  return (
    <div className="w-full max-w-3xl flex flex-col items-center">
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tighter text-white mb-2">
          NFL <span className="text-brand-green">WORDLE</span>
        </h1>
        <p className="text-zinc-400">Guess the daily player ({5 - guesses.length} left)</p>
      </div>

      <div className="grid grid-cols-5 gap-2 w-full max-w-2xl mb-2 px-1 text-xs text-zinc-500 uppercase font-bold text-center tracking-wider">
        <div>Conf</div>
        <div>Div</div>
        <div>Team</div>
        <div>Pos</div>
        <div>#</div>
      </div>

      <div className="w-full flex flex-col gap-2 mb-8 min-h-[350px]">
        {guesses.map((guess, idx) => (
          <GuessRow key={idx} result={guess} index={0} /> 
        ))}
        {/* Fill remaining slots with empty placeholders if needed? Wordle does empty boxes. */}
        {Array.from({ length: Math.max(0, 5 - guesses.length) }).map((_, i) => (
             <div key={`empty-${i}`} className="grid grid-cols-5 gap-2 w-full max-w-2xl mx-auto opacity-20">
                {[...Array(5)].map((_, j) => (
                   <div key={j} className="aspect-square border-2 border-zinc-700 rounded-sm"></div>
                ))}
             </div>
        ))}
      </div>

      {gameStatus === "playing" && (
        <Search 
            players={displayedPlayers} 
            onGuess={handleGuess} 
            offenseOnly={offenseOnly}
            onFilterChange={setOffenseOnly}
        />
      )}

      {gameStatus === "won" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border-2 border-brand-green p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative overflow-hidden"
            >
            <div className="absolute inset-0 bg-brand-green/10 animate-pulse"></div>
            <div className="relative z-10">
                <h2 className="text-5xl font-extrabold text-brand-green mb-4 tracking-tighter">TOUCHDOWN!</h2>
                <img src={dailyPlayer.headshot} alt={dailyPlayer.name} className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-brand-green bg-zinc-800" />
                <p className="text-2xl font-bold text-white mb-2">{dailyPlayer.name}</p>
                <p className="text-zinc-400 mb-6">{dailyPlayer.team} • {dailyPlayer.position} • #{dailyPlayer.jersey_number}</p>
                <button onClick={() => window.location.reload()} className="bg-brand-green text-white font-bold py-3 px-8 rounded-full hover:bg-green-600 transition-colors">
                    Play Again
                </button>
            </div>
            </motion.div>
        </div>
      )}
      
      {gameStatus === "lost" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border-2 border-red-500 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative"
            >
            <h2 className="text-4xl font-extrabold text-red-500 mb-4 tracking-tighter">TURNOVER ON DOWNS</h2>
            <div className="mb-6">
                 <p className="text-zinc-400 text-sm uppercase tracking-widest mb-2">The Player Was</p>
                 <img src={dailyPlayer.headshot} alt={dailyPlayer.name} className="w-24 h-24 rounded-full mx-auto mb-2 border-4 border-red-500 bg-zinc-800" />
                 <p className="text-2xl font-bold text-white">{dailyPlayer.name}</p>
                 <p className="text-zinc-500 text-sm">{dailyPlayer.team} #{dailyPlayer.jersey_number}</p>
            </div>
            <button onClick={() => window.location.reload()} className="bg-red-600 text-white font-bold py-3 px-8 rounded-full hover:bg-red-700 transition-colors">
                Try Again
            </button>
            </motion.div>
        </div>
      )}
    </div>
  );
}
