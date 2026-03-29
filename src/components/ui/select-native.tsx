import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type Option = { value: string; label: string };

type NativeSelectProps = Omit<React.ComponentProps<"select">, "children"> & {
  label?: string;
  options: Option[];
  id?: string;
};

function NativeSelect({
  label,
  options,
  id,
  className,
  ...props
}: NativeSelectProps) {
  const autoId = React.useId();
  const selectId = id ?? autoId;

  return (
    <div className="grid gap-1.5">
      {label ? (
        <Label htmlFor={selectId} className="text-xs font-medium">
          {label}
        </Label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          "border-input bg-background h-9 w-full min-w-[12rem] rounded-lg border px-3 text-sm shadow-xs outline-none transition-[color,box-shadow]",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export { NativeSelect, type Option };
