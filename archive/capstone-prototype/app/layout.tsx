import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerUp Frontend Prototype",
  description: "A focused CareerUp capstone frontend prototype"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
