import { ArrowRight, Check, Globe, Inbox, Map, Sparkles, Star } from 'lucide-react';
import { Link } from '@/lib/router';
import { Logo, ThemeToggle } from '@/components/ui';

const FEATURES = [
  {
    icon: Globe,
    title: 'A feedback form for every customer',
    body: 'Share a clean public link or drop an embeddable widget on your site. Customers rate you and tell you what matters in under a minute.',
  },
  {
    icon: Inbox,
    title: 'One inbox your team can run',
    body: 'Tag, assign, comment internally and resolve in one place. Nothing gets lost in a shared mailbox again.',
  },
  {
    icon: Sparkles,
    title: 'AI that reads for you',
    body: 'Every message is scored for sentiment and sorted into bugs, feature requests, pricing and support. Weekly summaries show the themes.',
  },
  {
    icon: Map,
    title: 'A public roadmap',
    body: 'Publish the feature requests you are building and let customers upvote what they want next.',
  },
];

const STARTER_FEATURES = ['Unlimited feedback collection', 'Public feedback form', 'Inbox with status and tags', 'Up to 2 teammates'];
const TEAM_FEATURES = [
  'Everything in Starter',
  'Unlimited teammates with roles',
  'AI sentiment, categories and reply drafts',
  'Dashboard and weekly summaries',
  'Slack notifications and public roadmap',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="hidden items-center gap-8 text-sm text-zinc-600 md:flex dark:text-zinc-400">
            <a href="#features" className="transition hover:text-zinc-900 dark:hover:text-zinc-100">Features</a>
            <a href="#pricing" className="transition hover:text-zinc-900 dark:hover:text-zinc-100">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200/60 sm:inline-block dark:text-zinc-300 dark:hover:bg-zinc-800">
              Sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 -top-24 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.22),transparent_60%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center sm:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              AI-powered feedback for small teams
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              Turn customer feedback into the next thing you build
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
              PulseDesk collects feedback from your customers, sorts it with AI, and gives your team one inbox to act on it.
              Set up in five minutes, no credit card required.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/auth"
                className="group inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                Create your workspace
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <a
                href="#features"
                className="inline-flex h-11 items-center rounded-lg border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                See how it works
              </a>
            </div>

            <InboxPreview />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Everything in one place</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From a quick rating to a shipped feature</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-400 dark:group-hover:bg-emerald-500 dark:group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-6 pb-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Start free, upgrade when your team grows</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
            <PricingCard
              name="Starter"
              price="$0"
              period="forever"
              description="For founders and small teams testing the waters."
              features={STARTER_FEATURES}
              cta="Start for free"
            />
            <PricingCard
              name="Team"
              price="$29"
              period="per month"
              description="For teams who want AI insight and a shared roadmap."
              features={TEAM_FEATURES}
              cta="Get Team"
              highlighted
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Customer feedback, turned into insight.</p>
        </div>
      </footer>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  highlighted = false,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl p-8 transition-shadow duration-300 hover:shadow-lg ${
        highlighted
          ? 'bg-zinc-900 text-zinc-100 shadow-xl ring-1 ring-emerald-500/40 dark:bg-zinc-100 dark:text-zinc-900'
          : 'border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        {highlighted && (
          <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-medium text-white">Most popular</span>
        )}
      </div>
      <p className={`mt-2 text-sm ${highlighted ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>{description}</p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        <span className={`text-sm ${highlighted ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'}`}>{period}</span>
      </div>
      <ul className="mt-8 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/auth"
        className={`mt-10 inline-flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
          highlighted
            ? 'bg-emerald-500 text-white hover:bg-emerald-400'
            : 'border border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function InboxPreview() {
  const rows = [
    { name: 'Priya Shah', msg: 'Exporting reports takes forever on large accounts.', tag: 'Bug', tone: 'negative', rating: 2 },
    { name: 'Marcus Webb', msg: 'Would love a Slack digest every Monday morning.', tag: 'Feature request', tone: 'positive', rating: 5 },
    { name: 'Elena Ruiz', msg: 'The new pricing tiers are confusing for agencies.', tag: 'Pricing', tone: 'neutral', rating: 3 },
  ];
  const toneClass: Record<string, string> = {
    positive: 'bg-emerald-500',
    neutral: 'bg-zinc-400',
    negative: 'bg-rose-500',
  };

  return (
    <div className="relative mx-auto mt-16 max-w-4xl" aria-hidden>
      <div className="absolute -inset-x-6 -bottom-6 h-24 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <span className="ml-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Feedback inbox</span>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center gap-4 px-5 py-4">
              <span className={`h-2 w-2 shrink-0 rounded-full ${toneClass[row.tone]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.name}</span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{row.tag}</span>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">{row.msg}</p>
              </div>
              <div className="hidden items-center gap-0.5 sm:flex">
                {[1, 2, 3, 4, 5].map((v) => (
                  <Star key={v} className={`h-3.5 w-3.5 ${v <= row.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-700'}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
