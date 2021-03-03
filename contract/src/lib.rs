use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::wee_alloc;
use near_sdk::{env, near_bindgen, Balance, Gas, AccountId, ext_contract, Promise, PromiseResult, PromiseOrValue};
use near_sdk::json_types::U128;
use std::collections::HashMap;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

const BASE_GAS: Gas = 25_000_000_000_000;
const NO_DEPOSIT: Balance = 0;

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct Matryoshka {
    records: HashMap<String, String>,
}

#[ext_contract(bridge_token)]
pub trait ExtBridgeToken {
    fn get_balance(&self, owner_id: AccountId) -> U128;
    fn get_allowance(&self, owner_id: AccountId, escrow_account_id: AccountId) -> U128;
    fn transfer(&self, new_owner_id: AccountId, amount: U128);
    fn transfer_from(&self, owner_id: AccountId, new_owner_id: AccountId, amount: U128);
    fn inc_allowance(&self, escrow_account_id: AccountId, amount: U128);
}

#[ext_contract(ext_self)]
pub trait ExtMatryoshka {
    fn on_farm(&mut self, amount: U128, contract_address: AccountId, receiver: AccountId);
}

fn is_promise_success() -> bool {
    assert_eq!(
        env::promise_results_count(),
        1,
        "Contract expected a result on the callback"
    );
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}

#[near_bindgen]
impl Matryoshka {
    pub fn get_balance(&self, account_id: AccountId, contract_address: AccountId) -> Promise {
        bridge_token::get_balance(
            account_id,
            &contract_address,
            NO_DEPOSIT,
            BASE_GAS)
    }

    pub fn get_allowance(&self, account_id: AccountId, contract_address: AccountId) -> Promise {
        bridge_token::get_allowance(
            account_id,
            contract_address.clone(),
            &contract_address,
            NO_DEPOSIT,
            BASE_GAS)
    }

    #[payable]
    pub fn airdrop(&mut self, amount: U128, contract_address: AccountId) -> Promise {
        env::log(format!("@{} is farming on {} with {}",
                         env::predecessor_account_id(), contract_address, env::current_account_id()).as_bytes());

        bridge_token::transfer(
            env::predecessor_account_id(),
            amount,
            &contract_address,
            NO_DEPOSIT,
            BASE_GAS)
    }

    #[payable]
    pub fn farm(&mut self, amount: U128, contract_address: AccountId) -> PromiseOrValue<bool> {
        let current_user = env::signer_account_id();
        let current_contract = env::current_account_id();
        env::log(format!("@{} is farming on {} with {}",
                         current_user, contract_address, current_contract).as_bytes());

        PromiseOrValue::Promise(
            bridge_token::transfer_from(
                current_user.clone(),
                current_contract.clone(),
                amount,
                &contract_address,
                NO_DEPOSIT,
                BASE_GAS).then(
                ext_self::on_farm(
                    amount,
                    contract_address,
                    current_user,
                    &current_contract,
                    NO_DEPOSIT,
                    BASE_GAS * 2,
                )))
    }

    pub fn do_yield_farming(&self, amount: U128) -> U128 {
        (amount.0 * 2).into()
    }

    pub fn on_farm(&mut self, amount: U128, contract_address: AccountId, receiver: AccountId) -> PromiseOrValue<bool> {
        let deposit_succeeded = is_promise_success();
        if !deposit_succeeded {
            env::log(format!("Deposit failed").as_bytes());
            PromiseOrValue::Value(false)
        } else {
            let new_amount = self.do_yield_farming(amount);

            PromiseOrValue::Promise(
                bridge_token::transfer_from(
                    env::current_account_id(),
                    receiver,
                    new_amount,
                    &contract_address,
                    NO_DEPOSIT,
                    BASE_GAS))
        }
    }
}

/*
 * The rest of this file holds the inline tests for the code above
 * Learn more about Rust tests: https://doc.rust-lang.org/book/ch11-01-writing-tests.html
 *
 * To run from contract directory:
 * cargo test -- --nocapture
 *
 * From project root, to run in combination with frontend tests:
 * yarn test
 *
 */
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, VMContext};

    // mock the context for testing, notice "signer_account_id" that was accessed above from env::
    fn get_context(input: Vec<u8>, is_view: bool) -> VMContext {
        VMContext {
            current_account_id: "alice_near".to_string(),
            signer_account_id: "bob_near".to_string(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id: "carol_near".to_string(),
            input,
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 0,
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view,
            output_data_receivers: vec![],
            epoch_height: 19,
        }
    }

    #[test]
    fn set_then_get_greeting() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = Matryoshka::default();
        contract.set_greeting("howdy".to_string());
        assert_eq!(
            "howdy".to_string(),
            contract.get_greeting("bob_near".to_string())
        );
    }

    #[test]
    fn get_default_greeting() {
        let context = get_context(vec![], true);
        testing_env!(context);
        let contract = Matryoshka::default();
        // this test did not call set_greeting so should return the default "Hello" greeting
        assert_eq!(
            "Hello".to_string(),
            contract.get_greeting("francis.near".to_string())
        );
    }
}
