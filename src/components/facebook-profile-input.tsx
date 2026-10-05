"use client";

import { useEffect, useRef, useState } from "react";
import { facebookProfileUrl, facebookUsername, facebookUsernameMaxLength } from "@/lib/forms/facebook";
import styles from "./facebook-profile-input.module.css";

export function FacebookProfileInput({ defaultValue = "", required = false, invalid = false, onChange }: {
  defaultValue?: string;
  required?: boolean;
  invalid?: boolean;
  onChange?: () => void;
}) {
  const [username, setUsername] = useState(() => facebookUsername(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = inputRef.current?.form;
    const reset = () => setUsername(facebookUsername(defaultValue));
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);

  const update = (value: string) => {
    setUsername(facebookUsername(value).slice(0, facebookUsernameMaxLength));
    onChange?.();
  };

  return (
    <>
      <span className={styles.field} data-invalid={invalid || undefined}>
        <span className={styles.prefix}>facebook.com/</span>
        <input
          ref={inputRef}
          className={styles.username}
          type="text"
          aria-label="Facebook profile username"
          aria-invalid={invalid || undefined}
          placeholder="yourname"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={facebookUsernameMaxLength}
          required={required}
          value={username}
          onChange={(event) => update(event.target.value)}
          onPaste={(event) => {
            event.preventDefault();
            const input = event.currentTarget;
            const pasted = facebookUsername(event.clipboardData.getData("text/plain"));
            const start = input.selectionStart ?? 0;
            const end = input.selectionEnd ?? input.value.length;
            update(input.value.slice(0, start) + pasted + input.value.slice(end));
          }}
        />
      </span>
      <input type="hidden" name="facebookUrl" value={facebookProfileUrl(username)} />
    </>
  );
}
