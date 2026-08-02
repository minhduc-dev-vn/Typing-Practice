"use client";

import { useEffect, type ReactNode } from "react";

import { useAuthStore } from "@/store/authStore";

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => initialize(), [initialize]);

  return children;
}
