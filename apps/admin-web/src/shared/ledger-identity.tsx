import { type ReactNode } from "react";

import "./ledger-identity.css";

export function LedgerIdentity({
  title,
  subtitle,
  extra,
  action,
  disabled = false,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  action?: ReactNode;
  disabled?: boolean;
  className?: string;
}): ReactNode {
  return (
    <span
      className={`ledger-identity${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}
    >
      <strong>{title}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
      {extra}
      {action}
    </span>
  );
}
