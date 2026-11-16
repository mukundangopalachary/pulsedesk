import { useState, type FormEvent } from 'react';
import { Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createWorkspace } from '@/lib/workspace';
import { navigate } from '@/lib/router';
import { Button, ErrorMessage, Field, Input, Logo, ThemeToggle } from '@/components/ui';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export default function OnboardingPage() {
  const { signOut, user } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugValid = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/.test(effectiveSlug);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slugValid) {
      setError('Use 3 to 40 lowercase letters, numbers or hyphens for your link.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const workspace = await createWorkspace(name.trim(), effectiveSlug);
      navigate(`/app/${workspace.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Step 1 of 1</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Set up your workspace</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as {user?.email}. Your workspace keeps your feedback separate from every other company.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Field label="Company name">
              <Input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc."
                autoFocus
              />
            </Field>

            <Field label="Public feedback link" hint={`Customers will send feedback at /f/${effectiveSlug || 'your-company'}`}>
              <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950">
                <span className="flex items-center gap-1.5 pl-3 text-sm text-zinc-400">
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                  /f/
                </span>
                <input
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  maxLength={40}
                  placeholder="acme"
                  className="w-full bg-transparent px-2 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                />
              </div>
            </Field>

            <ErrorMessage message={error} />

            <Button type="submit" className="w-full" loading={submitting} disabled={!name.trim() || !slugValid}>
              Create workspace
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
