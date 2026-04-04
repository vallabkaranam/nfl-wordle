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

  const hasResults = showResults && results.length > 0;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-sm text-slate-300 font-medium">{label}</p>
      </div>

      <div className="relative group">
        <div className="absolute inset-0 bg-emerald-400/8 blur-xl rounded-[24px] opacity-0 group-focus-within:opacity-100 transition-opacity" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowResults(event.target.value.trim().length > 0);
          }}
          onFocus={() => setShowResults(query.trim().length > 0)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              handleSelect(results[0]);
            }
            if (event.key === "Escape") {
              setShowResults(false);
            }
          }}
          placeholder="Search by player, team, or position"
          disabled={disabled}
          className="relative w-full bg-white/[0.05] border border-white/10 text-white px-4 py-4 pl-12 rounded-[24px] focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-base shadow-[0_18px_44px_rgba(8,15,30,0.18)] transition-all placeholder:text-slate-400"
        />
        <SearchIcon className="absolute left-4 top-5 text-slate-400 w-5 h-5" />
      </div>

      {hasResults && (
        <ul className="mt-3 bg-slate-950/96 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden shadow-2xl max-h-80 overflow-y-auto">
          {results.map((player) => (
            <li
              key={getPlayerId(player)}
              onClick={() => handleSelect(player)}
              className="px-4 py-3 hover:bg-white/[0.06] cursor-pointer flex items-center justify-between transition-colors border-b border-white/6 last:border-0 group"
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
                  <div className="absolute -bottom-1 -right-1 bg-slate-950 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-200">{player.position}</div>
                </div>
                <div>
                  <p className="font-semibold text-base text-white leading-none mb-1">{player.name}</p>
                  <p className="text-sm text-slate-400">
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
