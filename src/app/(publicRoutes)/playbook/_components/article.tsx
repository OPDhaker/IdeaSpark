import Link from "next/link";
import type { ReactNode } from "react";
import { InfoIcon } from "./icons";
import { PLAYBOOK_ARTICLE_ID } from "./markdown";

const listClass = "space-y-1.5 pl-[22px] marker:text-(--pb-muted) *:pl-px";

const day1Schedule = [
  ["TODO", "Check-in"],
  ["TODO", "Opening & track reveal"],
  ["TODO", "Idea pitches"],
  ["TODO", "Fun games"],
];

const day2Schedule = [
  ["TODO", "Mentoring round"],
  ["TODO", "Final presentations"],
  ["TODO", "Results & closing"],
];

const judgingCriteria = [
  ["Problem understanding", "TODO %"],
  ["Innovation", "TODO %"],
  ["Feasibility", "TODO %"],
  ["Presentation", "TODO %"],
];

const faqs = [
  { question: "Do I need to know how to code?", answer: "TODO" },
  { question: "Can I switch tracks after registering?", answer: "TODO" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mt-7 border-t border-(--pb-line) pt-6"
    >
      <h2
        id={`${id}-title`}
        className="mb-4 text-[24px] leading-[1.25] font-bold tracking-[-1.1px]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Table({
  label,
  columns,
  rows,
  timeColumn = false,
}: {
  label: string;
  columns: string[];
  rows: string[][];
  timeColumn?: boolean;
}) {
  const cellClass =
    "border-t border-(--pb-line) px-3 py-[9px] max-[700px]:p-2.5";

  return (
    <div className="overflow-x-auto rounded-md border border-(--pb-line)">
      <table
        aria-label={label}
        className="w-full border-collapse text-left text-[10.5px] leading-4 max-[700px]:text-[11px]"
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-3 py-[9px] text-[8.5px] leading-[13px] font-semibold first:w-[35%] max-[700px]:p-2.5 max-[700px]:text-[10px] max-[700px]:first:w-[40%]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([first, second]) => (
            <tr key={`${first}-${second}`}>
              <td
                className={
                  timeColumn
                    ? `${cellClass} font-mono text-[8px] leading-4 text-(--pb-muted)`
                    : cellClass
                }
              >
                {first}
              </td>
              <td className={cellClass}>{second}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArticleLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-(--pb-link) underline underline-offset-3 hover:text-(--pb-text)"
    >
      {children}
    </Link>
  );
}

export function PlaybookArticle() {
  return (
    <>
      <p className="mt-8 mb-2 flex items-center gap-2 text-[8px] leading-4 font-bold tracking-[1.7px] text-(--pb-eyebrow) uppercase before:size-[5px] before:bg-(--pb-red) before:content-[''] max-[700px]:mt-[30px]">
        The ideathon field guide
      </p>
      <article id={PLAYBOOK_ARTICLE_ID}>
        <h1 className="mb-5 text-[50px] leading-[1.12] font-extrabold tracking-[-2.7px] max-[700px]:text-[length:clamp(38px,10vw,50px)] max-[700px]:tracking-[-2px]">
          IdeaSpark 3.0
          <br />
          Playbook
          <span aria-hidden="true" className="text-(--pb-red)">
            .
          </span>
        </h1>
        <p className="text-[10px] leading-5 text-(--pb-muted) max-[700px]:text-[11px]">
          Our motto is{" "}
          <span lang="ja" className="text-[9px]">
            決意し、火をつけ、導く。
          </span>{" "}
          ("Resolve, ignite, lead.")
        </p>
        <ul className={`${listClass} mt-[18px] mb-5 list-disc`}>
          <li>
            <strong>Dates:</strong> 5th &amp; 6th October
          </li>
          <li>
            <strong>Day 1:</strong> Pitch your idea + fun games
          </li>
          <li>
            <strong>Venue:</strong> TODO
          </li>
          <li>
            <strong>Team size:</strong> TODO (e.g. 2–4)
          </li>
        </ul>
        <aside
          role="note"
          data-callout
          className="flex gap-2.5 rounded-md border border-(--pb-line) p-[15px] text-[10px] max-[700px]:px-3 max-[700px]:py-3.5 max-[700px]:text-[11px]"
        >
          <InfoIcon className="mt-0.5 size-[13px] text-(--pb-link)" />
          <div>
            <p className="mb-[3px] text-[8px] font-bold tracking-[0.8px] text-(--pb-link) uppercase max-[700px]:text-[9px]">
              Before you begin
            </p>
            <p>
              Registration closes on <strong>TODO</strong>. Register from the
              main site.
            </p>
          </div>
        </aside>

        <Section id="schedule" title="Schedule">
          <h3 className="mb-[9px] text-[14px] leading-5 font-bold tracking-[-0.4px]">
            Day 1 (5 October)
          </h3>
          <Table
            label="Day 1 schedule"
            columns={["Time", "What happens"]}
            rows={day1Schedule}
            timeColumn
          />
          <h3 className="mt-5 mb-[9px] text-[14px] leading-5 font-bold tracking-[-0.4px]">
            Day 2 (6 October)
          </h3>
          <Table
            label="Day 2 schedule"
            columns={["Time", "What happens"]}
            rows={day2Schedule}
            timeColumn
          />
        </Section>

        <Section id="eligibility" title="Eligibility">
          <ul className={`${listClass} list-disc`}>
            <li>
              TODO: who can participate (years, departments, other colleges?)
            </li>
            <li>TODO: team size and whether cross-year teams are allowed</li>
          </ul>
        </Section>

        <Section id="rules" title="Rules">
          <ol className={`${listClass} list-decimal`}>
            <li>
              Use the official{" "}
              <ArticleLink href="/event-details/resources">
                presentation template
              </ArticleLink>
              .
            </li>
            <li>
              Each team picks <strong>one</strong>{" "}
              <ArticleLink href="/event-details/tracks">track</ArticleLink>.
            </li>
            <li>TODO: originality / AI-use policy</li>
            <li>TODO: time limit per pitch</li>
            <li>TODO: code of conduct</li>
          </ol>
        </Section>

        <Section id="judging" title="Judging">
          <Table
            label="Judging criteria"
            columns={["Criterion", "Weight"]}
            rows={judgingCriteria}
          />
        </Section>

        <Section id="prizes" title="Prizes">
          <ul className={`${listClass} list-disc`}>
            <li>TODO</li>
          </ul>
        </Section>

        <Section id="faq" title="FAQ">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group border-t border-(--pb-line) last:border-b"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-[15px] py-[15px] text-[11px] font-semibold after:text-[18px] after:leading-none after:font-normal after:text-(--pb-muted) after:content-['+'] group-open:after:rotate-45 max-[700px]:text-[12px] [&::-webkit-details-marker]:hidden">
                {faq.question}
              </summary>
              <p className="pb-[15px] text-(--pb-muted)">{faq.answer}</p>
            </details>
          ))}
        </Section>

        <Section id="contact" title="Contact">
          <ul className={`${listClass} list-disc`}>
            <li>TODO: coordinator names + phone/email</li>
          </ul>
        </Section>
      </article>
    </>
  );
}
