import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Maze Session Booking",
  description: "Book your Career Maze session",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
