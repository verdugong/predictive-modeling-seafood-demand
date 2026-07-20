import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Planificación de demanda de mariscos",
  description: "Anticipa las ventas de los próximos días y organiza el inventario de cada sucursal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${sora.variable} font-sans text-brand-text antialiased`}>
        {children}
      </body>
    </html>
  );
}
