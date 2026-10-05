import { nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { client, server, u64 } from "./lib/stellar";

export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? "CDI4JFTANNO5JOUSMEZWWN5AUKGOYVARRBN7AR3FNCLHYFPEDNSJAPJA";
export const ERRORS: Record<number, string> = {
  1: "No campaign with that id.",
  2: "Set a goal above zero and a deadline in the future.",
  3: "Enter an amount above zero (and no more than you pledged).",
  4: "This campaign isn't open for pledges any more.",
  5: "The campaign hasn't succeeded (yet).",
  6: "Refunds open only if the campaign misses its goal or is cancelled.",
  7: "You have nothing pledged to this campaign.",
  8: "Keep the title under 100 characters.",
};
export const pot = client(CONTRACT_ID, ERRORS);

export interface Campaign {
  id: bigint;
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  pledged: bigint;
  backers: number;
  title: string;
  cancelled: boolean;
  claimed: boolean;
}

export const STATES = ["Open", "Succeeded", "Failed", "Claimed"] as const;

/** Mirrors the contract's derived state. */
export function stateOf(c: Campaign, now = Date.now() / 1000): (typeof STATES)[number] {
  if (c.claimed) return "Claimed";
  if (c.cancelled) return "Failed";
  if (now < Number(c.deadline)) return "Open";
  return c.pledged >= c.goal ? "Succeeded" : "Failed";
}

const getCampaign = (id: number) => pot.read<Campaign>("get_campaign", [u64(id)]);

/**
 * Newest first. Uses campaign_count with parallel batches when available;
 * older deployments fall back to probing ids until the first gap.
 */
export async function scanCampaigns(batch = 10): Promise<Campaign[]> {
  const out: Campaign[] = [];
  let count: number | null = null;
  try {
    count = Number(await pot.read<bigint>("campaign_count"));
  } catch {
    count = null;
  }
  if (count !== null) {
    for (let start = 1; start <= count; start += batch) {
      const ids = Array.from({ length: Math.min(batch, count - start + 1) }, (_, i) => start + i);
      const got = await Promise.allSettled(ids.map(getCampaign));
      for (const r of got) if (r.status === "fulfilled") out.push(r.value);
    }
    return out.reverse();
  }
  for (let id = 1; ; id++) {
    try {
      out.push(await getCampaign(id));
    } catch {
      break;
    }
  }
  return out.reverse();
}

/** The creator's link, or null. `supported` is false on deployments without `link`. */
export async function campaignLink(id: bigint): Promise<{ supported: boolean; url: string | null }> {
  try {
    return { supported: true, url: (await pot.read<string | null>("link", [u64(id)])) ?? null };
  } catch {
    return { supported: false, url: null };
  }
}

export interface PledgeEvent {
  backer: string;
  amount: bigint;
  ledger: number;
}

/**
 * Recent pledges from contract events. RPC nodes only keep about a week of
 * events, so this is "recent", not the full history.
 */
export async function recentPledges(id: bigint): Promise<PledgeEvent[]> {
  const latest = (await server.getLatestLedger()).sequence;
  const topic = (v: Parameters<typeof nativeToScVal>[0], type: string) => nativeToScVal(v, { type }).toXDR("base64");
  const filters = [
    { type: "contract" as const, contractIds: [CONTRACT_ID], topics: [[topic("pot", "symbol"), topic("pledged", "symbol"), topic(id, "u64")]] },
  ];
  // Each request only scans a slice of ledgers, so follow the cursor across the week.
  const found: PledgeEvent[] = [];
  let res = await server.getEvents({ startLedger: Math.max(1, latest - 17_280 * 7 + 100), filters, limit: 100 });
  for (let page = 0; page < 20; page++) {
    for (const e of res.events) {
      const v = scValToNative(e.value) as { backer: string; amount: bigint };
      found.push({ backer: v.backer, amount: BigInt(v.amount), ledger: e.ledger });
    }
    const next = await server.getEvents({ cursor: res.cursor, filters, limit: 100 });
    if (next.cursor === res.cursor) break;
    res = next;
  }
  return found.reverse();
}
