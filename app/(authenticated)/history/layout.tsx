import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ops Hub · History" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
