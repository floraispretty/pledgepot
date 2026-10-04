# Running a campaign

1. **Pick the asset.** Stablecoins (USDC) keep the goal meaningful. XLM
   goals move with the price.
2. **Set an honest goal** of the minimum that makes the project happen.
   With all-or-nothing funding, a goal that's too high means everyone
   gets refunded.
3. **Choose a deadline** of 2–6 weeks. Deadlines are Unix timestamps
   compared against the ledger clock.
4. **Share the campaign id.** Backers pledge from any Soroban-capable
   wallet.
5. **After the deadline**, call `claim` if you succeeded. Otherwise backers
   call `refund` themselves; you don't need to do anything.

## Cancelling

If plans change, `cancel` before the deadline opens refunds immediately.
It's a public, on-chain signal that you did right by your backers.
