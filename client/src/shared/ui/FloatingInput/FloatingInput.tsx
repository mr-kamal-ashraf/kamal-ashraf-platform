"use client";

import * as React from "react";
import { cn } from "@/shared/lib/cn";

export interface FloatingInputProps
  extends Omit<React.ComponentProps<"input">, "placeholder"> {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
}

export const FloatingInput = React.forwardRef<
  HTMLInputElement,
  FloatingInputProps
>(function FloatingInput(
  {
    label,
    hint,
    icon,
    trailing,
    className,
    containerClassName,
    id,
    type = "text",
    ...props
  },
  ref,
) {
  const reactId = React.useId();
  const inputId = id ?? reactId;

  return (
    <div className={cn("relative", containerClassName)}>
      <input
        ref={ref}
        id={inputId}
        type={type}
        placeholder={hint ?? " "}
        {...props}
        className={cn(
          "peer w-full border-0 border-b-2 border-border bg-transparent text-foreground transition-colors",
          "rounded-none px-1 pt-5 pb-2",
          "placeholder:text-transparent focus:placeholder:text-muted-foreground/50",
          "hover:border-foreground/40",
          "focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-60",
          icon && "pr-9",
          trailing && "pl-9",
          className,
        )}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-primary transition-all duration-300 ease-out peer-focus:w-full"
      />

      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute z-10 text-base text-muted-foreground transition-all duration-200",
          "top-5",
          icon ? "right-9" : "right-1",
          "peer-focus:top-0 peer-focus:text-xs peer-focus:font-bold peer-focus:text-primary",
          "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-bold",
        )}
      >
        {label}
      </label>

      {icon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 right-1 z-10 flex items-center text-muted-foreground transition-colors peer-focus:text-primary"
        >
          {icon}
        </span>
      )}

      {trailing && (
        <div className="absolute bottom-1.5 left-1 z-20 flex items-center">
          {trailing}
        </div>
      )}
    </div>
  );
});
