import { client, u64 } from "./lib/stellar";

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

export async function scanCampaigns(max = 80): Promise<Campaign[]> {
  const out: Campaign[] = [];
  for (let id = 1; id <= max; id++) {
    try {
      out.push(await pot.read<Campaign>("get_campaign", [u64(id)]));
    } catch {
      break;
    }
  }
  return out.reverse();
}
