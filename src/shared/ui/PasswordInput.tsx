"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/ui/utils";

/** Password Input with a show/hide toggle. State is local to the field.
 *
 *  Every use is an account/admin management flow (change/reset/create), never
 *  login — so we actively suppress Chrome's password-manager autofill. Chrome
 *  ignores `autocomplete="off"` on password fields, so we start the field
 *  readonly and lift it on first interaction: prefill happens before focus, so
 *  this blocks it while leaving manual typing untouched. */
export function PasswordInput({ className, onFocus, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);
  const [readOnly, setReadOnly] = React.useState(true);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        readOnly={readOnly}
        onFocus={(e) => {
          setReadOnly(false);
          onFocus?.(e);
        }}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
