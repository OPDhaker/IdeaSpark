import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { getCtaState } from "@/lib/auth/cta";
import { PlaybookActions } from "./_components/page-actions";
import { PlaybookToc } from "./_components/toc";
import "./typeset.css";

export const metadata: Metadata = {
  title: "Playbook | IdeaSpark 3.0",
  description:
    "Everything you need for IdeaSpark 3.0: dates, schedule, eligibility, rules, judging, prizes, FAQ and contacts.",
};

/**
 * The shell for `/playbook`. `page.mdx` holds nothing but markdown; the title,
 * metadata, chrome and the `.typeset` wrapper all live here.
 */
export default async function PlaybookLayout({
  children,
}: LayoutProps<"/playbook">) {
  // Same trade-off the landing page makes: this reads cookies, so the segment
  // is dynamic, but `getCtaState` returns early for anonymous visitors without
  // paying for an upstream session round trip.
  const ctaState = await getCtaState();

  return (
    <>
      <a
        href="#playbook-article"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:outline focus:outline-ring"
      >
        Skip to content
      </a>

      <Navbar ctaState={ctaState} />

      <main className="mx-auto w-full max-w-section flex-1 px-6 pt-32 pb-24 md:px-16">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="min-w-0">
            <article id="playbook-article" className="typeset">
              {children}
            </article>
            <PlaybookActions />
          </div>

          <aside className="order-first lg:order-none lg:sticky lg:top-28 lg:self-start">
            <PlaybookToc />
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}
