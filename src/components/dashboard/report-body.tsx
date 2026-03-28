"use client";

import ReactMarkdown from "react-markdown";

type Props = { content: string };

export function ReportBody({ content }: Props) {
  return (
    <div className="report-prose text-foreground">
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => (
            <h1
              className="font-[family-name:var(--font-heading)] mt-10 mb-4 border-b border-[#002147]/25 pb-2 text-2xl font-bold text-[#002147] first:mt-0"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="font-[family-name:var(--font-heading)] mt-8 mb-3 text-xl font-semibold text-[#002147]"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="font-[family-name:var(--font-heading)] mt-6 mb-2 text-lg font-semibold text-[#002147]/90"
              {...props}
            >
              {children}
            </h3>
          ),
          p: ({ children, ...props }) => (
            <p
              className="mb-3 text-[15px] leading-[1.7] text-slate-800"
              {...props}
            >
              {children}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul className="mb-4 ml-6 list-disc space-y-1.5" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="mb-4 ml-6 list-decimal space-y-1.5" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed text-slate-800" {...props}>
              {children}
            </li>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-[#002147]" {...props}>
              {children}
            </strong>
          ),
          hr: () => <hr className="my-8 border-[#002147]/15" />,
          table: ({ children, ...props }) => (
            <div className="my-5 overflow-x-auto rounded-xl border border-[#002147]/15 shadow-sm">
              <table className="w-full min-w-[520px] border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className="bg-[#002147]/[0.08] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#002147]"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="border-t border-[#002147]/10 px-3 py-2.5 align-top text-slate-800"
              {...props}
            >
              {children}
            </td>
          ),
          a: ({ children, href, ...props }) => (
            <a
              className="font-medium text-[#002147] underline decoration-[#C69C2B]/70 underline-offset-2 hover:text-[#C69C2B]"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
