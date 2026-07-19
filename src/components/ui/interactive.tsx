"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function Dialog({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <span onClick={() => ref.current?.showModal()}>{trigger}</span>
      <dialog className="uiDialog" ref={ref}>
        <header>
          <h2>{title}</h2>
          <button
            onClick={() => ref.current?.close()}
            aria-label="Pencereyi kapat"
          >
            <X />
          </button>
        </header>
        {children}
      </dialog>
    </>
  );
}
export function ConfirmDialog({
  triggerLabel,
  title,
  onConfirm,
}: {
  triggerLabel: string;
  title: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog trigger={<Button>{triggerLabel}</Button>} title={title}>
      <p>Bu işlem geri alınamayabilir.</p>
      <Button onClick={onConfirm}>Onayla</Button>
    </Dialog>
  );
}
export function Dropdown({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="uiDropdown">
      <summary>
        {label}
        <ChevronDown size={15} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function Tabs({
  tabs,
}: {
  tabs: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div className="uiTabs">
      <div role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) =>
        active === tab.id ? (
          <div key={tab.id} role="tabpanel">
            {tab.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(id);
  }, []);
  return visible ? (
    <div className="uiToast" role="status">
      <Check />
      {message}
      <button onClick={() => setVisible(false)} aria-label="Bildirimi kapat">
        <X />
      </button>
    </div>
  ) : null;
}
