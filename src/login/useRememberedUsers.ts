"use client";

import { useState, useEffect, useCallback } from "react";

export interface RememberedUser {
  username: string;
  displayName: string;
  lastLoginAt: number;
}

const STORAGE_KEY = "opshub:remembered-users";

function readStorage(): RememberedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RememberedUser[];
  } catch {
    return [];
  }
}

function writeStorage(users: RememberedUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {}
}

export function useRememberedUsers() {
  const [users, setUsers] = useState<RememberedUser[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUsers(readStorage());
    setHydrated(true);
  }, []);

  const remember = useCallback((username: string, displayName: string) => {
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.username !== username);
      const next: RememberedUser[] = [
        { username, displayName, lastLoginAt: Date.now() },
        ...filtered,
      ];
      writeStorage(next);
      return next;
    });
  }, []);

  const forget = useCallback((username: string) => {
    setUsers((prev) => {
      const next = prev.filter((u) => u.username !== username);
      writeStorage(next);
      return next;
    });
  }, []);

  return { users, hydrated, remember, forget };
}
