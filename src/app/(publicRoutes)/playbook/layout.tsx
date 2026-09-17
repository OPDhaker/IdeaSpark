import type { Metadata } from "next";
import "./typeset.css";

export const metadata: Metadata = {
  title: "Playbook | IdeaSpark 3.0",
};

export default function PlaybookLayout({ children }: LayoutProps<"/playbook">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <article className="typeset">{children}</article>
    </main>
  );
}
