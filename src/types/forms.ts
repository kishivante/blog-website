export type FormState = {
  success?: string;
  error?: string;
  fields?: Record<string, string[]>;
};

export const initialFormState: FormState = {};
