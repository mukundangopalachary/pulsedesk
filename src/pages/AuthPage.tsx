import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Link, navigate } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import { Button, ErrorMessage, Field, Input, Logo, ThemeToggle } from '@/components/ui';

type Mode = 'signin' | 'signup';

function describeAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'That email and password do not match our records.';
  }
  if (lower.includes('password')) {
    return 'Your password must be at least 6 characters.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export default function AuthPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate('/app');
  }, [loading, user]);

  const isSignup = mode === 'signup';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const trimmedEmail = email.trim();
    const { error: authError } = isSignup
      ? await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { data: { full_name: fullName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

    setSubmitting(false);
    if (authError) {
      console.error(authError);
      setError(describeAuthError(authError.message));
      return;
    }
    navigate('/app');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {isSignup ? 'Start collecting feedback in minutes. Free to get started.' : 'Sign in to open your feedback inbox.'}
          </p>

          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <Field label="Full name">
                  <Input
                    required
                    autoComplete="name"
                    maxLength={120}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                  />
                </Field>
              )}
              <Field label="Work email">
                <Input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password" hint={isSignup ? 'At least 6 characters.' : undefined}>
                <Input
                  required
                  type="password"
                  minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              <ErrorMessage message={error} />

              <Button type="submit" className="w-full" loading={submitting}>
                {isSignup ? 'Create account' : 'Sign in'}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup');
                setError(null);
              }}
              className="font-medium text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
