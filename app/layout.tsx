import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DCA Window Watch",
  description: "Live aircraft identification for the slice of sky outside your window.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
