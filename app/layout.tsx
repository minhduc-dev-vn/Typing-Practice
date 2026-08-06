import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthBootstrap } from "@/components/AuthBootstrap";

import "./globals.css";

export const metadata: Metadata = {
  title: "Keysteady — Typing Practice",
  description: "Focused English and Vietnamese typing practice, right in your browser."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthBootstrap>{children}</AuthBootstrap>
      </body>
    </html>
  );
}
