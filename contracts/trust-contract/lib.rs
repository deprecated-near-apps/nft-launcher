use borsh::{ BorshDeserialize, BorshSerialize };
use near_sdk::{
    env, near_bindgen, AccountId, Balance, Promise,
    collections::{ UnorderedMap },
    json_types::{ U128 },
};

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Trust {
    pub owner_id: AccountId,
    pub balances: UnorderedMap<AccountId, Balance>,
}

impl Default for Trust {
    fn default() -> Self {
        panic!("should be initialized before usage")
    }
}

#[near_bindgen]
impl Trust {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        assert!(env::is_valid_account_id(owner_id.as_bytes()), "Owner's account ID is invalid.");
        assert!(!env::state_exists(), "Already initialized");
        Self {
            owner_id,
            balances: UnorderedMap::new(b"balances".to_vec()),
        }
    }

    #[payable]
    pub fn deposit(&mut self) {
        let deposit = env::attached_deposit();
        let account_id = env::signer_account_id();
        let mut balance = self.balances.get(&account_id).unwrap_or(0);
        balance += deposit;
        self.balances.insert(&account_id, &balance);
    }

    pub fn withdraw(&mut self, amount: U128) {
        let amount_u128 = amount.into();
        let account_id = env::signer_account_id();
        let mut balance = self.balances.get(&account_id).unwrap_or(0);
        assert!(balance >= amount_u128, "not enough tokens");
        assert!(env::account_balance() >= balance, "missing funds");
        balance -= amount_u128;
        self.balances.insert(&account_id, &balance);
        Promise::new(account_id).transfer(balance);
    }

    pub fn get_balance(&self, account_id: AccountId) -> U128 {
        self.balances.get(&account_id).unwrap_or(0).into()
    }
}

// use the attribute below for unit tests
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, VMContext};
    
    fn ntoy(near_amount: u128) -> U128 {
        U128(near_amount * 10u128.pow(24))
    }

    fn get_context() -> VMContext {
        VMContext {
            predecessor_account_id: "alice.testnet".to_string(),
            current_account_id: "alice.testnet".to_string(),
            signer_account_id: "bob.testnet".to_string(),
            signer_account_pk: vec![0, 1, 2],
            input: vec![],
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view: false,
            output_data_receivers: vec![],
            epoch_height: 19,
            storage_usage: 0,
        }
    }

    #[test]
    fn deposit() {
        let mut context = get_context();
        testing_env!(context.clone());
        let mut contract = Trust::new(context.current_account_id.clone());

        context.attached_deposit = ntoy(1000).into();
        testing_env!(context.clone());

        contract.deposit();
        let balance = contract.get_balance(context.signer_account_id.clone());

        assert_eq!(balance, ntoy(1000));
    }

    #[test]
    fn withdraw() {
        let mut context = get_context();
        testing_env!(context.clone());
        let mut contract = Trust::new(context.current_account_id.clone());

        context.attached_deposit = ntoy(1000).into();
        testing_env!(context.clone());

        contract.deposit();
        let balance = contract.get_balance(context.signer_account_id.clone());

        assert_eq!(balance, ntoy(1000));

        contract.withdraw(ntoy(1000));
        let balance = contract.get_balance(context.signer_account_id.clone());

        assert_eq!(balance, U128(0));
    }

    #[test]
    #[should_panic(
        expected = r#"not enough tokens"#
    )]
    fn should_panic_withdraw() {
        let mut context = get_context();
        testing_env!(context.clone());
        let mut contract = Trust::new(context.current_account_id.clone());

        context.attached_deposit = ntoy(1000).into();
        testing_env!(context.clone());

        contract.deposit();
        let balance = contract.get_balance(context.signer_account_id.clone());

        assert_eq!(balance, ntoy(1000));

        contract.withdraw(ntoy(2000));
        let balance = contract.get_balance(context.signer_account_id.clone());

        assert_eq!(balance, U128(0));
    }
}