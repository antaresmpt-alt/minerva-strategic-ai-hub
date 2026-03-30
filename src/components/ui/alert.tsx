import * as React from "react";

import { cn } from "@/lib/utils";

function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border border-slate-200/90 bg-slate-50/90 px-4 py-3 text-sm text-slate-800 shadow-sm backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mb-1 font-semibold text-[#002147]", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed whitespace-pre-wrap text-slate-700",
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
