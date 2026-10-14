"use client";

import { useRouter } from "next/navigation";
import { DbConnectionForm } from "@/shared/ui/DbConnectionForm";

/** First-run connection form. On success the DB is live, so send the operator to log in. */
export function ConnectForm() {
  const router = useRouter();
  return (
    <DbConnectionForm
      testUrl="/connect/api/test"
      saveUrl="/connect/api/save"
      saveMethod="POST"
      saveLabel="Save & Connect"
      passwordRequired
      onSaved={() => router.replace("/login")}
    />
  );
}
