use borsh::{ BorshDeserialize, BorshSerialize };
use near_sdk::{
    env, near_bindgen, AccountId, PublicKey, Promise,
    collections::{ UnorderedMap },
    json_types::{ U128, Base58PublicKey },
};
use serde::Serialize;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[near_bindgen]

#[derive(Debug, Serialize, BorshDeserialize, BorshSerialize)]
pub struct MessageForSale {
    pub owner: AccountId,
    pub message: String,
    pub amount: U128,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Messages {
    pub owner_id: AccountId,
    pub messages: UnorderedMap<PublicKey, MessageForSale>,
}

impl Default for Messages {
    fn default() -> Self {
        panic!("Should be initialized before usage")
    }
}

#[near_bindgen]
impl Messages {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        assert!(env::is_valid_account_id(owner_id.as_bytes()), "Invalid owner account");
        assert!(!env::state_exists(), "Already initialized");
        Self {
            owner_id,
            messages: UnorderedMap::new(b"messages".to_vec()),
        }
    }

    pub fn create(&mut self, message: String, amount: U128, owner: AccountId) {
        let signer_pk = env::signer_account_pk();
        assert!(self.messages.get(&signer_pk).is_none(), "Message exists");
        self.messages.insert(&signer_pk, &MessageForSale {
            owner,
            message,
            amount,
        });
    }

    #[payable]
    pub fn purchase(&mut self, public_key: Base58PublicKey) -> MessageForSale {
        let deposit = env::attached_deposit();
        let pk: PublicKey = public_key.into();
        let message = self.messages.get(&pk).expect("No message");
        assert!(deposit == message.amount.clone().into(), "Not enough tokens");
        self.messages.remove(&pk);
        Promise::new(message.owner.clone()).transfer(deposit);
        message
    }

    pub fn get_message(&self, public_key: Base58PublicKey) -> MessageForSale {
        self.messages.get(&public_key.into()).expect("No message")
    }
}

// use the attribute below for unit tests
#[cfg(test)]
mod tests {
    use super::*;
    use std::convert::TryFrom;
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
            signer_account_pk: vec![0],
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
            storage_usage: 1000
        }
    }

    #[test]
    fn create() {
        let mut context = get_context();
        context.signer_account_pk = Base58PublicKey::try_from("ed25519:Eg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap().into();
        testing_env!(context.clone());
        let mut contract = Messages::new(context.current_account_id.clone());
        contract.create("hello world!".to_string(), ntoy(10), "alice.testnet".to_string());
        let message = contract.get_message(Base58PublicKey::try_from("Eg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap());
        assert_eq!(message.message, "hello world!");
    }

    #[test]
    fn purchase() {
        let mut context = get_context();
        context.signer_account_pk = Base58PublicKey::try_from("ed25519:Eg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap().into();
        testing_env!(context.clone());
        let mut contract = Messages::new(context.current_account_id.clone());
        contract.create("hello world!".to_string(), ntoy(10), "alice.testnet".to_string());
        context.signer_account_pk = Base58PublicKey::try_from("ed25519:Bg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap().into();
        context.account_balance = ntoy(1000).into();
        context.attached_deposit = ntoy(10).into();
        testing_env!(context.clone());
        let message = contract.purchase(Base58PublicKey::try_from("ed25519:Eg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap());
        assert_eq!(message.message, "hello world!");
    }

    #[test]
    #[should_panic(
        expected = r#"Message exists"#
    )]
    fn panic_create() {
        let mut context = get_context();
        context.signer_account_pk = Base58PublicKey::try_from("ed25519:Eg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap().into();
        testing_env!(context.clone());
        let mut contract = Messages::new(context.current_account_id.clone());
        contract.create("hello world!".to_string(), ntoy(10), "alice.testnet".to_string());
        contract.create("hello world!".to_string(), ntoy(10), "alice.testnet".to_string());
    }
    
    #[test]
    #[should_panic(
        expected = r#"No message"#
    )]
    fn panic_purchase() {
        let mut context = get_context();
        context.signer_account_pk = Base58PublicKey::try_from("ed25519:Eg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap().into();
        testing_env!(context.clone());
        let mut contract = Messages::new(context.current_account_id.clone());
        contract.create("hello world!".to_string(), ntoy(10), "alice.testnet".to_string());
        context.signer_account_pk = vec![4,5,6];
        context.account_balance = ntoy(1000).into();
        context.attached_deposit = ntoy(10).into();
        testing_env!(context.clone());
        contract.purchase(Base58PublicKey::try_from("ed25519:Bg2jtsiMrprn7zgKKUk79qM1hWhANsFyE6JSX4txLEuy").unwrap());
    }
}