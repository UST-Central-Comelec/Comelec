import type { ReactNode } from "react";

export default function AccountsLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <>{children}{modal}</>;
}
