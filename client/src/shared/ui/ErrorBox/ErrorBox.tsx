interface ErrorBoxProps {
  message: string;
  className?: string;
}

export function ErrorBox({ message, className }: ErrorBoxProps) {
  return (
    <div
      className={
        className ??
        "rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
      }
    >
      {message}
    </div>
  );
}
