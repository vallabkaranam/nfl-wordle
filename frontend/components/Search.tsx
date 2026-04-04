"use client";

import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import { Player } from "../lib/gameLogic";
import { cn } from "../lib/utils";
import { Search as SearchIcon } from "lucide-react";

interface SearchProps {
  players: Player[];
  onGuess: (player: Player) => void;
  disabled?: boolean;        // Disables the INPUT (game over)
  toggleDisabled?: boolean;  // Disables the TOGGLE (locked after 1 guess)
  onFilterChange: (offenseOnly: boolean) => void;
  offenseOnly: boolean;
  guessedIds: Set<string>;
}

export default function Search({ players, onGuess, disabled, toggleDisabled, onFilterChange, offenseOnly, guessedIds }: SearchProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const fuse = useMemo(() => {
    return new Fuse(players, {
      keys: [
        { name: "name", weight: 0.7 },
        { name: "team", weight: 0.2 },
        { name: "position", weight: 0.1 }
      ], // Weighted Search
      threshold: 0.4, // Logic: Allow more typos (AI-like correction)
      includeScore: true,
      ignoreLocation: true, // Find match anywhere in string
      useExtendedSearch: true // Enable logical queries
    });
  }, [players]);

  const results = useMemo(() => {
    if (!query || !fuse) return [];
    return fuse
      .search(query)
      .map((r) => r.item)
      .filter((player) => !guessedIds.has(`${player.name}::${player.team}::${player.jersey_number}`))
      .slice(0, 5);
  }, [query, fuse, guessedIds]);

  const handleSelect = (player: Player) => {
    onGuess(player);
    setQuery("");
    setShowResults(false);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto z-50">
      <div className="flex items-center justify-between mb-2 px-1">
         <p className="text-xs text-zinc-500 uppercase font-black tracking-widest">Search Active Roster</p>
         <label className={`flex items-center gap-2 ${toggleDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <span className="text-xs text-zinc-400 font-bold uppercase">Offense Only</span>
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={offenseOnly}
                disabled={toggleDisabled}
                onChange={(e) => !toggleDisabled && onFilterChange(e.target.checked)}
              />
              <div className={cn("block w-10 h-6 rounded-full transition-colors", offenseOnly ? "bg-emerald-400" : "bg-zinc-800 border border-zinc-700")}></div>
              <div className={cn("dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm", offenseOnly ? "transform translate-x-4" : "")}></div>
            </div>
         </label>
      </div>

      <div className="relative group">
        <div className="absolute inset-0 bg-emerald-400/20 blur-lg rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              handleSelect(results[0]);
            }
          }}
          placeholder="ENTER PLAYER NAME OR TEAM..."
          disabled={disabled}
          className="relative w-full bg-zinc-950 border-2 border-zinc-800 text-white px-4 py-4 pl-12 rounded-xl focus:outline-none focus:border-emerald-400 focus:ring-0 uppercase font-bold tracking-wide text-lg shadow-2xl transition-all placeholder:text-zinc-600"
        />
        <SearchIcon className="absolute left-4 top-5 text-zinc-500 w-5 h-5" />
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute w-full bg-zinc-900/95 backdrop-blur-xl border-x border-b border-zinc-700 rounded-b-xl overflow-hidden shadow-2xl max-h-80 overflow-y-auto top-[calc(100%-4px)] pt-2 z-10">
          {results.map((player) => (
            <li
              key={`${player.name}-${player.jersey_number}-${player.team}`}
              onClick={() => handleSelect(player)}
              className="px-4 py-3 hover:bg-emerald-400/15 cursor-pointer flex items-center justify-between transition-colors border-b border-zinc-800/50 last:border-0 group"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400/80 to-cyan-400/60 text-zinc-950 font-black flex items-center justify-center border border-white/15">
                      {player.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-zinc-950 text-[10px] font-bold px-1 rounded border border-zinc-700">{player.position}</div>
                </div>
                <div>
                  <p className="font-black text-base uppercase text-white leading-none mb-1">{player.name}</p>
                  <p className="text-xs text-zinc-400 font-mono tracking-wider">{player.team} • #{player.jersey_number}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
