import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customer Enquiry Tracker | Intevoris AI",
  description: "Customer enquiry capture, automated categorization, and business tracking dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="min-h-full flex flex-col text-slate-800 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
