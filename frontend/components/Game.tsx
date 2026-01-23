"use client";

import { useState } from "react";
import { Player, GuessResult, checkGuess } from "../lib/gameLogic";
import GuessRow from "./GuessRow";
import Search from "./Search";
import { motion } from "framer-motion";

interface GameProps {
  dailyPlayer: Player;
  allPlayers: Player[];
}

export default function Game({ dailyPlayer, allPlayers }: GameProps) {
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");

  const handleGuess = (player: Player) => {
    if (gameStatus !== "playing") return;

    const result = checkGuess(dailyPlayer, player);
    const newGuesses = [...guesses, result]; // Append new guess
    setGuesses(newGuesses);

    if (result.status.conf === 'correct' && result.status.div === 'correct' && result.status.team === 'correct' && result.status.position === 'correct' && result.status.jersey === 'correct') {
      setGameStatus("won");
    } else if (newGuesses.length >= 8) {
      setGameStatus("lost");
    }
  };

  return (
    <div className="w-full max-w-3xl flex flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tighter text-white mb-2">
          NFL <span className="text-brand-green">WORDLE</span>
        </h1>
        <p className="text-zinc-400">Guess the daily player</p>
      </div>

      <div className="grid grid-cols-5 gap-2 w-full max-w-2xl mb-2 px-1 text-xs text-zinc-500 uppercase font-bold text-center tracking-wider">
        <div>Conf</div>
        <div>Div</div>
        <div>Team</div>
        <div>Pos</div>
        <div>#</div>
      </div>

      <div className="w-full flex flex-col gap-2 mb-8 min-h-[400px]">
        {guesses.map((guess, idx) => (
          <GuessRow key={idx} result={guess} index={0} /> 
        ))}
        {/* Placeholder rows? maybe not needed for now */}
      </div>

      {gameStatus === "playing" && (
        <Search players={allPlayers} onGuess={handleGuess} />
      )}

      {gameStatus === "won" && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-green/20 border border-brand-green text-brand-green px-8 py-6 rounded-xl mb-8 text-center"
        >
          <h2 className="text-3xl font-bold mb-2">TOUCHDOWN!</h2>
          <p className="text-xl">You guessed <span className="font-bold text-white">{dailyPlayer.name}</span> correctly.</p>
        </motion.div>
      )}
      
      {gameStatus === "lost" && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/20 border border-red-500 text-red-500 px-8 py-6 rounded-xl mb-8 text-center"
        >
          <h2 className="text-3xl font-bold mb-2">GAME OVER</h2>
          <p className="text-xl">The player was <span className="font-bold text-white">{dailyPlayer.name}</span>.</p>
        </motion.div>
      )}
    </div>
  );
}
