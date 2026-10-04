#![no_std]

//! Pledgepot: all-or-nothing crowdfunding on Stellar.
//!
//! A creator opens a campaign with a funding goal, an asset and a deadline.
//! Backers pledge before the deadline; their tokens are held by the
//! contract, not the creator. When the deadline passes:
//!
//! - **Goal met**: the creator claims everything pledged.
//! - **Goal missed**: every backer takes back exactly what they pledged.
//!
//! There is no state in which a creator walks away with a partially
//! funded campaign, or in which a backer's refund depends on the creator.
//! Backers can also change their mind and withdraw a pledge before the
//! deadline, and a creator can cancel early, which opens refunds at once.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum State {
    /// Accepting pledges (before the deadline, not cancelled).
    Open = 0,
    /// Deadline passed with the goal met; creator may claim.
    Succeeded = 1,
    /// Deadline passed below goal, or cancelled; backers may refund.
    Failed = 2,
    /// Creator has claimed the funds.
    Claimed = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u64,
    pub creator: Address,
    pub token: Address,
    pub goal: i128,
    pub deadline: u64,
    pub pledged: i128,
    pub backers: u32,
    pub title: String,
    pub cancelled: bool,
    pub claimed: bool,
}

#[contracttype]
pub enum DataKey {
    NextId,
    Campaign(u64),
    Pledge(u64, Address),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    CampaignNotFound = 1,
    InvalidCampaign = 2,
    InvalidAmount = 3,
    NotOpen = 4,
    NotSucceeded = 5,
    NotFailed = 6,
    NothingPledged = 7,
    TitleTooLong = 8,
}

#[contractevent(topics = ["pot", "created"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Created {
    pub campaign_id: u64,
}

#[contractevent(topics = ["pot", "pledged"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Pledged {
    #[topic]
    pub campaign_id: u64,
    pub backer: Address,
    pub amount: i128,
}

#[contractevent(topics = ["pot", "unpledged"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unpledged {
    #[topic]
    pub campaign_id: u64,
    pub backer: Address,
    pub amount: i128,
}

#[contractevent(topics = ["pot", "claimed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claimed {
    #[topic]
    pub campaign_id: u64,
    pub amount: i128,
}

#[contractevent(topics = ["pot", "refunded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Refunded {
    #[topic]
    pub campaign_id: u64,
    pub backer: Address,
    pub amount: i128,
}

#[contractevent(topics = ["pot", "cancelled"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CancelledEvent {
    pub campaign_id: u64,
}

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 180 * DAY_IN_LEDGERS;
pub const MAX_TITLE_LEN: u32 = 100;

#[contract]
pub struct Pledgepot;

#[contractimpl]
impl Pledgepot {
    pub fn create_campaign(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        title: String,
    ) -> Result<u64, Error> {
        creator.require_auth();
        if goal <= 0 || deadline <= env.ledger().timestamp() {
            return Err(Error::InvalidCampaign);
        }
        if title.len() > MAX_TITLE_LEN {
            return Err(Error::TitleTooLong);
        }
        let id = next_id(&env);
        let campaign = Campaign {
            id,
            creator,
            token,
            goal,
            deadline,
            pledged: 0,
            backers: 0,
            title,
            cancelled: false,
            claimed: false,
        };
        save(&env, &campaign);
        Created { campaign_id: id }.publish(&env);
        Ok(id)
    }

