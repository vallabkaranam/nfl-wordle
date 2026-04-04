import Link from "next/link";

export const metadata = {
  title: "Terms | Roster Riddle",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="text-emerald-400 uppercase tracking-[0.2em] text-xs font-black">
          Back To Puzzle
        </Link>
        <h1 className="text-4xl font-black uppercase italic">Terms Of Use</h1>
        <p className="text-zinc-400">Last updated April 4, 2026.</p>
        <p>
          Roster Riddle is provided on an “as is” basis for entertainment purposes. The service may change, pause, or disappear without notice.
          You agree not to misuse the site, attempt to disrupt the service, or present the game as an official league, team, or publisher
          product.
        </p>
        <p>
          This project is an unofficial pro football guessing game. Any future commercial launch should be reviewed for branding, data rights,
          sponsorship, and licensing before monetization or broad promotion.
        </p>
        <p>
          By using the service, you agree that your sole remedy for dissatisfaction is to stop using it. If you need support, policy changes, or
          takedown requests, provide a public support contact before launch.
        </p>
      </div>
    </main>
  );
}
