interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function InfoRow({ label, value, mono }: InfoRowProps) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm font-bold ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
