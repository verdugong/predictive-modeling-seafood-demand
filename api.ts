import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Panel de Inventario de Mariscos",
  description: "Dashboard operativo para consultar predicciones de inventario.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} bg-slate-950 text-slate-50 antialiased`}>
        {children}
      </body>
    </html>
  );
}
