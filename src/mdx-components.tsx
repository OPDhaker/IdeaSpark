import { Info, Lightbulb, OctagonAlert, TriangleAlert } from "lucide-react";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import {
  Children,
  type ComponentProps,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";

/**
 * Everything that is not listed here is styled by shadcn/typeset, which the
 * playbook layout applies to the whole article. Only map a tag when typeset
 * genuinely cannot reach it: client-side navigation, GFM alert callouts and
 * heading permalinks.
 */

const alerts = {
  NOTE: { icon: Info, label: "Note", tone: "text-primary" },
  TIP: { icon: Lightbulb, label: "Tip", tone: "text-primary" },
  IMPORTANT: { icon: Info, label: "Important", tone: "text-primary" },
  WARNING: { icon: TriangleAlert, label: "Warning", tone: "text-destructive" },
  CAUTION: { icon: OctagonAlert, label: "Caution", tone: "text-destructive" },
} as const;

type AlertKind = keyof typeof alerts;

const alertMarker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/;

/**
 * `remark-gfm` does not implement GFM alerts, so `> [!IMPORTANT]` arrives as an
 * ordinary blockquote whose first paragraph opens with the literal marker text.
 * Recognise that shape and hand back the kind plus the children with the marker
 * removed; anything else is a real blockquote.
 */
function readAlert(
  children: ReactNode,
): { kind: AlertKind; body: ReactNode } | null {
  const blocks = Children.toArray(children);

  // mdast-to-hast puts a "\n" text node between block children, so the leading
  // paragraph is not necessarily the first entry.
  const index = blocks.findIndex((node) => isValidElement(node));
  const firstBlock = blocks[index];
  if (!isValidElement<{ children?: ReactNode }>(firstBlock)) return null;

  const [head, ...tail] = Children.toArray(firstBlock.props.children);
  if (typeof head !== "string") return null;

  const match = alertMarker.exec(head);
  if (!match) return null;

  const rest = head.slice(match[0].length);
  const firstParagraph = cloneElement(
    firstBlock,
    undefined,
    rest ? [rest, ...tail] : tail,
  );

  return {
    kind: match[1] as AlertKind,
    body: [firstParagraph, ...blocks.slice(index + 1)],
  };
}

function Blockquote({ children, ...props }: ComponentProps<"blockquote">) {
  const alert = readAlert(children);
  if (!alert) return <blockquote {...props}>{children}</blockquote>;

  const { icon: Icon, label, tone } = alerts[alert.kind];

  return (
    // `data-not-typeset` keeps typeset's prose rules off the callout so its own
    // spacing holds; the links inside still go through the `a` mapping below.
    <aside
      role="note"
      aria-label={label}
      data-not-typeset
      className="my-[1.25em] flex gap-3 rounded-lg border border-border bg-card p-4"
    >
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <div className="min-w-0 space-y-1.5 [&_p]:m-0">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${tone} m-0`}
        >
          {label}
        </p>
        {alert.body}
      </div>
    </aside>
  );
}

/**
 * `rehype-slug` supplies the `id`; this adds the hover permalink on top of it.
 * `scroll-mt` clears the fixed navbar when a `#section` link lands.
 */
function heading(Tag: "h2" | "h3") {
  return function Heading({ id, children, ...props }: ComponentProps<"h2">) {
    if (!id) return <Tag {...props}>{children}</Tag>;

    return (
      <Tag id={id} className="group scroll-mt-28" {...props}>
        {children}
        <a
          href={`#${id}`}
          aria-label="Permalink to this section"
          data-not-typeset
          className="ml-2 align-middle text-[0.8em] font-normal text-muted-foreground no-underline opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          #
        </a>
      </Tag>
    );
  };
}

/**
 * typeset ships `.typeset-scroll` for wide blocks, but markdown has no way to
 * put a class on the `<table>` it generates. Wrapping every table here is what
 * keeps a wide one (the judging rubric) scrollable on a phone instead of
 * squeezed into unreadable columns.
 */
function Table({ children, ...props }: ComponentProps<"table">) {
  return (
    <div className="typeset-scroll">
      <table {...props}>{children}</table>
    </div>
  );
}

function Anchor({ href = "", children, ...props }: ComponentProps<"a">) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
      {children}
    </a>
  );
}

const components: MDXComponents = {
  a: Anchor,
  blockquote: Blockquote,
  h2: heading("h2"),
  h3: heading("h3"),
  table: Table,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
