"use client";

import { useState, useEffect } from "react";
import { cn } from "@/shared/ui/utils";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

interface Props {
  onSaved?: (name: string) => void;
}

export function CompanyNameCard({ onSaved }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/admin/api/settings")
      .then((r) => r.json())
      .then((data: { settings: { company_name: string } }) => {
        setCompanyName(data.settings.company_name ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Saved." });
        onSaved?.(companyName.trim());
      } else {
        setMessage({ type: "error", text: data.error ?? "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <Label htmlFor="company-name" className="text-foreground">
          Company Name
        </Label>
        <p className="type-caption">
          Displayed as a prefix in browser page titles (e.g. &ldquo;{companyName || "Great Wall Trading"} · Ops Hub · Sales Rate&rdquo;).
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        <Input
          id="company-name"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          maxLength={100}
        />
      )}

      <div>
        <Button variant="secondary" onClick={save} disabled={saving || loading}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {message && (
        <p
          className={cn(
            "type-body",
            message.type === "success" ? "text-success" : "text-destructive",
          )}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}
