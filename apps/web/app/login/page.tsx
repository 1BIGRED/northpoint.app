import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; sent?: string; email?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-8">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a magic link. No password.
          </p>
        </header>

        {sent ? (
          <div
            role="status"
            className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900"
          >
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-sm">
              We sent a magic link to{" "}
              <span className="font-mono">{params.email ?? "your inbox"}</span>.
              Click it to finish signing in.
            </p>
          </div>
        ) : (
          <LoginForm returnTo={params.returnTo} />
        )}
      </div>
    </main>
  );
}
