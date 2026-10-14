import type { Metadata } from "next";

export const metadata: Metadata = { title: "Select Manufacturers" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
