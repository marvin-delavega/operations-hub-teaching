"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { PasswordInput } from "@/shared/ui/PasswordInput";
import { MIN_PASSWORD_LENGTH } from "@/shared/domain/Password";
import { cn } from "@/shared/ui/utils";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Self-service password change, available to any authenticated user from the
 *  account menu. The session stays active on success (only the hash updates). */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCurrentPassword("");
      setNewPassword("");
      setMessage(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    setMessage(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage({ type: "error", text: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/account/api/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "success", text: "Password changed." });
        setCurrentPassword("");
        setNewPassword("");
        setTimeout(() => handleOpenChange(false), 1200);
      } else {
        setMessage({ type: "error", text: data.error ?? "Failed to change password." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one. Your session stays active.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="change-current-password">Current password</Label>
            <PasswordInput
              id="change-current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="change-new-password">New password</Label>
            <PasswordInput
              id="change-new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {message && (
            <p className={cn("type-body", message.type === "success" ? "text-success" : "text-destructive")}>
              {message.text}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={submit} disabled={submitting || !currentPassword || !newPassword}>
            {submitting ? "Saving…" : "Change password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
