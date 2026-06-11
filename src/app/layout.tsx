import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashvora | AI-Powered Dashboard Generation SaaS Platform",
  description: "Dashvora is an enterprise-grade AI-native Business Intelligence platform. Upload datasets, connect databases securely, and chat with a schema-aware AI to automatically compile and filter interactive dashboard grids.",
  keywords: ["AI BI Tool", "SaaS Dashboard Generation", "SQL Query Writer", "No-Code Analytics", "Interactive Charts", "Excel Parser"],
  authors: [{ name: "Dashvora Development Team" }]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#09090b] text-[#f4f4f5] font-sans">
        {children}
      </body>
    </html>
  );
}
