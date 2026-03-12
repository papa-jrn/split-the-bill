import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Receipt, Users, Calculator, ArrowRight } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              $
            </div>
            <span className="font-semibold text-lg">Split the Bills</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-balance">
            Split expenses with friends,{" "}
            <span className="text-primary">effortlessly</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
            Keep track of shared expenses, see who owes what, and settle up
            without the awkwardness. Perfect for trips, roommates, and group
            events.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/auth/sign-up">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              Everything you need to split bills
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Create Groups</h3>
                <p className="mt-2 text-muted-foreground">
                  Organize expenses by trip, household, or event. Invite friends
                  by email.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Receipt className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Track Expenses</h3>
                <p className="mt-2 text-muted-foreground">
                  Add expenses as they happen. Record who paid and split among
                  any members.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Calculator className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Settle Up</h3>
                <p className="mt-2 text-muted-foreground">
                  See exactly who owes whom. We calculate the minimum payments
                  needed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Split the Bills - Built with Next.js and Supabase</p>
        </div>
      </footer>
    </div>
  );
}
