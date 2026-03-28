"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Props = { content: string; variant?: "default" | "dark" };

export function ReportBody({ content, variant = "default" }: Props) {
  const d = variant === "dark";

  return (
    <div
      className={cn(
        "report-prose",
        d ? "text-zinc-200" : "text-foreground"
      )}
    >
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => (
            <h1
              className={cn(
                "font-[family-name:var(--font-heading)] mt-10 mb-4 border-b pb-2 text-2xl font-bold first:mt-0",
                d
                  ? "border-zinc-700 text-zinc-100"
                  : "border-[#002147]/25 text-[#002147]"
              )}
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className={cn(
                "font-[family-name:var(--font-heading)] mt-8 mb-3 text-xl font-semibold",
                d ? "text-[#C69C2B]" : "text-[#002147]"
              )}
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className={cn(
                "font-[family-name:var(--font-heading)] mt-6 mb-2 text-lg font-semibold",
                d ? "text-zinc-200" : "text-[#002147]/90"
              )}
              {...props}
            >
              {children}
            </h3>
          ),
          p: ({ children, ...props }) => (
            <p
              className={cn(
                "mb-3 text-[15px] leading-[1.7]",
                d ? "text-zinc-400" : "text-slate-800"
              )}
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
            <li
              className={cn(
                "leading-relaxed",
                d ? "text-zinc-400" : "text-slate-800"
              )}
              {...props}
            >
              {children}
            </li>
          ),
          strong: ({ children, ...props }) => (
            <strong
              className={cn(
                "font-semibold",
                d ? "text-zinc-100" : "text-[#002147]"
              )}
              {...props}
            >
              {children}
            </strong>
          ),
          hr: () => (
            <hr
              className={cn(
                "my-8",
                d ? "border-zinc-800" : "border-[#002147]/15"
              )}
            />
          ),
          table: ({ children, ...props }) => (
            <div
              className={cn(
                "my-5 overflow-x-auto rounded-xl shadow-sm",
                d ? "border border-zinc-800" : "border border-[#002147]/15"
              )}
            >
              <table
                className="w-full min-w-[520px] border-collapse text-sm"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className={cn(
                "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide",
                d
                  ? "bg-zinc-800/80 text-[#C69C2B]"
                  : "bg-[#002147]/[0.08] text-[#002147]"
              )}
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className={cn(
                "border-t px-3 py-2.5 align-top",
                d
                  ? "border-zinc-800 text-zinc-400"
                  : "border-[#002147]/10 text-slate-800"
              )}
              {...props}
            >
              {children}
            </td>
          ),
          a: ({ children, href, ...props }) => (
            <a
              className={cn(
                "font-medium underline underline-offset-2",
                d
                  ? "text-[#C69C2B] decoration-[#C69C2B]/50 hover:text-[#d4af47]"
                  : "text-[#002147] decoration-[#C69C2B]/70 hover:text-[#C69C2B]"
              )}
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
