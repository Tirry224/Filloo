"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, Clock } from "lucide-react";

const KEY = "filloo.recherches";
const MAX = 5;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Navigation privée, stockage plein, cookies refusés : pas
    // d'historique, mais pas d'écran cassé non plus.
    return [];
  }
}

const classes = {
  header: "flex items-center justify-between",
  title: "text-xs font-semibold tracking-wider text-ink-soft uppercase",
  clear: "cursor-pointer text-sm font-semibold text-accent",
  row: "flex h-11 items-center gap-3 border-b border-line last:border-b-0",
  icon: "shrink-0 text-ink-soft",
  label: "flex-1 truncate text-base",
};

export function RecentSearches({ q, show }: { q: string; show: boolean }) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const previous = read();
    const term = q.trim();
    if (!term) {
      setRecent(previous);
      return;
    }
    const list = [term, ...previous.filter((r) => r !== term)].slice(0, MAX);
    setRecent(list);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
    }
  }, [q]);

  function clear() {
    setRecent([]);
    try {
      localStorage.removeItem(KEY);
    } catch {
    }
  }

  if (!show || recent.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className={classes.header}>
        <span className={classes.title}>Recherches récentes</span>
        <button type="button" onClick={clear} className={classes.clear}>
          Effacer
        </button>
      </div>
      <div>
        {recent.map((term) => (
          <Link key={term} href={`/recherche?q=${encodeURIComponent(term)}`} className={classes.row}>
            <Clock size={18} strokeWidth={1.7} className={classes.icon} aria-hidden />
            <span className={classes.label}>{term}</span>
            <ArrowUpLeft size={17} strokeWidth={2} className={classes.icon} aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
