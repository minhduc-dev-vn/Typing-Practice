"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { requestDailySuggestion } from "@/lib/personalization/client";
import type { DailySuggestion } from "@/lib/personalization/types";
import { useAuthStore } from "@/store/authStore";

interface DailyPracticeBannerProps {
  onUseTopic: (topic: string) => void;
}

export function DailyPracticeBanner({ onUseTopic }: DailyPracticeBannerProps) {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const [loaded, setLoaded] = useState<{ userId: string; suggestion: DailySuggestion } | null>(null);

  useEffect(() => {
    let active = true;
    if (status !== "authenticated" || !user) {
      return () => { active = false; };
    }

    void requestDailySuggestion(user.id)
      .then((result) => {
        if (active) {
          setLoaded({ userId: user.id, suggestion: result });
        }
      })
      .catch(() => {
        // Personalization is optional; leave the normal practice UI untouched.
      });

    return () => { active = false; };
  }, [status, user]);

  if (status !== "authenticated" || !user || loaded?.userId !== user.id) {
    return null;
  }
  const { suggestion } = loaded;

  return (
    <motion.aside
      className="daily-practice-banner"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label="Daily personalized practice suggestion"
    >
      <div>
        <span className="daily-badge">Daily focus</span>
        <p>
          {suggestion.reason === "familiar" && suggestion.sourceTopic ? (
            <>Bạn đã luyện chủ đề <strong>{suggestion.sourceTopic}</strong> nhiều lần. Hôm nay hãy thử <strong>{suggestion.relatedTopic}</strong>.</>
          ) : (
            <>Gợi ý hôm nay: hãy thử chủ đề <strong>{suggestion.relatedTopic}</strong>.</>
          )}
        </p>
      </div>
      <button type="button" onClick={() => onUseTopic(suggestion.relatedTopic)}>
        Dùng chủ đề này
      </button>
    </motion.aside>
  );
}
