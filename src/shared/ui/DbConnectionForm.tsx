"use client";

import { useState } from "react";
import { cn } from "@/shared/ui/utils";
import { Input } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

export interface DbConnectionFormValues {
  host: string;
  port: string;
  user: string;
  database: string;
  appDatabase?: string;
}

interface Props {
  /** Prefill for edit contexts (password is never prefilled). */
  initial?: DbConnectionFormValues;
  testUrl: string;
  saveUrl: string;
  saveMethod?: "POST" | "PUT";
  saveLabel: string;
  /** When false (admin edit), a blank password keeps the stored one. */
  passwordRequired: boolean;
  onSaved?: () => void;
}

type Message = { type: "success" | "error"; text: string } | null;

export function DbConnectionForm({
  initial,
  testUrl,
  saveUrl,
  saveMethod = "POST",
  saveLabel,
  passwordRequired,
  onSaved,
}: Props) {
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(initial?.port ?? "3306");
  const [user, setUser] = useState(initial?.user ?? "");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState(initial?.database ?? "");
  const [appDatabase, setAppDatabase] = useState(initial?.appDatabase ?? "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  function payload() {
    return { host, port: Number(port), user, password, database, appDatabase };
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage({ type: "success", text: "Connection successful." });
      } else {
        setMessage({ type: "error", text: data.error ?? "Could not connect." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(saveUrl, {
        method: saveMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage({ type: "success", text: "Saved." });
        onSaved?.();
      } else {
        setMessage({ type: "error", text: data.error ?? "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const busy = testing || saving;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="db-host">Host</Label>
          <Input id="db-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="db-port">Port</Label>
          <Input id="db-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3306" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="db-database">Database</Label>
        <Input id="db-database" value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="greatwall_activeone" autoComplete="off" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="db-app-database">App database</Label>
        <Input id="db-app-database" value={appDatabase} onChange={(e) => setAppDatabase(e.target.value)} placeholder="ops_hub" autoComplete="off" />
        <p className="type-caption text-muted-foreground">Blank = app tables live in the ActiveOne database.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="db-user">User</Label>
          <Input id="db-user" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="db-password">Password</Label>
          <PasswordInput
            id="db-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={passwordRequired ? "" : "Leave blank to keep current"}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={testConnection} disabled={busy}>
          {testing ? "Testing…" : "Test Connection"}
        </Button>
        <Button onClick={save} disabled={busy}>
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>

      {message && (
        <p className={cn("type-body", message.type === "success" ? "text-success" : "text-destructive")}>
          {message.text}
        </p>
      )}
    </div>
  );
}
