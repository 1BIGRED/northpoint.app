"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@northpoint/ui/components/button";
import { Input } from "@northpoint/ui/components/input";
import { Label } from "@northpoint/ui/components/label";

import { completeOnboarding } from "./actions";

// Phase 1 onboarding is a single "Basics" step (business-only — the
// account-type fork and steps 2–7 are deferred to later in Group C / Phase
// 2). Collect just enough to create the profile, then land on the sites
// list.
export function OnboardingForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({ businessName, industry, city });
      if (result.ok) {
        router.push("/app/sites");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          required
          autoFocus
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="BC Glass & Tint"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">
          Industry <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Auto glass & window tinting"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">
          City <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Kelowna, BC"
          disabled={pending}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !businessName.trim()} className="w-full">
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
