"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Check, X } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Card } from "@/shared/ui/card";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";
import { useRememberedUsers, type RememberedUser } from "@/login/useRememberedUsers";

// -------------------------------------------------------------------
// Feature carousel — one slide per module, no "Coming Soon" labels
// -------------------------------------------------------------------

const CAROUSEL_SLIDES = [
  {
    module: "Delivery",
    description:
      "Receive goods against purchase orders — scan items in real time and record exactly what arrived.",
  },
  {
    module: "Replenishment",
    description:
      "Generate supplier POs from live sales rates, stock levels, and custom order schedules — in seconds.",
  },
  {
    module: "Inventory Counting",
    description:
      "Run physical stock counts and reconcile discrepancies directly against your ERP records.",
  },
  {
    module: "Invoicing",
    description:
      "Review and process customer invoices with full visibility into outstanding and completed transactions.",
  },
  {
    module: "Stock Transfers",
    description:
      "Track and record inter-location inventory movements with barcode-verified accuracy.",
  },
  {
    module: "History",
    description:
      "Audit every delivery, count, transfer, and order with a complete, searchable operations log.",
  },
  {
    module: "Admin",
    description:
      "Manage users, locations, supplier schedules, and system-wide settings from a single control panel.",
  },
  {
    module: "Location",
    description:
      "Scope any operation to the right warehouse area — navigate and manage your location hierarchy with ease.",
  },
  {
    module: "Supplier",
    description:
      "View supplier schedules, due-order status, and contact details to keep replenishment on track.",
  },
] as const;

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type WidgetState = "picker" | "password" | "manual";

const PANEL_TRANSFORM: Record<WidgetState, string> = {
  picker: "translateX(0%)",
  password: "translateX(-33.333%)",
  manual: "translateX(-66.667%)",
};

