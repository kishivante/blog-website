"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/types/forms";
import { initialFormState } from "@/types/forms";

export function SettingsForm({
  action,
  csrf,
  submitLabel,
  encType,
  confirmMessage,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  csrf: string;
  submitLabel: string;
  encType?: "multipart/form-data";
  confirmMessage?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form
      className="settingsForm"
      action={formAction}
      encType={encType}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="_csrf" value={csrf} />
      {children}
      {state.error ? (
        <p className="formError" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="formSuccess" role="status">
          {state.success}
        </p>
      ) : null}
      <button className="uiButton" disabled={pending} type="submit">
        {pending ? "Kaydediliyor…" : submitLabel}
      </button>
    </form>
  );
}
