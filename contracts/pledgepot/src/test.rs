#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::StellarAssetClient,
    Env, String,
};

const DAY: u64 = 86_400;
const NOW: u64 = 1_700_000_000;
const GOAL: i128 = 1_000;

struct Setup<'a> {
    env: Env,
    pot: PledgepotClient<'a>,
    token: Address,
    token_client: token::Client<'a>,
    creator: Address,
    alice: Address,
    bob: Address,
    id: u64,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = NOW);
    let pot = PledgepotClient::new(&env, &env.register(Pledgepot, ()));
    let token = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let mint = StellarAssetClient::new(&env, &token);
    let creator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    mint.mint(&alice, &5_000);
    mint.mint(&bob, &5_000);
    let id = pot.create_campaign(
        &creator,
        &token,
        &GOAL,
        &(NOW + 30 * DAY),
        &String::from_str(&env, "Community solar panels"),
    );
    let token_client = token::Client::new(&env, &token);
    Setup {
        env,
        pot,
        token,
        token_client,
        creator,
        alice,
        bob,
        id,
    }
}

fn after_deadline(s: &Setup) {
    s.env.ledger().with_mut(|l| l.timestamp = NOW + 31 * DAY);
}

#[test]
fn campaign_validation() {
    let s = setup();
    let title = String::from_str(&s.env, "x");
    assert_eq!(
        s.pot
            .try_create_campaign(&s.creator, &s.token, &0, &(NOW + DAY), &title),
        Err(Ok(Error::InvalidCampaign))
    );
    assert_eq!(
        s.pot
            .try_create_campaign(&s.creator, &s.token, &GOAL, &NOW, &title),
        Err(Ok(Error::InvalidCampaign))
    );
    let long = String::from_str(&s.env, &"a".repeat(101));
    assert_eq!(
        s.pot
            .try_create_campaign(&s.creator, &s.token, &GOAL, &(NOW + DAY), &long),
        Err(Ok(Error::TitleTooLong))
    );
}

#[test]
fn pledges_are_held_by_the_contract_not_the_creator() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &400);
    s.pot.pledge(&s.id, &s.alice, &100);
    s.pot.pledge(&s.id, &s.bob, &300);

    let c = s.pot.get_campaign(&s.id);
    assert_eq!(c.pledged, 800);
    assert_eq!(c.backers, 2);
    assert_eq!(s.pot.pledge_of(&s.id, &s.alice), 500);
    assert_eq!(s.token_client.balance(&s.pot.address), 800);
    assert_eq!(s.token_client.balance(&s.creator), 0);
    assert_eq!(s.pot.state(&s.id), State::Open);
}

#[test]
fn successful_campaign_pays_the_creator_once() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &700);
    s.pot.pledge(&s.id, &s.bob, &500); // overfunding is allowed
    after_deadline(&s);

    assert_eq!(s.pot.state(&s.id), State::Succeeded);
    assert_eq!(s.pot.claim(&s.id), 1_200);
    assert_eq!(s.token_client.balance(&s.creator), 1_200);
    assert_eq!(s.pot.state(&s.id), State::Claimed);
    assert_eq!(s.pot.try_claim(&s.id), Err(Ok(Error::NotSucceeded)));
    // Backers of a successful campaign can't refund.
    assert_eq!(s.pot.try_refund(&s.id, &s.alice), Err(Ok(Error::NotFailed)));
}

#[test]
fn creator_cannot_claim_before_the_deadline_even_if_funded() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &GOAL);
    assert_eq!(s.pot.try_claim(&s.id), Err(Ok(Error::NotSucceeded)));
}

#[test]
fn failed_campaign_refunds_every_backer_in_full() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &600);
    s.pot.pledge(&s.id, &s.bob, &300);
    after_deadline(&s);

    assert_eq!(s.pot.state(&s.id), State::Failed);
    assert_eq!(s.pot.try_claim(&s.id), Err(Ok(Error::NotSucceeded)));
    assert_eq!(s.pot.refund(&s.id, &s.alice), 600);
    assert_eq!(s.pot.refund(&s.id, &s.bob), 300);
    assert_eq!(s.token_client.balance(&s.alice), 5_000);
    assert_eq!(s.token_client.balance(&s.bob), 5_000);
    assert_eq!(s.token_client.balance(&s.pot.address), 0);
}

#[test]
fn refunds_cannot_be_taken_twice() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &600);
    after_deadline(&s);
    s.pot.refund(&s.id, &s.alice);
    assert_eq!(
        s.pot.try_refund(&s.id, &s.alice),
        Err(Ok(Error::NothingPledged))
    );
    assert_eq!(
        s.pot.try_refund(&s.id, &s.bob),
        Err(Ok(Error::NothingPledged))
    );
}

#[test]
fn backers_can_withdraw_while_open() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &600);
    s.pot.unpledge(&s.id, &s.alice, &200);
    assert_eq!(s.pot.pledge_of(&s.id, &s.alice), 400);
    s.pot.unpledge(&s.id, &s.alice, &400);

    let c = s.pot.get_campaign(&s.id);
    assert_eq!(c.pledged, 0);
    assert_eq!(c.backers, 0);
    assert_eq!(s.token_client.balance(&s.alice), 5_000);
    assert_eq!(
        s.pot.try_unpledge(&s.id, &s.alice, &1),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn no_pledging_or_withdrawing_after_the_deadline() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &GOAL);
    after_deadline(&s);
    assert_eq!(
        s.pot.try_pledge(&s.id, &s.bob, &10),
        Err(Ok(Error::NotOpen))
    );
    // A backer can't pull out of a campaign that already succeeded.
    assert_eq!(
        s.pot.try_unpledge(&s.id, &s.alice, &10),
        Err(Ok(Error::NotOpen))
    );
}

#[test]
fn cancelling_opens_refunds_immediately() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &GOAL);
    s.pot.cancel(&s.id);

    assert_eq!(s.pot.state(&s.id), State::Failed);
    assert_eq!(s.pot.refund(&s.id, &s.alice), GOAL);
    assert_eq!(s.pot.try_cancel(&s.id), Err(Ok(Error::NotOpen)));
    assert_eq!(
        s.pot.try_pledge(&s.id, &s.bob, &10),
        Err(Ok(Error::NotOpen))
    );
}

#[test]
fn rejects_non_positive_pledges_and_unknown_campaigns() {
    let s = setup();
    assert_eq!(
        s.pot.try_pledge(&s.id, &s.alice, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.pot.try_pledge(&99, &s.alice, &10),
        Err(Ok(Error::CampaignNotFound))
    );
}

#[test]
fn exactly_meeting_the_goal_succeeds() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &GOAL);
    after_deadline(&s);
    assert_eq!(s.pot.state(&s.id), State::Succeeded);
}

#[test]
#[should_panic]
fn only_the_creator_can_claim() {
    let s = setup();
    s.pot.pledge(&s.id, &s.alice, &GOAL);
    after_deadline(&s);
    s.env.set_auths(&[]);
    s.pot.claim(&s.id);
}
