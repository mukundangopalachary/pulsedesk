import { useEffect, type ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Link, navigate, usePathname } from '@/lib/router';
import { Button, Spinner } from '@/components/ui';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import OnboardingPage from '@/pages/OnboardingPage';
import AppEntryPage from '@/pages/AppEntryPage';
import InboxPage from '@/pages/InboxPage';
import PublicFeedbackPage from '@/pages/PublicFeedbackPage';
import InvitePage from '@/pages/InvitePage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user]);

  if (loading || !user) return <Spinner />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn't exist</h1>
      <Link to="/" className="mt-2">
        <Button variant="secondary">Back to home</Button>
      </Link>
    </div>
  );
}

function AppRouter() {
  const pathname = usePathname();

  const publicFormMatch = pathname.match(/^\/f\/([^/]+)\/?$/);
  if (publicFormMatch) {
    return <PublicFeedbackPage slug={decodeURIComponent(publicFormMatch[1])} />;
  }

  const inviteMatch = pathname.match(/^\/invite\/([^/]+)\/?$/);
  if (inviteMatch) {
    return <InvitePage token={decodeURIComponent(inviteMatch[1])} />;
  }

  const inboxMatch = pathname.match(/^\/app\/([^/]+)\/?$/);
  if (inboxMatch) {
    const slug = decodeURIComponent(inboxMatch[1]);
    return (
      <RequireAuth>
        <InboxPage slug={slug} />
      </RequireAuth>
    );
  }

  switch (pathname) {
    case '/':
      return <LandingPage />;
    case '/auth':
      return <AuthPage />;
    case '/onboarding':
      return (
        <RequireAuth>
          <OnboardingPage />
        </RequireAuth>
      );
    case '/app':
      return (
        <RequireAuth>
          <AppEntryPage />
        </RequireAuth>
      );
    default:
      return <NotFound />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
