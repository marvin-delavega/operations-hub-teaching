"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getSession } from "next-auth/react";
import { cn } from "@/shared/ui/utils";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/shared/ui/dialog";
import { OrderSchedulingKanban } from "@/admin/OrderSchedulingKanban";
import { UsersTab } from "@/admin/UsersTab";
import { RolesTab } from "@/admin/RolesTab";
import { OrderPoolingTab } from "@/admin/OrderPoolingTab";
import { CompanyNameCard } from "@/admin/CompanyNameCard";
import { LocationVisibilityManager } from "@/admin/LocationVisibilityManager";
import { PoCodeSettingsCard } from "@/admin/PoCodeSettingsCard";
import { ScannerSettingsCard } from "@/admin/ScannerSettingsCard";
import { DeliverySettingsCard } from "@/admin/DeliverySettingsCard";
import { CountingSettingsCard } from "@/admin/CountingSettingsCard";
import { ReplenishmentSettingsCard } from "@/admin/ReplenishmentSettingsCard";
import { ShelfGuideSettingsCard } from "@/admin/ShelfGuideSettingsCard";
import { DatabaseSettingsCard } from "@/admin/DatabaseSettingsCard";

export default function Page() {
  // Each admin tab is its own permission; render only the tabs the caller holds. Every
  // underlying route re-checks server-side, so this is display gating, not the security boundary.
  const [permissions, setPermissions] = useState<string[] | null>(null);
  useEffect(() => {
    getSession().then((s) => setPermissions(s?.user?.permissions ?? [])).catch(() => setPermissions([]));
  }, []);
  const has = (perm: string) => (permissions ?? []).includes(perm);
  const canGeneral = has("admin.general_settings");
  const canReplenishment = has("admin.replenishment_settings") || has("admin.location_visibility");

  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  interface RollupHealth {
    lastRefreshedAt: string | null;
    minSaleDate: string | null;
    maxSaleDate: string | null;
    totalRows: number;
    distinctItems: number;
  }
  const [rollupHealth, setRollupHealth] = useState<RollupHealth | null>(null);
  const [rollupHealthLoading, setRollupHealthLoading] = useState(false);
  const [rollupActionRunning, setRollupActionRunning] = useState(false);
  const [rollupMessage, setRollupMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  interface ScheduleStatus {
    installed: boolean;
    lastRunAt: string | null;
    lastRunResult: string | null;
    nextRunAt: string | null;
    trailingWindowDays: number;
    runTime: string;
    configError: string | null;
  }
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [trailingWindowDays, setTrailingWindowDays] = useState(7);
  const [runTime, setRunTime] = useState("00:00");
  const [scheduleInstalling, setScheduleInstalling] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset setup dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadRollupHealth = useCallback(() => {
    setRollupHealthLoading(true);
    fetch("/admin/api/rollup")
      .then((r) => r.json())
      .then((data: { health: RollupHealth }) => setRollupHealth(data.health))
      .finally(() => setRollupHealthLoading(false));
  }, []);

  const loadScheduleStatus = useCallback(() => {
    setScheduleLoading(true);
    fetch("/admin/api/rollup-schedule")
      .then((r) => r.json())
      .then((data: ScheduleStatus) => {
        setScheduleStatus(data);
        setTrailingWindowDays(data.trailingWindowDays);
        setRunTime(data.runTime);
      })
      .finally(() => setScheduleLoading(false));
  }, []);

  async function installRollupSchedule() {
    setScheduleInstalling(true);
    setScheduleMessage(null);
    try {
      const res = await fetch("/admin/api/rollup-schedule/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trailingWindowDays, runTime }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setScheduleMessage({ type: "success", text: "Task scheduled successfully." });
        setTimeout(() => setScheduleMessage(null), 4000);
        loadScheduleStatus();
      } else {
        setScheduleMessage({ type: "error", text: data.error ?? "Installation failed." });
      }
    } catch {
      setScheduleMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setScheduleInstalling(false);
    }
  }

  async function triggerRollupAction(action: "refresh" | "rebuild") {
    setRollupActionRunning(true);
    setRollupMessage(null);
    try {
      const res = await fetch("/admin/api/rollup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json() as { ok?: boolean; rowsAffected?: number; durationMs?: number; error?: string };
      if (res.ok) {
        const label = action === "rebuild" ? "Full rebuild" : "Refresh";
        setRollupMessage({
          type: "success",
          text: `${label} complete — ${data.rowsAffected ?? 0} rows, ${data.durationMs ?? 0} ms.`,
        });
        loadRollupHealth();
      } else {
        setRollupMessage({ type: "error", text: data.error ?? "Action failed." });
      }
    } catch {
      setRollupMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setRollupActionRunning(false);
    }
  }

  // Dirty-registry: settings cards report their dirty state here so the page can guard
  // tab switches and page unloads (a card unmounts on tab switch, discarding edits).
  const dirtyCardsRef = useRef(0);
  const [anyDirtyCard, setAnyDirtyCard] = useState(false);
  const handleCardDirtyChange = useCallback((dirty: boolean) => {
    dirtyCardsRef.current = Math.max(0, dirtyCardsRef.current + (dirty ? 1 : -1));
    setAnyDirtyCard(dirtyCardsRef.current > 0);
  }, []);

  useEffect(() => {
    if (!anyDirtyCard) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirtyCard]);

  const [activeTab, setActiveTab] = useState<string>("");
  const requestTabChange = useCallback(
    (next: string) => {
      if (dirtyCardsRef.current > 0) {
        const ok = window.confirm("You have unsaved changes in this tab. Leave and discard them?");
        if (!ok) return;
      }
      setActiveTab(next);
    },
    [],
  );

  async function refreshItemCache() {
    setCacheRefreshing(true);
    setCacheMessage(null);
    try {
      const res = await fetch("/admin/api/item-cache/refresh", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCacheMessage({ type: "success", text: `Loaded ${data.loadedCount} items into the cache.` });
      } else {
        setCacheMessage({ type: "error", text: data.error ?? "Failed to refresh." });
      }
    } catch {
      setCacheMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setCacheRefreshing(false);
    }
  }

  async function confirmResetSetup() {
    if (!resetPassword) return;
    setResetLoading(true);
    setResetMessage(null);
    try {
      const res = await fetch("/setup/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetMessage({ type: "success", text: "Setup re-armed. You will be redirected on next navigation." });
        setResetPassword("");
        setTimeout(() => {
          setResetDialogOpen(false);
          setResetMessage(null);
        }, 3000);
      } else {
        setResetMessage({ type: "error", text: data.error ?? "Failed to reset setup." });
      }
    } catch {
      setResetMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setResetLoading(false);
    }
  }

  const visibleTabs = [
    canGeneral && "general",
    has("admin.users") && "users",
    has("admin.roles") && "roles",
    has("admin.order_scheduling") && "order-scheduling",
    has("admin.selling_areas") && "order-pooling",
    canReplenishment && "replenishment",
    has("admin.delivery_settings") && "delivery",
    has("admin.counting_settings") && "counting",
    has("admin.shelfguide_settings") && "shelfguide",
    has("admin.sales_rollup") && "rollup",
    has("admin.database_settings") && "database",
  ].filter((v): v is string => typeof v === "string");

  const currentTab = activeTab || visibleTabs[0] || "";

  return (
    <main className="mx-auto max-w-screen-lg space-y-8 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="type-body text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Home
        </Link>
        <h1 className="type-page-title">Admin</h1>
      </div>

      {permissions === null ? (
        <Skeleton className="h-64 w-full" />
      ) : visibleTabs.length === 0 ? (
        <p className="type-body text-muted-foreground">You do not have access to any admin tabs.</p>
      ) : (
      <Tabs value={currentTab} onValueChange={requestTabChange} className="space-y-6">
        <TabsList>
          {canGeneral && <TabsTrigger value="general">General</TabsTrigger>}
          {has("admin.users") && <TabsTrigger value="users">Users</TabsTrigger>}
          {has("admin.roles") && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {has("admin.order_scheduling") && <TabsTrigger value="order-scheduling">Order Scheduling</TabsTrigger>}
          {has("admin.selling_areas") && <TabsTrigger value="order-pooling">Selling Areas</TabsTrigger>}
          {canReplenishment && <TabsTrigger value="replenishment">Replenishment</TabsTrigger>}
          {has("admin.delivery_settings") && <TabsTrigger value="delivery">Delivery</TabsTrigger>}
          {has("admin.counting_settings") && <TabsTrigger value="counting">Counting</TabsTrigger>}
          {has("admin.shelfguide_settings") && <TabsTrigger value="shelfguide">Shelf Guide</TabsTrigger>}
          {has("admin.sales_rollup") && <TabsTrigger value="rollup" onClick={() => { loadRollupHealth(); loadScheduleStatus(); }}>Sales Rollup</TabsTrigger>}
          {has("admin.database_settings") && <TabsTrigger value="database">Database</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-8">
          {canGeneral && (
          <section className="space-y-3">
            <h2 className="type-section-title">Application Settings</h2>
            <CompanyNameCard />
          </section>
          )}

          {canGeneral && (
          <section className="space-y-3">
            <h2 className="type-section-title">PO Code Prefix</h2>
            <PoCodeSettingsCard onDirtyChange={handleCardDirtyChange} />
          </section>
          )}

          {canGeneral && (
          <section className="space-y-3">
            <h2 className="type-section-title">Scanner Settings</h2>
            <ScannerSettingsCard onDirtyChange={handleCardDirtyChange} />
          </section>
          )}

          {canGeneral && (
          <section className="space-y-3">
            <h2 className="type-section-title">Item Masterlist Cache</h2>
            <Card className="space-y-3 p-4">
              <p className="type-caption">
                Re-pull the ActiveOne item masterlist used by the Delivery module to classify scans
                (in masterlist vs. new item) and supply Not-Ordered descriptions, and by the Counting
                module as its scannable item index. Refresh after adding items so Counting can scan them.
              </p>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={refreshItemCache} disabled={cacheRefreshing}>
                  {cacheRefreshing ? "Refreshing…" : "Refresh item cache"}
                </Button>
                {cacheMessage && (
                  <p
                    className={cn(
                      "type-body",
                      cacheMessage.type === "success" ? "text-success" : "text-destructive",
                    )}
                  >
                    {cacheMessage.text}
                  </p>
                )}
              </div>
            </Card>
          </section>
          )}

          {canGeneral && (
          <section className="space-y-3">
            <h2 className="type-section-title">First-Run Setup</h2>
            <Card className="space-y-3 p-4">
              <p className="type-body text-muted-foreground">
                Re-arm the first-time setup wizard. All admins will be redirected into it on their next
                navigation; staff will see a soft wall until setup is finished again. Existing configuration
                (users, locations, settings) is preserved — this only re-opens the wizard.
              </p>
              <div>
                <Button variant="destructive" onClick={() => { setResetPassword(""); setResetMessage(null); setResetDialogOpen(true); }}>
                  Reset setup wizard
                </Button>
              </div>
            </Card>
          </section>
          )}
        </TabsContent>

        {has("admin.users") && (
        <TabsContent value="users" className="space-y-3">
          <h2 className="type-section-title">User Management</h2>
          <p className="type-body text-muted-foreground">
            Create and manage Operations Hub accounts, roles, and ActiveOne employee links.
          </p>
          <UsersTab />
        </TabsContent>
        )}

        {has("admin.roles") && (
        <TabsContent value="roles" className="space-y-3">
          <h2 className="type-section-title">Roles &amp; Permissions</h2>
          <p className="type-body text-muted-foreground">
            Create roles, toggle their permissions, and manage members. A user&apos;s access is the union of their active roles.
          </p>
          <RolesTab />
        </TabsContent>
        )}

        {has("admin.selling_areas") && (
        <TabsContent value="order-pooling" className="space-y-3">
          <h2 className="type-section-title">Selling Areas</h2>
          <p className="type-body text-muted-foreground">
            Designate a location as a selling area fed by a warehouse. The warehouse&apos;s Standard replenishment run will pool the selling area&apos;s off-take into its own demand — without trusting the selling area&apos;s physical count.
          </p>
          <OrderPoolingTab />
        </TabsContent>
        )}

        {canReplenishment && (
        <TabsContent value="replenishment" className="space-y-8">
          <section className="space-y-3">
            <h2 className="type-section-title">Replenishment Settings</h2>
            <p className="type-body text-muted-foreground">
              Global policies for the Replenishment run tool.
            </p>
            <ReplenishmentSettingsCard onDirtyChange={handleCardDirtyChange} />
          </section>

          {has("admin.location_visibility") && (
          <section className="space-y-3">
            <h2 className="type-section-title">Location Visibility</h2>
            <p className="type-body text-muted-foreground">
              Control which locations are visible on the location selection screen for each module.
            </p>
            <LocationVisibilityManager />
          </section>
          )}
        </TabsContent>
        )}

        {has("admin.delivery_settings") && (
        <TabsContent value="delivery" className="space-y-6">
          <section className="space-y-3">
            <h2 className="type-section-title">Delivery Settings</h2>
            <p className="type-body text-muted-foreground">
              Global policies for the Delivery receiving tool. Changes apply to the next receiving session; in-progress sessions keep the mode they began with.
            </p>
            <DeliverySettingsCard onDirtyChange={handleCardDirtyChange} />
          </section>
        </TabsContent>
        )}

        {has("admin.counting_settings") && (
        <TabsContent value="counting" className="space-y-6">
          <section className="space-y-3">
            <h2 className="type-section-title">Counting Settings</h2>
            <p className="type-body text-muted-foreground">
              Global policies for the Inventory Counting tool. Changes apply to the next count; in-progress counts keep the mode they began with.
            </p>
            <CountingSettingsCard onDirtyChange={handleCardDirtyChange} />
          </section>
        </TabsContent>
        )}

        {has("admin.shelfguide_settings") && (
        <TabsContent value="shelfguide" className="space-y-6">
          <section className="space-y-3">
            <h2 className="type-section-title">Shelf Guide Settings</h2>
            <p className="type-body text-muted-foreground">
              Defaults for the Shelf Guide — a read-only tool showing how fast each supplier&apos;s items sell to guide shelf allocation.
            </p>
            <ShelfGuideSettingsCard onDirtyChange={handleCardDirtyChange} />
          </section>
        </TabsContent>
        )}

        {has("admin.order_scheduling") && (
        <TabsContent value="order-scheduling" className="space-y-3">
          <h2 className="type-section-title">Order Scheduling</h2>
          <p className="type-body text-muted-foreground">
            Drag suppliers between columns to set how often they are ordered. Changes save immediately.
          </p>
          <OrderSchedulingKanban />
        </TabsContent>
        )}

        {has("admin.sales_rollup") && (
        <TabsContent value="rollup" className="space-y-6">
          <section className="space-y-3">
            <h2 className="type-section-title">Sales Off-take Rollup</h2>
            <p className="type-body text-muted-foreground">
              Pre-aggregated daily sales data powering replenishment. Nightly refresh covers
              the configured trailing window for all locations. Full rebuild reprocesses the last 13 months.
            </p>

            <Card className="space-y-4 p-4">
              <h3 className="type-label text-muted-foreground uppercase tracking-wide">Rollup Health</h3>

              {rollupHealthLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-5 w-40" />
                </div>
              ) : rollupHealth === null ? (
                <p className="type-body text-muted-foreground">
                  Click &ldquo;Sales Rollup&rdquo; tab to load health metrics.
                </p>
              ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Last refreshed</dt>
                  <dd className="text-foreground">
                    {rollupHealth.lastRefreshedAt
                      ? new Date(rollupHealth.lastRefreshedAt).toLocaleString()
                      : "Never"}
                  </dd>
                  <dt className="text-muted-foreground">Date coverage</dt>
                  <dd className="text-foreground">
                    {rollupHealth.minSaleDate && rollupHealth.maxSaleDate
                      ? `${rollupHealth.minSaleDate} → ${rollupHealth.maxSaleDate}`
                      : "No data"}
                  </dd>
                  <dt className="text-muted-foreground">Total rows</dt>
                  <dd className="text-foreground">{rollupHealth.totalRows.toLocaleString()}</dd>
                  <dt className="text-muted-foreground">Distinct items</dt>
                  <dd className="text-foreground">{rollupHealth.distinctItems.toLocaleString()}</dd>
                </dl>
              )}
            </Card>

            <Card className="space-y-4 p-4">
              <h3 className="type-label text-muted-foreground uppercase tracking-wide">Actions</h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => triggerRollupAction("refresh")}
                  disabled={rollupActionRunning}
                >
                  {rollupActionRunning ? "Running…" : "Refresh trailing window"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => triggerRollupAction("rebuild")}
                  disabled={rollupActionRunning}
                >
                  {rollupActionRunning ? "Running…" : "Full rebuild (13 months)"}
                </Button>
              </div>
              <p className="type-caption text-muted-foreground">
                Refresh: recomputes the configured trailing window for all locations (absorbs recent voids/returns).
                Full rebuild: reprocesses all 13 months — may take several minutes on large datasets.
              </p>
              {rollupMessage && (
                <p
                  className={cn(
                    "type-body",
                    rollupMessage.type === "success" ? "text-success" : "text-destructive",
                  )}
                >
                  {rollupMessage.text}
                </p>
              )}
            </Card>

            <Card className="space-y-4 p-4">
              <h3 className="type-label text-muted-foreground uppercase tracking-wide">Task Scheduler</h3>

              {scheduleLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-64" />
                </div>
              ) : scheduleStatus === null ? (
                <p className="type-body text-muted-foreground">
                  Click &ldquo;Sales Rollup&rdquo; tab to load scheduler status.
                </p>
              ) : (
                <div className="space-y-4">
                  {scheduleStatus.configError && (
                    <div className="rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
                      {scheduleStatus.configError}
                    </div>
                  )}

                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          scheduleStatus.installed
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {scheduleStatus.installed ? "Installed" : "Not Installed"}
                      </span>
                    </dd>
                    {scheduleStatus.installed && (
                      <>
                        <dt className="text-muted-foreground">Last run</dt>
                        <dd className="text-foreground">
                          {scheduleStatus.lastRunAt
                            ? new Date(scheduleStatus.lastRunAt).toLocaleString()
                            : "Never"}
                          {scheduleStatus.lastRunResult !== null && (
                            <span className="ml-2 text-muted-foreground">
                              (result: {scheduleStatus.lastRunResult})
                            </span>
                          )}
                        </dd>
                        <dt className="text-muted-foreground">Next run</dt>
                        <dd className="text-foreground">
                          {scheduleStatus.nextRunAt
                            ? new Date(scheduleStatus.nextRunAt).toLocaleString()
                            : "N/A"}
                        </dd>
                      </>
                    )}
                  </dl>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="trailing-window-days">Trailing window (days)</Label>
                      <Input
                        id="trailing-window-days"
                        type="number"
                        min={1}
                        max={30}
                        value={trailingWindowDays}
                        onChange={(e) => setTrailingWindowDays(Number(e.target.value))}
                        className="w-24"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="rollup-run-time">Nightly run time</Label>
                      <Input
                        id="rollup-run-time"
                        type="time"
                        value={runTime}
                        onChange={(e) => setRunTime(e.target.value)}
                        className="w-36"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        onClick={installRollupSchedule}
                        disabled={
                          !!scheduleStatus.configError ||
                          scheduleInstalling ||
                          !Number.isInteger(trailingWindowDays) ||
                          trailingWindowDays < 1 ||
                          trailingWindowDays > 30
                        }
                      >
                        {scheduleInstalling
                          ? scheduleStatus.installed
                            ? "Reinstalling…"
                            : "Installing…"
                          : scheduleStatus.installed
                            ? "Reinstall"
                            : "Install"}
                      </Button>
                      {scheduleMessage && (
                        <p
                          className={cn(
                            "type-body",
                            scheduleMessage.type === "success"
                              ? "text-success"
                              : "text-destructive",
                          )}
                        >
                          {scheduleMessage.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </section>
        </TabsContent>
        )}

        {has("admin.database_settings") && (
        <TabsContent value="database" className="space-y-6">
          <section className="space-y-3">
            <h2 className="type-section-title">Database Connection</h2>
            <DatabaseSettingsCard />
          </section>
        </TabsContent>
        )}
      </Tabs>
      )}

      {/* Reset setup dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) { setResetPassword(""); setResetMessage(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset setup wizard</DialogTitle>
            <DialogDescription>
              This will re-arm the first-time setup wizard for all admins. Staff will see a soft
              wall until an admin finishes the wizard again. Existing configuration is preserved —
              no data is deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reset-password">Your password</Label>
            <PasswordInput
              id="reset-password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && resetPassword) confirmResetSetup(); }}
              autoComplete="current-password"
            />
          </div>

          {resetMessage && (
            <p
              className={cn(
                "type-body",
                resetMessage.type === "success" ? "text-success" : "text-destructive",
              )}
            >
              {resetMessage.text}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={resetLoading}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={confirmResetSetup}
              disabled={!resetPassword || resetLoading}
            >
              {resetLoading ? "Resetting…" : "Reset setup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