// -------------------------------------------------------------------
// Page component
// -------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const { users, hydrated, remember, forget } = useRememberedUsers();

  // Widget state — null until hydrated to prevent animated initial repositioning
  const [widgetState, setWidgetState] = useState<WidgetState>("picker");
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RememberedUser | null>(null);

  // Form fields
  const [password, setPassword] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Submission
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company name
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Carousel
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Picker UI state
  const [editMode, setEditMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RememberedUser | null>(null);

  // Focus refs for inputs revealed by state transitions
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------
  // Initialization — set correct panel after localStorage is read, then
  // enable CSS transitions so subsequent navigations animate smoothly.
  // -------------------------------------------------------------------

  useEffect(() => {
    if (!hydrated) return;

    const initialState: WidgetState = users.length > 0 ? "picker" : "manual";
    setWidgetState(initialState);

    // Wait two animation frames: first for the state-update render to commit
    // (correct translateX applied without transition), then enable transitions.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransitionsEnabled(true));
    });
    // users.length intentionally excluded — we only want to initialize once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // -------------------------------------------------------------------
  // Company name fetch (pre-auth public endpoint)
  // -------------------------------------------------------------------

  useEffect(() => {
    fetch("/login/api")
      .then((r) => r.json())
      .then((data: { companyName: string | null; dbConfigured?: boolean }) => {
        // First run: no DB connection yet — send the operator to the bootstrap page.
        if (data.dbConfigured === false) {
          router.replace("/connect");
          return;
        }
        setCompanyName(data.companyName);
      })
      .catch(() => {});
  }, [router]);

  // -------------------------------------------------------------------
  // Carousel auto-advance
  // -------------------------------------------------------------------

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    function startTimer() {
      carouselTimerRef.current = setInterval(() => {
        setCarouselIndex((i) => (i + 1) % CAROUSEL_SLIDES.length);
      }, 5000);
    }

    startTimer();
    return () => {
      if (carouselTimerRef.current) clearInterval(carouselTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------

  const duplicatedNames = new Set(
    users
      .map((u) => u.displayName)
      .filter((name, i, arr) => arr.indexOf(name) !== i)
  );

  function visibleName(user: RememberedUser): string {
    return duplicatedNames.has(user.displayName)
      ? `${user.displayName} (${user.username})`
      : user.displayName;
  }

  const displayedCompanyName = companyName ?? "Operations Hub";

  // -------------------------------------------------------------------
  // Widget navigation
  // -------------------------------------------------------------------

  function goToPasswordStep(user: RememberedUser) {
    setSelectedUser(user);
    setPassword("");
    setError(null);
    setEditMode(false);
    setWidgetState("password");
    setTimeout(() => passwordInputRef.current?.focus(), 320);
  }

  function goToManualEntry() {
    setManualUsername("");
    setPassword("");
    setError(null);
    setEditMode(false);
    setWidgetState("manual");
    setTimeout(() => usernameInputRef.current?.focus(), 320);
  }

  function goBackToPicker() {
    setError(null);
    setPassword("");
    setWidgetState("picker");
  }

  // -------------------------------------------------------------------
  // Authentication submit
  // -------------------------------------------------------------------

  async function submitCredentials(usernameToSubmit: string) {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      username: usernameToSubmit,
      password,
      rememberMe: String(rememberMe),
      redirect: false,
    });

    setLoading(false);

    // next-auth v5 signals a failed credential check via `error`
    // (it can resolve with ok: true), so check both.
    if (result?.error || !result?.ok) {
      setError("Invalid username or password.");
      return;
    }

    if (!rememberMe) {
      sessionStorage.setItem("sessionAlive", "true");
    }

    if (rememberMe) {
      const session = await getSession();
      const displayName = session?.user?.name ?? usernameToSubmit;
      remember(usernameToSubmit, displayName);
    }

    router.push("/");
  }

  async function handlePasswordStepSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedUser) await submitCredentials(selectedUser.username);
  }

  async function handleManualEntrySubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitCredentials(manualUsername);
  }

  // -------------------------------------------------------------------
  // Delete flow
  // -------------------------------------------------------------------

  function startDelete(user: RememberedUser) {
    setDeleteTarget(user);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    forget(deleteTarget.username);
    setDeleteTarget(null);
    // If the list is about to become empty, go to manual entry
    if (users.length <= 1) {
      setEditMode(false);
      setWidgetState("manual");
    }
  }

  function cancelDelete() {
    setDeleteTarget(null);
  }

  // -------------------------------------------------------------------
  // Carousel navigation
  // -------------------------------------------------------------------

  function goToSlide(index: number) {
    setCarouselIndex(index);
    if (carouselTimerRef.current) {
      clearInterval(carouselTimerRef.current);
      carouselTimerRef.current = setInterval(() => {
        setCarouselIndex((i) => (i + 1) % CAROUSEL_SLIDES.length);
      }, 5000);
    }
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <main className="relative min-h-screen overflow-hidden">

      {/* ── Animated gradient background ── */}
      <div className="absolute inset-0 -z-10 bg-background">
        <div
          className="absolute -top-1/3 -left-1/4 w-3/4 h-3/4 rounded-full bg-primary/10 blur-3xl"
          style={{ animation: "blob-drift 20s ease-in-out infinite" }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/4 w-2/3 h-2/3 rounded-full bg-primary/10 blur-3xl"
          style={{ animation: "blob-drift-alt 24s ease-in-out infinite" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 rounded-full bg-muted/50 blur-2xl"
          style={{ animation: "blob-drift 30s ease-in-out infinite reverse" }}
        />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-2">

        {/* ── Left: brand story + feature carousel (desktop only) ── */}
        <section className="hidden lg:flex flex-col justify-center gap-8 p-12 xl:p-16 border-r border-border/60">
          <div className="flex items-center gap-3">
            <Logo className="w-12 h-12 text-primary dark:text-white" />
            <div className="space-y-0.5">
              <p className="type-caption">{displayedCompanyName}</p>
              <p className="type-section-title">Operations Hub</p>
            </div>
          </div>

          <div className="max-w-md space-y-3">
            <h1 className="type-page-title">Welcome back.</h1>
            <p className="type-body text-muted-foreground">
              Your all-in-one warehouse companion — smarter receiving, restocking,
              and end-to-end visibility across every operation.
            </p>
          </div>

          <FeatureCarousel index={carouselIndex} onSelect={goToSlide} align="left" />
        </section>

        {/* ── Right: credential widget ── */}
        <section className="flex flex-col items-center justify-center gap-8 p-6">

          {/* Compact brand identity (mobile only) */}
          <div className="lg:hidden flex flex-col items-center gap-3 text-center">
            <Logo className="w-16 h-16 text-primary dark:text-white" />
            <div className="space-y-0.5">
              <p className="type-caption">{displayedCompanyName}</p>
              <h1 className="type-page-title">Operations Hub</h1>
            </div>
          </div>

      {/* ── Login widget ── */}
      <Card className="relative z-10 w-full max-w-sm overflow-hidden shadow-sm">
        {/* Three-panel slider — only rendered once hydrated */}
        {hydrated ? (
          <div
            className={cn("flex", transitionsEnabled && "transition-transform duration-300 ease-in-out")}
            style={{ width: "300%", transform: PANEL_TRANSFORM[widgetState] }}
          >

            {/* Panel 1 — Picker */}
            <div className="w-1/3 p-6 space-y-4" aria-hidden={widgetState !== "picker"}>
              <div className="flex items-center justify-between">
                <h2 className="type-section-title">Sign in</h2>
                <button
                  type="button"
                  aria-label={editMode ? "Done editing" : "Edit saved accounts"}
                  onClick={() => setEditMode((v) => !v)}
                  className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-muted motion-safe:active:scale-95 transition-colors"
                >
                  {editMode ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </button>
              </div>

              {/* Remembered user cards — scrollable at ~5 visible */}
              <div className="overflow-y-auto max-h-[280px] space-y-2 -mx-1 px-1">
                {users.map((user) =>
                  editMode ? (
                    /* Edit mode — tapping the row does nothing; X button deletes */
                    <div
                      key={user.username}
                      className="flex items-center gap-3 px-4 py-2 min-h-[56px] rounded-md border border-border bg-card"
                    >
                      <UserAvatar initial={user.displayName.charAt(0)} />
                      <p className="type-body font-medium flex-1 min-w-0 truncate">
                        {visibleName(user)}
                      </p>
                      <button
                        type="button"
                        aria-label={`Remove ${user.displayName} from this device`}
                        onClick={() => startDelete(user)}
                        className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground motion-safe:active:scale-90 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* Normal mode — tap selects the user */
                    <button
                      key={user.username}
                      type="button"
                      aria-label={`Sign in as ${visibleName(user)}`}
                      onClick={() => goToPasswordStep(user)}
                      className="w-full flex items-center gap-3 px-4 py-2 min-h-[56px] rounded-md border border-border bg-card text-left hover:bg-muted motion-safe:active:scale-[0.98] transition-colors"
                    >
                      <UserAvatar initial={user.displayName.charAt(0)} />
                      <p className="type-body font-medium flex-1 min-w-0 truncate">
                        {visibleName(user)}
                      </p>
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={goToManualEntry}
                className="w-full min-h-[48px] flex items-center justify-center type-body text-primary hover:underline motion-safe:active:scale-95 transition-transform"
              >
                Sign in as a different account
              </button>
            </div>

            {/* Panel 2 — Password step */}
            <div className="w-1/3 p-6" aria-hidden={widgetState !== "password"}>
              <form onSubmit={handlePasswordStepSubmit} className="space-y-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Back to account picker"
                    onClick={goBackToPicker}
                    tabIndex={widgetState === "password" ? 0 : -1}
                    className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-muted motion-safe:active:scale-95 transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar initial={selectedUser?.displayName.charAt(0) ?? "?"} />
                    <p className="type-body font-medium truncate">
                      {selectedUser ? visibleName(selectedUser) : ""}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="pw-password">Password</Label>
                  <Input
                    ref={passwordInputRef}
                    id="pw-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    tabIndex={widgetState === "password" ? 0 : -1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pw-remember"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    tabIndex={widgetState === "password" ? 0 : -1}
                  />
                  <Label htmlFor="pw-remember" className="cursor-pointer font-normal">
                    Remember me
                  </Label>
                </div>

                {error && widgetState === "password" && (
                  <p className="type-body text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                  tabIndex={widgetState === "password" ? 0 : -1}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </div>

            {/* Panel 3 — Manual entry */}
            <div className="w-1/3 p-6" aria-hidden={widgetState !== "manual"}>
              <form onSubmit={handleManualEntrySubmit} className="space-y-5">
                <div className="flex items-center gap-3">
                  {users.length > 0 && (
                    <button
                      type="button"
                      aria-label="Back to account picker"
                      onClick={goBackToPicker}
                      tabIndex={widgetState === "manual" ? 0 : -1}
                      className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-muted motion-safe:active:scale-95 transition-colors shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <h2 className="type-section-title">Sign in</h2>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="me-username">Username</Label>
                  <Input
                    ref={usernameInputRef}
                    id="me-username"
                    type="text"
                    autoComplete="username"
                    required
                    tabIndex={widgetState === "manual" ? 0 : -1}
                    value={manualUsername}
                    onChange={(e) => setManualUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="me-password">Password</Label>
                  <Input
                    id="me-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    tabIndex={widgetState === "manual" ? 0 : -1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="me-remember"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    tabIndex={widgetState === "manual" ? 0 : -1}
                  />
                  <Label htmlFor="me-remember" className="cursor-pointer font-normal">
                    Remember me
                  </Label>
                </div>

                {error && widgetState === "manual" && (
                  <p className="type-body text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                  tabIndex={widgetState === "manual" ? 0 : -1}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          /* Skeleton shown during the sub-100ms before localStorage is read */
          <div className="p-6 space-y-4">
            <div className="h-5 w-20 rounded bg-muted animate-pulse" />
            <div className="h-14 rounded-md bg-muted animate-pulse" />
            <div className="h-10 rounded-md bg-primary/20 animate-pulse" />
          </div>
        )}
      </Card>

          {/* ── Feature carousel (mobile only) ── */}
          <div className="lg:hidden w-full max-w-sm">
            <FeatureCarousel index={carouselIndex} onSelect={goToSlide} align="center" />
          </div>
        </section>
      </div>

      {/* ── Delete confirmation overlay ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4"
          onClick={cancelDelete}
        >
          <div
            className="bg-card rounded-lg border border-border p-6 w-full max-w-xs space-y-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <p className="type-body font-medium">
                Remove {deleteTarget.displayName}?
              </p>
              <p className="type-caption">
                This clears the saved entry on this device only — it does not affect the account.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={cancelDelete}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={confirmDelete}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// -------------------------------------------------------------------
// Shared sub-component used in multiple panels
// -------------------------------------------------------------------

function UserAvatar({ initial }: { initial: string }) {
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
      <span className="type-label font-semibold">{initial.toUpperCase()}</span>
    </div>
  );
}

// -------------------------------------------------------------------
// Feature carousel — shared between the desktop left panel (left-aligned)
// and the mobile stack (centered). Cross-fades; reduced-motion handled by
// the global CSS guard collapsing the transition duration.
// -------------------------------------------------------------------

function FeatureCarousel({
  index,
  onSelect,
  align,
}: {
  index: number;
  onSelect: (i: number) => void;
  align: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <div className={cn("w-full", centered && "max-w-sm")}>
      <div className="relative h-16 overflow-hidden">
        {CAROUSEL_SLIDES.map((slide, i) => (
          <div
            key={slide.module}
            className={cn(
              "absolute inset-0 flex flex-col justify-center transition-opacity duration-700",
              centered ? "items-center text-center px-4" : "items-start text-left"
            )}
            style={{
              opacity: i === index ? 1 : 0,
              pointerEvents: i === index ? "auto" : "none",
            }}
          >
            <p className="type-label text-primary">{slide.module}</p>
            <p className="type-caption line-clamp-2">{slide.description}</p>
          </div>
        ))}
      </div>

      {/* Dot / pill indicators */}
      <div
        className={cn(
          "flex items-center gap-1.5 mt-3",
          centered ? "justify-center" : "justify-start"
        )}
      >
        {CAROUSEL_SLIDES.map((slide, i) => (
          <button
            key={slide.module}
            type="button"
            aria-label={`View ${slide.module} feature`}
            onClick={() => onSelect(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === index
                ? "w-4 h-1.5 bg-primary"
                : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
            )}
          />
        ))}
      </div>
    </div>
  );
}
