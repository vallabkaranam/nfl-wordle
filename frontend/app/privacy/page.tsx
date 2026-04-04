import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Roster Riddle",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="text-emerald-400 uppercase tracking-[0.2em] text-xs font-black">
          Back To Puzzle
        </Link>
        <h1 className="text-4xl font-black uppercase italic">Privacy Policy</h1>
        <p className="text-zinc-400">Last updated April 4, 2026.</p>
        <p>
          Roster Riddle stores puzzle progress, streaks, and recent game history in your browser so you can return to the daily game without
          losing progress. We also collect lightweight anonymous event data such as session starts, guesses, wins, losses, and shares to
          understand whether the product is healthy.
        </p>
        <p>
          We do not require an account, and we do not intentionally collect sensitive personal information. If you contact us directly, your
          email and message content may be retained for support and operational follow-up.
        </p>
        <p>
          If this project adds third-party analytics, ads, or accounts later, this policy should be updated before those features go live.
        </p>
      </div>
    </main>
  );
}
