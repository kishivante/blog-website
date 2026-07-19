"use client";

import { useActionState } from "react";
import type { FormState } from "@/types/forms";
import { initialFormState } from "@/types/forms";

type Field = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  value?: string;
};
type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  csrf: string;
  fields: Field[];
  submitLabel: string;
  children?: React.ReactNode;
};

export function AuthForm({
  action,
  csrf,
  fields,
  submitLabel,
  children,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form className="authForm" action={formAction}>
      <input type="hidden" name="_csrf" value={csrf} />
      {fields.map((field) => (
        <div className="formField" key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input
            id={field.name}
            name={field.name}
            type={field.type ?? "text"}
            autoComplete={field.autoComplete}
            required={field.required ?? true}
            defaultValue={field.value}
            aria-describedby={`${field.name}-error`}
          />
          {state.fields?.[field.name]?.map((error) => (
            <p className="fieldError" id={`${field.name}-error`} key={error}>
              {error}
            </p>
          ))}
        </div>
      ))}
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
      <button type="submit" disabled={pending}>
        {pending ? "İşleniyor…" : submitLabel}
      </button>
    </form>
  );
}
