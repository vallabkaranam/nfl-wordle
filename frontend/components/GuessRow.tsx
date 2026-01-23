"use client";

import { motion } from "framer-motion";
import { GuessResult } from "../lib/gameLogic";
import { cn } from "../lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface GuessRowProps {
  result: GuessResult;
  index: number;
}

export default function GuessRow({ result, index }: GuessRowProps) {
  const { player, status } = result;

  const tiles = [
    { label: player.conf, status: status.conf },
    { label: player.div, status: status.div },
    { label: player.team, status: status.team },
    { label: player.position, status: status.position },
    { 
      label: player.jersey_number.toString(), 
      status: status.jersey === 'correct' ? 'correct' : 'incorrect',
      arrow: status.jersey 
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-2 mb-2 w-full max-w-2xl mx-auto">
      {tiles.map((tile, i) => (
        <FlipTile 
          key={i} 
          content={tile.label} 
          status={tile.status as any} 
          arrow={tile.arrow} 
          delay={index * 0.5 + i * 0.2} // Stagger based on row and col
        />
      ))}
    </div>
  );
}

function FlipTile({
  content,
  status,
  arrow,
  delay,
}: {
  content: string;
  status: "correct" | "incorrect" | "close";
  arrow?: "higher" | "lower" | "correct" | "incorrect";
  delay: number;
}) {
  const bgColor =
    status === "correct"
      ? "bg-brand-green border-brand-green"
      : status === "close"
      ? "bg-brand-yellow border-brand-yellow"
      : "bg-brand-gray border-brand-gray";

  return (
    <div className="aspect-square relative perspective-1000">
      <motion.div
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 180 }}
        transition={{ duration: 0.6, delay, type: "spring", stiffness: 260, damping: 20 }}
        className="w-full h-full relative preserve-3d"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden bg-transparent border-2 border-zinc-700 flex items-center justify-center text-white font-bold text-xl uppercase">
          {/* Initially empty or could show content if we want immediate feedback before flip? 
              Wordle usually flips to reveal. But here we usually show the guess immediately?
              Actually Wordle shows the letter, then flips to color.
              So Front should have content with neutral bg.
          */}
          {content}
        </div>

        {/* Back */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center text-white font-bold text-xl uppercase border-2",
            bgColor
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
          {content}
          {arrow === "higher" && <ArrowUp className="w-6 h-6 animate-bounce mt-1" />}
          {arrow === "lower" && <ArrowDown className="w-6 h-6 animate-bounce mt-1" />}
        </div>
      </motion.div>
    </div>
  );
}
