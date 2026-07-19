import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";

function classes(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function Button({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={classes("uiButton", className)} {...props} />;
}
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={classes("uiInput", className)} {...props} />;
}
export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={classes("uiInput uiTextarea", className)} {...props} />
  );
}
export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={classes("uiInput uiSelect", className)} {...props} />
  );
}
export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="uiCheckbox" type="checkbox" {...props} />;
}
export function Switch(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className="uiSwitch" role="switch" type="checkbox" {...props} />
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "scarlet" | "azure" | "amber";
}) {
  return <span className={`uiBadge uiBadge--${tone}`}>{children}</span>;
}
export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const pixels = size === "sm" ? 30 : size === "lg" ? 58 : 42;
  return src ? (
    <Image
      className={`uiAvatar uiAvatar--${size}`}
      src={src}
      alt=""
      width={pixels}
      height={pixels}
      unoptimized
    />
  ) : (
    <span className={`uiAvatar uiAvatar--${size}`} aria-hidden="true">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={classes("uiCard", className)}>{children}</section>;
}
export function Alert({
  children,
  title = "Bilgi",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="uiAlert" role="status">
      <AlertTriangle size={18} />
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return (
    <span className={classes("uiSkeleton", className)} aria-hidden="true" />
  );
}
export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="uiFormField">
      <span>{label}</span>
      {children}
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}
export function SearchBox({ defaultValue }: { defaultValue?: string }) {
  return (
    <form className="searchBox" action="/ara">
      <Search size={17} aria-hidden="true" />
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="İçerik ara"
        aria-label="İçerik ara"
      />
    </form>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="emptyState">
      <span className="emptyOrbit" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorState({
  title = "Bir sorun oluştu",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="errorState" role="alert">
      <AlertTriangle />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Pagination({
  page,
  hasNext,
  basePath,
  query = {},
}: {
  page: number;
  hasNext: boolean;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  return (
    <nav className="pagination" aria-label="Sayfalama">
      {page > 1 ? (
        <Link href={{ pathname: basePath, query: { ...query, page: page - 1 } }}>
          <ChevronLeft /> Önceki
        </Link>
      ) : (
        <span aria-disabled="true"><ChevronLeft /> Önceki</span>
      )}
      <span>{page}</span>
      {hasNext ? (
        <Link href={{ pathname: basePath, query: { ...query, page: page + 1 } }}>
          Sonraki <ChevronRight />
        </Link>
      ) : (
        <span aria-disabled="true">Sonraki <ChevronRight /></span>
      )}
    </nav>
  );
}
export function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Sayfa yolu">
      <ol className="breadcrumb">
        {items.map((item, index) => (
          <li key={item.label}>
            {item.href ? (
              <Link href={{ pathname: item.href }}>{item.label}</Link>
            ) : (
              item.label
            )}
            {index < items.length - 1 ? <span>/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function UserBadge({ label }: { label: string }) {
  return <Badge tone="azure">{label}</Badge>;
}
export function RoleBadge({
  role,
}: {
  role: "ADMIN" | "EDITOR" | "MODERATOR" | "SUPPORTER" | "USER";
}) {
  return (
    <span className="roleBadge" data-role={role}>
      {role}
    </span>
  );
}
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}
