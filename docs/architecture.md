# Architecture

## Derived state

Pledgepot stores facts, not a status field:

```text
Campaign { creator, token, goal, deadline, pledged, backers, title, cancelled, claimed }
Pledge(campaign_id, backer) → i128
```

State is computed on every call:

```text
claimed               → Claimed
cancelled             → Failed
now < deadline        → Open
pledged ≥ goal        → Succeeded
otherwise             → Failed
```

Nobody ever has to "finalize" a campaign, and no state is reachable in
which funds are stuck waiting for an admin.

## Money flow

- `pledge`: backer → contract
- `unpledge` (while Open): contract → backer
- `claim` (Succeeded, once): contract → creator, everything pledged
- `refund` (Failed, once per backer): contract → backer, their full pledge

Pledges are tracked per backer, so refunds are exact. There's no pro-rata
rounding and no shared refund pool.

## Overfunding

Pledging past the goal is allowed until the deadline, and the creator
receives everything. Creators who want a hard cap can cancel and relaunch,
or a future version can add `max_raise`.
