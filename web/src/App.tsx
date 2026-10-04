import { useCallback, useEffect, useState } from "react";
import type { xdr } from "@stellar/stellar-sdk";
import { CONTRACT_ID, pot, scanCampaigns, stateOf, type Campaign } from "./pot";
import { addr, contractLink, i128, str, txLink, u64, XLM_SAC } from "./lib/stellar";
import { fromUnits, short, timeLeft, toUnits } from "./lib/format";
import { useWallet } from "./lib/useWallet";
import { useAction } from "./lib/useAction";

type Wallet = ReturnType<typeof useWallet>;
const unit = (t: string) => (t === XLM_SAC ? "XLM" : short(t));

export default function App() {
  const wallet = useWallet();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [openId, setOpenId] = useState<bigint | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => setCampaigns(await scanCampaigns()), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = campaigns?.find((c) => c.id === openId) ?? null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <button className="flex items-center gap-2" onClick={() => (setOpenId(null), setCreating(false))}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} className="h-9 w-9" alt="" />
          <span className="font-head text-2xl font-extrabold text-clay">pledgepot</span>
        </button>
        <div className="flex items-center gap-3">
          <button className="pill pill-ghost hidden sm:block" onClick={() => (setCreating(true), setOpenId(null))}>
            Start a campaign
          </button>
          {wallet.address ? (
            <span className="pill pill-ghost font-mono text-xs">{short(wallet.address)}</span>
          ) : (
            <button className="pill pill-clay" onClick={wallet.connect} disabled={wallet.connecting}>
              {wallet.connecting ? "…" : "Connect"}
            </button>
          )}
        </div>
      </header>
      {wallet.error && <p className="text-center text-sm text-clay">{wallet.error}</p>}

      <main className="mx-auto max-w-6xl px-5 pb-16">
        {creating ? (
          <CreateCampaign wallet={wallet} onCreated={(id) => (refresh(), setCreating(false), setOpenId(id))} />
        ) : open ? (
          <CampaignPage c={open} wallet={wallet} onChange={refresh} onBack={() => setOpenId(null)} />
        ) : (
          <>
            <section className="grid items-center gap-8 py-8 md:grid-cols-[1.3fr_1fr] md:py-14">
              <div>
                <h1 className="font-head text-5xl font-extrabold leading-[1.02] md:text-6xl">
                  Fund it together, <span className="text-clay">or get every coin back.</span>
                </h1>
                <p className="mt-5 max-w-xl text-lg text-muted">
                  All-or-nothing crowdfunding on Stellar. Pledges wait in a smart contract: the creator is paid only if
                  the goal is met by the deadline. Otherwise every backer takes their pledge back, no permission needed.
                </p>
                <div className="mt-7 flex gap-3">
                  <button className="pill pill-clay" onClick={() => setCreating(true)}>
                    Start a campaign
                  </button>
                  <a className="pill pill-ghost" href="#campaigns">
                    Back a project
                  </a>
                </div>
              </div>
              <div className="tile p-6">
                {[
                  ["🪴", "Pledges are held by code", "never by the creator, until the goal is reached."],
                  ["⏳", "Clear deadline", "When the date passes, the outcome is decided automatically."],
                  ["↩️", "Guaranteed refunds", "If it falls short, each backer reclaims their full pledge."],
                ].map(([i, t, d]) => (
                  <div key={t} className="flex gap-3 py-3">
                    <span className="text-2xl">{i}</span>
                    <p>
                      <b>{t}</b> <span className="text-muted">{d}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <h2 id="campaigns" className="font-head text-3xl font-bold">
              Campaigns
            </h2>
            {campaigns === null && <p className="mt-4 text-muted">Loading campaigns…</p>}
            {campaigns?.length === 0 && <p className="tile mt-4 p-8 text-muted">No campaigns yet. Be the first!</p>}
            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {campaigns?.map((c) => (
                <CampaignCard key={String(c.id)} c={c} onOpen={() => setOpenId(c.id)} />
              ))}
            </div>
          </>
        )}
      </main>
      <footer className="border-t-2 border-edge py-6 text-center text-xs text-muted">
        Contract{" "}
        <a className="font-mono underline" href={contractLink(CONTRACT_ID)} target="_blank" rel="noreferrer">
          {short(CONTRACT_ID, 6)}
        </a>{" "}
        · Stellar testnet ·{" "}
        <a className="underline" href="https://github.com/floraispretty/pledgepot" target="_blank" rel="noreferrer">
          Source
        </a>
      </footer>
    </div>
  );
}

const STATE_STYLE: Record<string, string> = {
  Open: "bg-sage-soft text-sage",
  Succeeded: "bg-clay/10 text-clay",
  Failed: "bg-soil/10 text-muted",
  Claimed: "bg-soil text-white",
};

function Progress({ c, big = false }: { c: Campaign; big?: boolean }) {
  const pct = Number((c.pledged * 1000n) / (c.goal || 1n)) / 10;
  return (
    <div>
      <div className={`overflow-hidden rounded-full bg-edge ${big ? "h-5" : "h-3"}`}>
        <div className="h-full rounded-full bg-clay transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span>
          <b className={big ? "font-head text-2xl" : ""}>{fromUnits(c.pledged)}</b> of {fromUnits(c.goal)} {unit(c.token)}
        </span>
        <b className="text-clay">{pct.toFixed(0)}%</b>
      </div>
    </div>
  );
}

function CampaignCard({ c, onOpen }: { c: Campaign; onOpen: () => void }) {
  const state = stateOf(c);
  return (
    <button onClick={onOpen} className="tile flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:border-clay/50">
      <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${STATE_STYLE[state]}`}>{state}</span>
      <h3 className="mt-3 font-head text-xl font-bold leading-snug">{c.title}</h3>
      <div className="mt-auto pt-5">
        <Progress c={c} />
        <p className="mt-2 text-xs text-muted">
          {c.backers} backer{c.backers === 1 ? "" : "s"} · {state === "Open" ? `ends ${timeLeft(c.deadline)}` : `ended ${timeLeft(c.deadline)}`}
        </p>
      </div>
    </button>
  );
}

function Toast({ a }: { a: ReturnType<typeof useAction> }) {
  if (a.error) return <p className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay-dark">{a.error}</p>;
  if (a.notice)
    return (
      <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm">
        {a.notice.text}{" "}
        {a.notice.hash && (
          <a className="underline" href={txLink(a.notice.hash)} target="_blank" rel="noreferrer">
            See transaction
          </a>
        )}
      </p>
    );
  return null;
}

function CampaignPage({ c, wallet, onChange, onBack }: { c: Campaign; wallet: Wallet; onChange: () => void; onBack: () => void }) {
  const state = stateOf(c);
  const [amount, setAmount] = useState("25");
  const [mine, setMine] = useState<bigint>(0n);
  const act = useAction();

  useEffect(() => {
    if (wallet.address) pot.read<bigint>("pledge_of", [u64(c.id), addr(wallet.address)]).then(setMine).catch(() => setMine(0n));
  }, [wallet.address, c]);

  const run = (label: string, method: string, args: (me: string) => xdr.ScVal[], text: string) =>
    act.run(label, async () => {
      const me = wallet.address ?? (await wallet.connect());
      if (!me) throw new Error("Connect a wallet first.");
      const r = await pot.invoke(me, method, args(me));
      onChange();
      return r;
    }, (r) => ({ text, hash: r.hash }));

  const isCreator = wallet.address === c.creator;

  return (
    <div className="py-6">
      <button className="text-sm text-muted underline" onClick={onBack}>
        ← All campaigns
      </button>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="tile p-7">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATE_STYLE[state]}`}>{state}</span>
          <h1 className="mt-4 font-head text-4xl font-extrabold leading-tight">{c.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Started by <span className="font-mono">{short(c.creator, 6)}</span> · campaign #{String(c.id)}
          </p>
          <div className="mt-8">
            <Progress c={c} big />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              [String(c.backers), "backers"],
              [state === "Open" ? timeLeft(c.deadline).replace("in ", "") : "ended", state === "Open" ? "left" : timeLeft(c.deadline)],
              [fromUnits(c.goal), `${unit(c.token)} goal`],
            ].map(([v, k]) => (
              <div key={k} className="rounded-2xl bg-linen p-4">
                <p className="font-head text-2xl font-bold">{v}</p>
                <p className="text-xs text-muted">{k}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="tile space-y-4 p-6">
          {wallet.address && mine > 0n && (
            <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm">
              You've pledged <b>{fromUnits(mine)} {unit(c.token)}</b>
            </p>
          )}
          {state === "Open" && (
            <>
              <h2 className="font-head text-xl font-bold">Back this campaign</h2>
              <div className="flex gap-2">
                {["10", "25", "100"].map((v) => (
                  <button key={v} className={`pill flex-1 ${amount === v ? "pill-sage" : "pill-ghost"}`} onClick={() => setAmount(v)}>
                    {v}
                  </button>
                ))}
              </div>
              <input className="inp" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button
                className="pill pill-clay w-full"
                disabled={!!act.busy}
                onClick={() => run("pledge", "pledge", (me: string) => [u64(c.id), addr(me), i128(toUnits(amount))], `Pledged ${amount} ${unit(c.token)}. Thank you!`)}
              >
                {act.busy === "pledge" ? "Confirm in wallet…" : `Pledge ${amount} ${unit(c.token)}`}
              </button>
              {mine > 0n && (
                <button
                  className="pill pill-ghost w-full"
                  disabled={!!act.busy}
                  onClick={() => run("unpledge", "unpledge", (me: string) => [u64(c.id), addr(me), i128(mine)], "Pledge withdrawn.")}
                >
                  Withdraw my pledge
                </button>
              )}
              {isCreator && (
                <button
                  className="w-full text-sm text-muted underline"
                  onClick={() => confirm("Cancel the campaign? Backers can refund immediately.") && run("cancel", "cancel", () => [u64(c.id)], "Campaign cancelled. Refunds are open.")}
                >
                  Cancel campaign
                </button>
              )}
            </>
          )}
          {state === "Succeeded" && (
            <>
              <h2 className="font-head text-xl font-bold">🎉 Goal reached!</h2>
              {isCreator ? (
                <button className="pill pill-clay w-full" disabled={!!act.busy} onClick={() => run("claim", "claim", () => [u64(c.id)], "Funds claimed.")}>
                  Claim {fromUnits(c.pledged)} {unit(c.token)}
                </button>
              ) : (
                <p className="text-sm text-muted">The creator can now claim the funds.</p>
              )}
            </>
          )}
          {state === "Failed" && (
            <>
              <h2 className="font-head text-xl font-bold">{c.cancelled ? "Cancelled" : "Goal not reached"}</h2>
              <p className="text-sm text-muted">Every backer can take back their full pledge.</p>
              {mine > 0n && (
                <button className="pill pill-clay w-full" disabled={!!act.busy} onClick={() => run("refund", "refund", (me: string) => [u64(c.id), addr(me)], "Refunded.")}>
                  Refund my {fromUnits(mine)} {unit(c.token)}
                </button>
              )}
            </>
          )}
          {state === "Claimed" && <p className="text-sm text-muted">This campaign succeeded and the creator has collected the funds.</p>}
          <Toast a={act} />
        </aside>
      </div>
    </div>
  );
}

function CreateCampaign({ wallet, onCreated }: { wallet: Wallet; onCreated: (id: bigint) => void }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("1000");
  const [days, setDays] = useState(30);
  const [token, setToken] = useState(XLM_SAC);
  const act = useAction();
  return (
    <form
      className="tile mx-auto mt-6 max-w-2xl space-y-5 p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const me = wallet.address ?? (await wallet.connect());
        if (!me) return;
        const r = await act.run(
          "create",
          async () => {
            if (!title.trim()) throw new Error("Give your campaign a title.");
            const deadline = BigInt(Math.floor(Date.now() / 1000) + days * 86_400);
            return pot.invoke<bigint>(me, "create_campaign", [addr(me), addr(token), i128(toUnits(goal)), u64(deadline), str(title.trim())]);
          },
          (res) => ({ text: `Campaign #${res.result} is live!`, hash: res.hash }),
        );
        if (r) setTimeout(() => onCreated(r.result), 1200);
      }}
    >
      <h1 className="font-head text-3xl font-extrabold">Start a campaign</h1>
      <label className="block font-semibold">
        What are you raising for?
        <input className="inp mt-1" maxLength={100} placeholder="e.g. New roof for the community library" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block font-semibold">
          Goal
          <input className="inp mt-1" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <label className="block font-semibold">
          Runs for (days)
          <input className="inp mt-1" type="number" min="1" max="120" value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
      </div>
      <label className="block font-semibold">
        Asset contract <span className="font-normal text-muted">(XLM by default; USDC recommended for stable goals)</span>
        <input className="inp mt-1 font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value.trim())} />
      </label>
      <p className="rounded-2xl bg-sage-soft p-4 text-sm">
        If you reach the goal in time, you claim everything pledged. If not, backers refund themselves. Set the
        smallest goal that makes the project happen.
      </p>
      <button className="pill pill-clay w-full" disabled={!!act.busy}>
        {act.busy ? "Confirm in wallet…" : "Launch campaign"}
      </button>
      <Toast a={act} />
    </form>
  );
}
