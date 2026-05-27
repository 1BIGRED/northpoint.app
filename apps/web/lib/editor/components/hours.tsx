import type { ComponentDefinition } from "../types";

// Hours block is the wedge demo content (PHASE_1.md Group F). Atomic
// hours updates need a structured representation — this is it.

type DayHours = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  open: string; // "HH:MM" 24h, or "" when closed
  close: string;
};

type HoursProps = {
  title: string;
  days: DayHours[];
};

const DEFAULT_DAYS: DayHours[] = [
  { day: "Mon", open: "09:00", close: "17:00" },
  { day: "Tue", open: "09:00", close: "17:00" },
  { day: "Wed", open: "09:00", close: "17:00" },
  { day: "Thu", open: "09:00", close: "17:00" },
  { day: "Fri", open: "09:00", close: "17:00" },
  { day: "Sat", open: "", close: "" },
  { day: "Sun", open: "", close: "" },
];

function fmt(open: string, close: string): string {
  if (!open || !close) return "Closed";
  return `${open} – ${close}`;
}

export const hoursBlock: ComponentDefinition<HoursProps> = {
  type: "Hours",
  label: "Hours",
  defaultProps: {
    title: "Hours",
    days: DEFAULT_DAYS,
  },
  fields: {
    title: { kind: "text", label: "Heading" },
    days: {
      kind: "array",
      label: "Days",
      itemFields: {
        day: { kind: "text", label: "Day" },
        open: { kind: "text", label: "Open (HH:MM)" },
        close: { kind: "text", label: "Close (HH:MM)" },
      },
    },
  },
  render: ({ title, days }) => (
    <div className="space-y-3 py-4">
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        {days.map((d) => (
          <div key={d.day} className="contents">
            <dt className="font-medium">{d.day}</dt>
            <dd className="text-muted-foreground">{fmt(d.open, d.close)}</dd>
          </div>
        ))}
      </dl>
    </div>
  ),
};
