"use client";

import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import { Player } from "../lib/gameLogic";
import { cn } from "../lib/utils";
import { Search as SearchIcon } from "lucide-react";

interface SearchProps {
  players: Player[];
  onGuess: (player: Player) => void;
  disabled?: boolean;
}

export default function Search({ players, onGuess, disabled }: SearchProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const fuse = useMemo(() => {
    return new Fuse(players, {
      keys: ["name", "team", "position"],
      threshold: 0.3,
    });
  }, [players]);

  const results = useMemo(() => {
    if (!query) return [];
    return fuse.search(query).map((r) => r.item).slice(0, 5);
  }, [query, fuse]);

  const handleSelect = (player: Player) => {
    onGuess(player);
    setQuery("");
    setShowResults(false);
  };

  return (
    <div className="relative w-full max-w-lg mx-auto mb-8 z-50">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search for an NFL player..."
          disabled={disabled}
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-4 py-3 pl-10 rounded-lg focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
        />
        <SearchIcon className="absolute left-3 top-3.5 text-zinc-400 w-5 h-5" />
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute w-full bg-zinc-900 border border-zinc-700 rounded-lg mt-1 overflow-hidden shadow-xl max-h-60 overflow-y-auto">
          {results.map((player) => (
            <li
              key={`${player.name}-${player.jersey_number}-${player.team}`}
              onClick={() => handleSelect(player)}
              className="px-4 py-3 hover:bg-zinc-800 cursor-pointer flex items-center justify-between transition-colors border-b border-zinc-800 last:border-0"
            >
              <div className="flex items-center gap-3">
                <img src={player.headshot} alt={player.name} className="w-8 h-8 rounded-full bg-zinc-800" />
                <div>
                  <p className="font-bold text-sm">{player.name}</p>
                  <p className="text-xs text-zinc-400">{player.team} • {player.position} • #{player.jersey_number}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
