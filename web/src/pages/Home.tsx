import { useEffect, useState } from "react";
import { scanCampaigns, stateOf, type Campaign } from "../pot";
import { XLM_SAC } from "../lib/stellar";
import { fromUnits, timeLeft } from "../lib/format";
import { Link, useTitle } from "../lib/router";

export function Home() {
  useTitle("pledgepot · all-or-nothing crowdfunding on Stellar");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  useEffect(() => {
    scanCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);
  const featured = campaigns?.find((c) => stateOf(c) === "Open") ?? campaigns?.[0];
  const STATS: [string, string][] = [
    ["Campaigns", campaigns ? String(campaigns.length) : "…"],
    ["Backers", campaigns ? String(campaigns.reduce((n, c) => n + c.backers, 0)) : "…"],
    ["XLM pledged", campaigns ? fromUnits(campaigns.filter((c) => c.token === XLM_SAC).reduce((n, c) => n + c.pledged, 0n)) : "…"],
  ];
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 md:grid-cols-[1.2fr_1fr] md:pt-20">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sage">All-or-nothing crowdfunding on Stellar</p>
          <h1 className="mt-4 text-5xl leading-[1.03] md:text-6xl font-head font-extrabold text-soil">Fund it together, <span className="text-clay">or get every coin back.</span></h1>
          <p className="mt-6 max-w-xl text-lg text-muted">Backers pledge into a smart contract, not into a creator’s wallet. If the goal is met by the deadline the creator claims the pot; if not, every backer takes their pledge back, no permission needed.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className="pill pill-clay inline-block">Browse campaigns →</Link>
            <Link to="/docs" className="pill pill-ghost inline-block">How it works</Link>
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            {STATS.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wider text-muted">{label}</dt>
                <dd className="mt-1 text-2xl font-head font-extrabold text-soil">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="tile p-7">
          {featured ? (
            <>
              <p className="text-xs font-extrabold uppercase tracking-wider text-sage">Featured · {stateOf(featured)}</p>
              <h3 className="mt-2 font-head text-2xl font-extrabold">{featured.title}</h3>
              <div className="mt-5 h-4 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full rounded-full bg-clay"
                  style={{ width: `${Math.min(100, Number((featured.pledged * 100n) / (featured.goal > 0n ? featured.goal : 1n)))}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  <b>{fromUnits(featured.pledged)}</b> <span className="text-muted">of {fromUnits(featured.goal)}</span>
                </span>
                <span className="text-muted">
                  {featured.backers} {featured.backers === 1 ? "backer" : "backers"} · {stateOf(featured) === "Open" ? `ends ${timeLeft(featured.deadline)}` : "closed"}
                </span>
              </div>
              <Link to="/app" className="pill pill-clay mt-6 inline-block">
                See the campaign
              </Link>
            </>
          ) : (
            <p className="text-muted">{campaigns ? "No campaigns yet. Start the first one!" : "Loading campaigns…"}</p>
          )}
        </div>
      </section>

      <section className="border-y-2 border-edge bg-sage-soft">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sage">How it works</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-head font-extrabold text-soil">A pot with two possible endings</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="tile p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold bg-clay text-white">{i + 1}</span>
                <h3 className="mt-4 text-xl font-head font-extrabold text-soil">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sage">Use cases</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-head font-extrabold text-soil">For things that only work if enough people care</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USES.map(([icon, title, body]) => (
            <div key={title} className="tile p-6">
              <span className="text-3xl">{icon}</span>
              <h3 className="mt-3 text-lg font-head font-extrabold text-soil">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sage">Guarantees</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-head font-extrabold text-soil">Nobody has to trust the creator</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROMISES.map(([title, body]) => (
            <div key={title} className="rounded-2xl p-7 bg-soil text-linen">
              <h3 className="text-xl font-head font-extrabold">{title}</h3>
              <p className="mt-2 text-sm text-linen/75">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-20">
        <div className="tile flex flex-col items-start justify-between gap-6 p-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-head font-extrabold text-soil">Got an idea that needs backers?</h2>
            <p className="mt-2 text-muted">Start a campaign in a minute. If it doesn’t fund, nobody loses a coin.</p>
          </div>
          <Link to="/app" className="pill pill-clay inline-block shrink-0">Browse campaigns →</Link>
        </div>
      </section>
    </>
  );
}

const STEPS: [string, string][] = [
  [
    "Start a campaign",
    "Title, goal, token and deadline. The campaign is live as soon as it’s on-chain."
  ],
  [
    "Backers pledge",
    "Pledges sit in the contract. Until the deadline, backers can reduce or withdraw them."
  ],
  [
    "The deadline decides",
    "Goal met: the creator claims everything. Goal missed: each backer refunds their own pledge."
  ]
];

const USES: [string, string, string][] = [
  [
    "🎸",
    "Creative projects",
    "An album, a zine or a short film, made only if the audience shows up."
  ],
  [
    "🏘️",
    "Community projects",
    "A shared tool library or a park clean-up funded by neighbours."
  ],
  [
    "📦",
    "Pre-orders",
    "Manufacture the batch only if the minimum order is reached."
  ],
  [
    "🎉",
    "Group gifts",
    "Chip in for a gift; if it doesn’t come together, everyone is refunded."
  ]
];

const PROMISES: [string, string][] = [
  [
    "Held by code",
    "The creator can’t touch the pledges until the deadline has passed with the goal met."
  ],
  [
    "Refunds without asking",
    "If the campaign fails or is cancelled, every backer reclaims their full pledge themselves."
  ],
  [
    "Transparent progress",
    "Pledged amount, backer count and deadline are public on-chain."
  ]
];
