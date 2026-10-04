import { describe, expect, it } from "vitest";
import { stateOf, type Campaign } from "./pot";

const base: Campaign = {
  id: 1n, creator: "G", token: "C", goal: 100n, deadline: 1_000n, pledged: 0n,
  backers: 0, title: "t", cancelled: false, claimed: false,
};

describe("stateOf mirrors the contract", () => {
  it("is open before the deadline", () => expect(stateOf(base, 999)).toBe("Open"));
  it("succeeds at or above goal after the deadline", () => expect(stateOf({ ...base, pledged: 100n }, 1_000)).toBe("Succeeded"));
  it("fails below goal or when cancelled", () => {
    expect(stateOf({ ...base, pledged: 99n }, 2_000)).toBe("Failed");
    expect(stateOf({ ...base, cancelled: true }, 10)).toBe("Failed");
  });
  it("reports claimed campaigns", () => expect(stateOf({ ...base, claimed: true }, 0)).toBe("Claimed"));
});
