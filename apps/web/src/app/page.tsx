import { Button } from "@universal/ui";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950 p-6">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center text-center gap-8 py-20 px-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-full">
          <span>Milestone 01</span>
          <span>•</span>
          <span>Repository & Tooling Ready</span>
        </div>

        <div className="space-y-4 max-w-xl">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Universal SaaS Platform
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            A production-grade monorepo powered by NestJS, Next.js, TypeScript, PostgreSQL, and pnpm
            workspaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button variant="primary" size="md">
            Get Started
          </Button>
          <Button variant="outline" size="md">
            Documentation
          </Button>
        </div>
      </main>
    </div>
  );
}
