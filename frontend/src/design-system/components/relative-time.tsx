import { formatDateTime, formatRelative } from "@/utils/format";

// "há 4 minutos", com a data exata no title e no dateTime para quem precisar dela.
export function RelativeTime({ iso, now }: { iso: string; now?: Date }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="tabular-nums">
      {formatRelative(iso, now)}
    </time>
  );
}
