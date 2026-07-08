import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mis comandos · Azure Commands" };

export default function MisComandosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
