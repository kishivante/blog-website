"use client";
import { useActionState, useState } from "react";
import type { ThemeSetting } from "@prisma/client";
import type { FormState } from "@/types/forms";
import { initialFormState } from "@/types/forms";

const colorKeys = [
  "primaryBackground",
  "secondaryBackground",
  "cardBackground",
  "borderColor",
  "textColor",
  "mutedTextColor",
  "linkColor",
  "scarletAccent",
  "azureAccent",
  "amberAccent",
  "adminColor",
  "editorColor",
  "moderatorColor",
  "supporterColor",
  "userColor",
] as const;
const labels: Record<(typeof colorKeys)[number], string> = {
  primaryBackground: "Ana arka plan",
  secondaryBackground: "İkincil arka plan",
  cardBackground: "Kart",
  borderColor: "Çerçeve",
  textColor: "Metin",
  mutedTextColor: "Soluk metin",
  linkColor: "Link",
  scarletAccent: "Scarlet accent",
  azureAccent: "Azure accent",
  amberAccent: "Amber accent",
  adminColor: "Admin banner",
  editorColor: "Editor banner",
  moderatorColor: "Moderator",
  supporterColor: "Supporter",
  userColor: "User",
};
const luminance = (hex: string) => {
  const values = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
};
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};
export function AdminThemeForm({
  action,
  csrf,
  theme,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  csrf: string;
  theme: ThemeSetting;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(colorKeys.map((key) => [key, theme[key]])) as Record<
        (typeof colorKeys)[number],
        string
      >,
  );
  const ratio = contrast(values.textColor, values.primaryBackground);
  return (
    <form className="settingsCard themeAdmin" action={formAction}>
      <input type="hidden" name="_csrf" value={csrf} />
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.success}</p> : null}
      <div className="themeColorGrid">
        {colorKeys.map((key) => (
          <label key={key}>
            {labels[key]}
            <input
              type="color"
              name={key}
              value={values[key]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>
      <label>
        Radius
        <input
          name="borderRadius"
          type="range"
          min={0}
          max={32}
          defaultValue={theme.borderRadius}
        />
      </label>
      <label>
        Gölge
        <input
          name="shadowIntensity"
          type="range"
          min={0}
          max={100}
          defaultValue={theme.shadowIntensity}
        />
      </label>
      <label>
        Başlık fontu
        <select name="headingFont" defaultValue={theme.headingFont}>
          <option>Arial, Helvetica, sans-serif</option>
          <option>Inter, Arial, sans-serif</option>
          <option>Georgia, serif</option>
        </select>
      </label>
      <label>
        Gövde fontu
        <select name="bodyFont" defaultValue={theme.bodyFont}>
          <option>Arial, Helvetica, sans-serif</option>
          <option>Inter, Arial, sans-serif</option>
          <option>Georgia, serif</option>
        </select>
      </label>
      <div
        className="themePreview"
        style={{
          background: values.primaryBackground,
          color: values.textColor,
          borderColor: values.borderColor,
        }}
      >
        <strong style={{ color: values.linkColor }}>
          Canlı tema önizlemesi
        </strong>
        <p style={{ color: values.mutedTextColor }}>
          Kart, metin, link ve vurgu renkleri yalnızca doğrulanmış değerlerden
          üretilir.
        </p>
        <span
          className="uiButton"
          style={{ background: values.scarletAccent, color: values.textColor }}
        >
          Örnek işlem
        </span>
      </div>
      <p className={ratio < 4.5 ? "contrastBad" : "contrastGood"}>
        Metin/arka plan kontrastı: {ratio.toFixed(2)}:1{" "}
        {ratio < 4.5 ? "— WCAG AA için yetersiz" : "— uygun"}
      </p>
      <div className="formActions">
        <button className="uiButton" disabled={pending}>
          Kaydet
        </button>
        <button
          className="quietButton"
          name="intent"
          value="reset"
          disabled={pending}
        >
          Varsayılana dön
        </button>
      </div>
    </form>
  );
}
