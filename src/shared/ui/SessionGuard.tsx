"use client";

import { useEffect } from "react";
import { getSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function SessionGuard() {
  const router = useRouter();

  // Enforce "remember me = false" sessions: sign out if browser was closed and reopened.
  // Auth.js's rolling window makes the session-token cookie persistent, so we track
  // whether this browser session originated from a login via sessionStorage. If the
  // marker is missing (browser was closed), we treat the session as expired.
  useEffect(() => {
    async function checkRememberMe() {
      const session = await getSession();
      if (!session) return;
      if (session.user.rememberMe === false && !sessionStorage.getItem("sessionAlive")) {
        signOut({ callbackUrl: "/login" });
      }
    }
    checkRememberMe();
  }, []);

  // Re-check the session when the tab regains focus or the page is shown.
  // The `pageshow` handler also covers back/forward-cache restores: clicking
  // "back" after sign-out resurrects a frozen snapshot of an authenticated
  // page without any server round-trip (middleware never runs, effects don't
  // re-fire), so we must re-validate here and redirect to login if expired.
  useEffect(() => {
    async function revalidate() {
      const session = await getSession();
      if (!session) {
        router.push("/login");
      }
    }
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) revalidate();
    }
    window.addEventListener("focus", revalidate);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  // Listen for cross-tab sign-out broadcasts and redirect immediately.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("auth");
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "SIGN_OUT") {
        router.push("/login");
      }
    }
    channel.addEventListener("message", handleMessage);
    return () => channel.close();
  }, [router]);

  return null;
}
