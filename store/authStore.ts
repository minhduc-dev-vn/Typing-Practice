import type { User } from "@supabase/supabase-js";
import { create } from "zustand";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface SignUpResult {
  confirmationRequired: boolean;
}

interface AuthState {
  user: User | null;
  status: AuthStatus;
  isConfigured: boolean;
  isSubmitting: boolean;
  error: string | null;
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function authNotConfiguredMessage(): string {
  return "Supabase Auth chưa được cấu hình. Guest mode vẫn hoạt động bình thường.";
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  isConfigured: true,
  isSubmitting: false,
  error: null,

  initialize: () => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      set({ user: null, status: "anonymous", isConfigured: false });
      return () => undefined;
    }

    let active = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }
      if (error) {
        set({ error: error.message, status: "anonymous", user: null });
        return;
      }
      const user = data.session?.user ?? null;
      set({ user, status: user ? "authenticated" : "anonymous", isConfigured: true });
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }
      const user = session?.user ?? null;
      set({ user, status: user ? "authenticated" : "anonymous", error: null });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  },

  signIn: async (email, password) => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      set({ error: authNotConfiguredMessage() });
      return;
    }

    set({ isSubmitting: true, error: null });
    const { error } = await client.auth.signInWithPassword({ email, password });
    set({ isSubmitting: false, ...(error ? { error: error.message } : {}) });
    if (error) {
      throw error;
    }
  },

  signUp: async (email, password) => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      const message = authNotConfiguredMessage();
      set({ error: message });
      throw new Error(message);
    }

    set({ isSubmitting: true, error: null });
    const { data, error } = await client.auth.signUp({ email, password });
    set({ isSubmitting: false, ...(error ? { error: error.message } : {}) });
    if (error) {
      throw error;
    }
    return { confirmationRequired: data.session === null };
  },

  signOut: async () => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      return;
    }
    set({ isSubmitting: true, error: null });
    const { error } = await client.auth.signOut();
    set({ isSubmitting: false, ...(error ? { error: error.message } : {}) });
    if (error) {
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