    pub fn pledge(env: Env, campaign_id: u64, backer: Address, amount: i128) -> Result<(), Error> {
        backer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut campaign = Self::get_campaign(env.clone(), campaign_id)?;
        if state(&env, &campaign) != State::Open {
            return Err(Error::NotOpen);
        }

        token::Client::new(&env, &campaign.token).transfer(
            &backer,
            env.current_contract_address(),
            &amount,
        );

        let previous = pledge_of(&env, campaign_id, &backer);
        if previous == 0 {
            campaign.backers += 1;
        }
        set_pledge(&env, campaign_id, &backer, previous + amount);
        campaign.pledged += amount;
        save(&env, &campaign);
        Pledged {
            campaign_id,
            backer,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Withdraw part or all of a pledge while the campaign is still open.
    pub fn unpledge(
        env: Env,
        campaign_id: u64,
        backer: Address,
        amount: i128,
    ) -> Result<(), Error> {
        backer.require_auth();
        let mut campaign = Self::get_campaign(env.clone(), campaign_id)?;
        if state(&env, &campaign) != State::Open {
            return Err(Error::NotOpen);
        }
        let current = pledge_of(&env, campaign_id, &backer);
        if amount <= 0 || amount > current {
            return Err(Error::InvalidAmount);
        }

        let remaining = current - amount;
        set_pledge(&env, campaign_id, &backer, remaining);
        if remaining == 0 {
            campaign.backers -= 1;
        }
        campaign.pledged -= amount;
        save(&env, &campaign);
        token::Client::new(&env, &campaign.token).transfer(
            &env.current_contract_address(),
            &backer,
            &amount,
        );
        Unpledged {
            campaign_id,
            backer,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Creator collects the funds of a successful campaign. Once.
    pub fn claim(env: Env, campaign_id: u64) -> Result<i128, Error> {
        let mut campaign = Self::get_campaign(env.clone(), campaign_id)?;
        campaign.creator.require_auth();
        if state(&env, &campaign) != State::Succeeded {
            return Err(Error::NotSucceeded);
        }
        campaign.claimed = true;
        save(&env, &campaign);
        token::Client::new(&env, &campaign.token).transfer(
            &env.current_contract_address(),
            &campaign.creator,
            &campaign.pledged,
        );
        Claimed {
            campaign_id,
            amount: campaign.pledged,
        }
        .publish(&env);
        Ok(campaign.pledged)
    }

    /// Backer takes back their full pledge from a failed or cancelled campaign.
    pub fn refund(env: Env, campaign_id: u64, backer: Address) -> Result<i128, Error> {
        backer.require_auth();
        let campaign = Self::get_campaign(env.clone(), campaign_id)?;
        if state(&env, &campaign) != State::Failed {
            return Err(Error::NotFailed);
        }
        let amount = pledge_of(&env, campaign_id, &backer);
        if amount == 0 {
            return Err(Error::NothingPledged);
        }
        set_pledge(&env, campaign_id, &backer, 0);
        token::Client::new(&env, &campaign.token).transfer(
            &env.current_contract_address(),
            &backer,
            &amount,
        );
        Refunded {
            campaign_id,
            backer,
            amount,
        }
        .publish(&env);
        Ok(amount)
    }

    /// Creator calls the campaign off before its deadline; refunds open now.
    pub fn cancel(env: Env, campaign_id: u64) -> Result<(), Error> {
        let mut campaign = Self::get_campaign(env.clone(), campaign_id)?;
        campaign.creator.require_auth();
        if state(&env, &campaign) != State::Open {
            return Err(Error::NotOpen);
        }
        campaign.cancelled = true;
        save(&env, &campaign);
        CancelledEvent { campaign_id }.publish(&env);
        Ok(())
    }

    pub fn state(env: Env, campaign_id: u64) -> Result<State, Error> {
        let campaign = Self::get_campaign(env.clone(), campaign_id)?;
        Ok(state(&env, &campaign))
    }

    pub fn pledge_of(env: Env, campaign_id: u64, backer: Address) -> i128 {
        pledge_of(&env, campaign_id, &backer)
    }

    pub fn get_campaign(env: Env, campaign_id: u64) -> Result<Campaign, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .ok_or(Error::CampaignNotFound)
    }
}

fn state(env: &Env, c: &Campaign) -> State {
    if c.claimed {
        State::Claimed
    } else if c.cancelled {
        State::Failed
    } else if env.ledger().timestamp() < c.deadline {
        State::Open
    } else if c.pledged >= c.goal {
        State::Succeeded
    } else {
        State::Failed
    }
}

fn pledge_of(env: &Env, id: u64, backer: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Pledge(id, backer.clone()))
        .unwrap_or(0)
}

fn set_pledge(env: &Env, id: u64, backer: &Address, amount: i128) {
    let key = DataKey::Pledge(id, backer.clone());
    if amount == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &amount);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
    }
}

fn save(env: &Env, c: &Campaign) {
    let key = DataKey::Campaign(c.id);
    env.storage().persistent().set(&key, c);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
}

fn next_id(env: &Env) -> u64 {
    let next: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextId)
        .unwrap_or(0u64)
        + 1;
    env.storage().instance().set(&DataKey::NextId, &next);
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    next
}

mod test;
