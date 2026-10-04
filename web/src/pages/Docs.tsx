import { CONTRACT_ID } from "../pot";
import { contractLink } from "../lib/stellar";
import { Link, useTitle } from "../lib/router";

const SECTIONS = [
  ["start", "Getting started"],
  ["concepts", "Concepts"],
  ["reference", "Contract reference"],
  ["faq", "FAQ"],
] as const;

export function Docs() {
  useTitle("Docs · pledgepot");
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[210px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1 text-sm">
          <p className="mb-3 px-3 text-xs font-extrabold uppercase tracking-[0.18em] text-sage">On this page</p>
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href="#/docs"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block rounded-lg px-3 py-2 text-soil hover:bg-card"
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 space-y-16">
        <header>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sage">Documentation</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-head font-extrabold text-soil">How pledgepot works</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">A Soroban contract for all-or-nothing crowdfunding: pledges stay in escrow until the deadline decides the outcome.</p>
        </header>

        <section id="start" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-head font-extrabold text-soil">Getting started</h2>
          <ol className="space-y-3">
            {START.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-clay text-white">{i + 1}</span>
                <p className="pt-0.5 text-soil/90">{step}</p>
              </li>
            ))}
          </ol>
          <Link to="/app" className="pill pill-clay inline-block inline-block">Browse campaigns →</Link>
        </section>

        <section id="concepts" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-head font-extrabold text-soil">Concepts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CONCEPTS.map(([term, body]) => (
              <div key={term} className="tile p-5">
                <h3 className="text-lg font-head font-extrabold text-soil">{term}</h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="reference" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-head font-extrabold text-soil">Contract reference</h2>
          <p className="text-muted">
            Deployed on testnet at{" "}
            <a className="break-all font-mono text-sm underline text-clay" href={contractLink(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a>
          </p>
          <div className="tile overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-edge text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="p-3.5">Function</th>
                  <th className="p-3.5">Signed by</th>
                  <th className="p-3.5">What it does</th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE.map(([fn, who, what]) => (
                  <tr key={fn} className="border-t border-edge">
                    <td className="p-3.5 font-mono text-xs text-soil">{fn}</td>
                    <td className="p-3.5 text-muted">{who}</td>
                    <td className="p-3.5 text-muted">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 space-y-3">
          <h2 className="text-3xl font-head font-extrabold text-soil">FAQ</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="tile group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-soil">
                {q}
                <span className="transition group-open:rotate-45 text-clay">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted">{a}</p>
            </details>
          ))}
        </section>
      </article>
    </div>
  );
}

const START: string[] = [
  "Install the Freighter browser wallet, switch it to Testnet and fund the account with test XLM from Friendbot (lab.stellar.org/account/fund).",
  "Creators: choose “Start a campaign”, set a title, goal, token and deadline, and sign.",
  "Backers: open a campaign and pledge. You can reduce or withdraw your pledge while it’s open.",
  "After the deadline, the creator claims a successful campaign, and backers refund a failed or cancelled one."
];

const CONCEPTS: [string, string][] = [
  [
    "Campaign",
    "Creator, token, goal, deadline and title, with running totals of pledges and backers."
  ],
  [
    "States",
    "Open until the deadline, then Succeeded (goal met) or Failed. Claimed once the creator collects."
  ],
  [
    "Pledge",
    "Tokens moved from a backer into the contract, recorded per backer."
  ],
  [
    "Refund",
    "In a failed or cancelled campaign, each backer pulls back exactly what they pledged."
  ]
];

const REFERENCE: [string, string, string][] = [
  [
    "create_campaign(creator, token, goal, deadline, title)",
    "creator",
    "Starts a campaign and returns its id"
  ],
  [
    "pledge(campaign_id, backer, amount)",
    "backer",
    "Adds to a pledge while open"
  ],
  [
    "unpledge(campaign_id, backer, amount)",
    "backer",
    "Reduces a pledge while open"
  ],
  [
    "claim(campaign_id)",
    "creator",
    "Collects a successful campaign"
  ],
  [
    "refund(campaign_id, backer)",
    "backer",
    "Returns a pledge from a failed or cancelled campaign"
  ],
  [
    "cancel(campaign_id)",
    "creator",
    "Cancels the campaign so backers can refund"
  ],
  [
    "state · pledge_of · get_campaign",
    "—",
    "Read state"
  ]
];

const FAQ: [string, string][] = [
  [
    "What if the goal is reached early?",
    "Pledging stays open until the deadline; the outcome is decided when it passes."
  ],
  [
    "Can the creator run off with the money?",
    "Only after the campaign succeeds. Until then the funds are locked in the contract."
  ],
  [
    "What happens if the creator cancels?",
    "The campaign counts as failed and every backer can refund their pledge."
  ],
  [
    "Can I change my pledge?",
    "Yes. While the campaign is open you can add to it or withdraw part or all of it."
  ],
  [
    "Are there fees?",
    "No platform fee, only Stellar network fees."
  ],
  [
    "Is it audited?",
    "Not yet. It runs on Stellar testnet and is open source; treat it as a working prototype until it has been audited."
  ]
];
