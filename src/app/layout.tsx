import type { Metadata } from "next";
import "./globals.css";
import { IdleSignout } from "./IdleSignout";

export const metadata: Metadata = {
  title: "EarnedHome Pathfinder — Get Payments",
  description:
    "See affordable payment scenarios, cash-to-close, and your path to mortgage-ready.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
      </head>
      <body>
        <IdleSignout />
        {children}
      </body>
    </html>
  );
}
