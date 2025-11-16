import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A3: Multi-agent Interaction",
  description: "Conversational demo with multi-agent system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
