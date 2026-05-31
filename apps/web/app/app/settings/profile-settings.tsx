"use client";

import { useState, useTransition } from "react";

import { Input } from "@northpoint/ui/components/input";

import { updateProfile, type ProfileUpdate } from "./actions";

type Props = {
  initialName: string;
  initialIndustry: string;
  initialCity: string;
};

// Profile fields edited in place: each saves on blur (only if it changed),
// with a small per-form status line. Uses the RLS-scoped updateProfile action.
export function ProfileSettings({
  initialName,
  initialIndustry,
  initialCity,
}: Props) {
  const [name, setName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry);
  const [city, setCity] = useState(initialCity);
  const saved = useState(() => ({
    name: initialName,
    industry: initialIndustry,
    city: initialCity,
  }))[0];

  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(field: keyof ProfileUpdate, value: string) {
    if (saved[field] === value) return; // unchanged → no write
    setStatus("idle");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await updateProfile({ [field]: value });
      if (result.ok) {
        saved[field] = value;
        setStatus("saved");
      } else {
        setStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Business profile</h2>
        {status === "saved" ? (
          <span className="text-xs text-muted-foreground">Saved</span>
        ) : status === "error" ? (
          <span className="text-xs text-red-700">{errorMsg}</span>
        ) : null}
      </div>

      <div className="space-y-3">
        <Field label="Business name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => save("name", name)}
            placeholder="e.g. BC Glass & Tint"
          />
        </Field>
        <Field label="Industry">
          <Input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            onBlur={() => save("industry", industry)}
            placeholder="e.g. Auto glass"
          />
        </Field>
        <Field label="City">
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onBlur={() => save("city", city)}
            placeholder="e.g. Kelowna"
          />
        </Field>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
