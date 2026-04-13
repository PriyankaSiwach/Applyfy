"use client";

import { useClerk, useSession } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/** 2 hours — session ends at the earlier of (login + 2h) or (last activity + 2h). */
const SESSION_MS = 2 * 60 * 60 * 1000;

function sessionCreatedMs(session: { createdAt?: Date | number | string | null }): number {
  const c = session.createdAt;
  if (c == null) return Date.now();
  const t = c instanceof Date ? c.getTime() : new Date(c).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

export function SessionTimeoutGuard() {
  const { isLoaded, isSignedIn, session } = useSession();
  const { signOut } = useClerk();
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("keydown", bump, opts);
    window.addEventListener("scroll", bump, opts);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("scroll", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !session) return;

    lastActivityRef.current = Date.now();

    const redirectUrl =
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL?.trim() || "/";

    const check = () => {
      const loginAt = sessionCreatedMs(session);
      const maxByLogin = loginAt + SESSION_MS;
      const maxByIdle = lastActivityRef.current + SESSION_MS;
      const now = Date.now();
      if (now >= maxByLogin || now >= maxByIdle) {
        void signOut({ redirectUrl });
      }
    };

    check();
    const id = window.setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isLoaded, isSignedIn, session, signOut]);

  return null;
}
