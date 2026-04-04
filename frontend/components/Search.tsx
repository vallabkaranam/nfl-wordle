"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Search as SearchIcon } from "lucide-react";
import { getPlayerId, Player } from "../lib/gameLogic";

interface SearchProps {
  players: Player[];
  onGuess: (player: Player) => void;
  disabled?: boolean;
  guessedIds: Set<string>;
  label?: string;
}

export default function Search({ players, onGuess, disabled, guessedIds, label = "Search Active Roster" }: SearchProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const fuse = useMemo(
    () =>
      new Fuse(players, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "team", weight: 0.2 },
          { name: "position", weight: 0.1 },
        ],
        threshold: 0.4,
        includeScore: true,
        ignoreLocation: true,
        useExtendedSearch: true,
      }),
    [players]
  );

  const results = useMemo(() => {
    if (!query) return [];
    return fuse
      .search(query)
      .map((result) => result.item)
      .filter((player) => !guessedIds.has(getPlayerId(player)))
      .slice(0, 6);
  }, [fuse, guessedIds, query]);

  const handleSelect = (player: Player) => {
    onGuess(player);
    setQuery("");
    setShowResults(false);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto z-50">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-zinc-500 uppercase font-black tracking-widest">{label}</p>
      </div>

      <div className="relative group">
        <div className="absolute inset-0 bg-emerald-400/20 blur-lg rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
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
              key={getPlayerId(player)}
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
                  <p className="text-xs text-zinc-400 font-mono tracking-wider">
                    {player.team} • #{player.jersey_number}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
