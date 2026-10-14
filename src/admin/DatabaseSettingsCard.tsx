"use client";

import { useEffect, useState } from "react";
import { Card } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { DbConnectionForm, type DbConnectionFormValues } from "@/shared/ui/DbConnectionForm";

interface DbConfigResponse {
  configured: boolean;
  config: { host: string; port: number; user: string; database: string; appDatabase: string | null } | null;
}

export function DatabaseSettingsCard() {
  const [initial, setInitial] = useState<DbConnectionFormValues | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/admin/api/database")
      .then((r) => r.json())
      .then((data: DbConfigResponse) => {
        setInitial({
          host: data.config?.host ?? "",
          port: String(data.config?.port ?? 3306),
          user: data.config?.user ?? "",
          database: data.config?.database ?? "",
          appDatabase: data.config?.appDatabase ?? "",
        });
      })
      .catch(() => setInitial({ host: "", port: "3306", user: "", database: "" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <Label className="text-foreground">ActiveOne Database Connection</Label>
        <p className="type-caption">
          The MySQL connection powering ActiveOne data. Operations Hub&apos;s own tables live in the
          App database (blank = same database as ActiveOne). Saving a new connection reconnects
          the app immediately — an incorrect connection can take the app offline until corrected.
        </p>
      </div>

      {loading || !initial ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <DbConnectionForm
          initial={initial}
          testUrl="/admin/api/database/test"
          saveUrl="/admin/api/database"
          saveMethod="PUT"
          saveLabel="Save Connection"
          passwordRequired={false}
        />
      )}
    </Card>
  );
}
