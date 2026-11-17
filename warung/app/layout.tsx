import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WarungKita | Stok & Inventaris",
  description: "Catat stok warung, pantau barang menipis, dan kelola inventaris dengan mudah.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
