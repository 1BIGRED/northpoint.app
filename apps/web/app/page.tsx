"use client";

import { Button } from "@northpoint/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@northpoint/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@northpoint/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@northpoint/ui/components/dropdown-menu";
import { Input } from "@northpoint/ui/components/input";
import { Label } from "@northpoint/ui/components/label";
import { Toaster, toast } from "@northpoint/ui/components/sonner";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">
          {"{{PRODUCT_NAME}}"}
        </h1>
        <p className="text-muted-foreground">
          Tailwind v4 + shadcn/ui wired up. Components live in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            @northpoint/ui
          </code>
          .
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Component smoke test</CardTitle>
          <CardDescription>
            If you can interact with everything below, A2 is wired up correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" placeholder="Type something…" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hello from a dialog</DialogTitle>
                <DialogDescription>
                  Radix portal + Tailwind classes both resolving correctly.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button>OK</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Menu</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Item one</DropdownMenuItem>
              <DropdownMenuItem>Item two</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="secondary"
            onClick={() =>
              toast("Toast fired", {
                description: "Sonner is mounted at the bottom-right.",
              })
            }
          >
            Fire toast
          </Button>
        </CardFooter>
      </Card>

      <Toaster />
    </main>
  );
}
