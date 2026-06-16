import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miru Mushrooms — Operations Dashboard",
  description: "Daily revenue, expense, and float tracking for Miru Mushrooms.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
