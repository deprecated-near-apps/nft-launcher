use std::collections::HashSet;

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, UnorderedSet};
use near_sdk::json_types::{U128, ValidAccountId, Base58PublicKey};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, ext_contract, near_bindgen, Gas, PublicKey, AccountId, Balance, PanicOnDefault, Promise, PromiseResult, StorageUsage};

use crate::internal::*;
pub use crate::mint::*;
pub use crate::nft_core::*;

mod internal;
mod mint;
mod nft_core;

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

const ON_CALLBACK_GAS: u64 = 20_000_000_000_000;
const GAS_FOR_MARKET_CALL: Gas = 25_000_000_000_000;
const NO_DEPOSIT: Balance = 0;
const GUEST_STRING_LENGTH_LIMIT: usize = 256;
const GUEST_MINT_LIMIT: u8 = 3;
const MAX_MARKET_DEPOSIT: u128 = 100_000_000_000_000_000_000_000;
const ACCESS_KEY_ALLOWANCE: u128 = 100_000_000_000_000_000_000_000;
const SPONSOR_FEE: u128 = 100_000_000_000_000_000_000_000;
pub type TokenId = String;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    pub owner_id: AccountId,
    pub metadata: String,
    pub approved_account_ids: HashSet<AccountId>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Guest {
    pub account_id: AccountId,
    pub mints: u8,
    pub balance: U128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct GuestSale {
    pub public_key: PublicKey,
    pub price: Balance,
    pub deposit: Balance,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    /// standard fields (draft)
    pub tokens_per_owner: LookupMap<AccountId, UnorderedSet<TokenId>>,

    pub tokens_by_id: UnorderedMap<TokenId, Token>,

    pub owner_id: AccountId,

    pub total_supply: u64,

    /// The storage size in bytes for one account.
    pub extra_storage_in_bytes_per_token: StorageUsage,

    /// custom fields for guests and example app (with no backend need to store list of tokens)
    pub guests: LookupMap<PublicKey, Guest>,
    pub guest_sales: LookupMap<TokenId, GuestSale>,
    /// this is lazy, could also store list of owners and query tokens_per_owner for each owner
    pub token_ids: Vec<TokenId>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: ValidAccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        let mut this = Self {
            tokens_per_owner: LookupMap::new(b"a".to_vec()),
            tokens_by_id: UnorderedMap::new(b"t".to_vec()),
            guests: LookupMap::new(b"g".to_vec()),
            guest_sales: LookupMap::new(b"m".to_vec()),
            owner_id: owner_id.into(),
            token_ids: Vec::new(),
            total_supply: 0,
            extra_storage_in_bytes_per_token: 0,
        };
        this.measure_min_token_storage_cost();
        this
    }

    fn measure_min_token_storage_cost(&mut self) {
        let initial_storage_usage = env::storage_usage();
        let tmp_account_id = "a".repeat(64);
        let u = UnorderedSet::new(unique_prefix(&tmp_account_id));
        self.tokens_per_owner.insert(&tmp_account_id, &u);

        let tokens_per_owner_entry_in_bytes = env::storage_usage() - initial_storage_usage;
        let owner_id_extra_cost_in_bytes = (tmp_account_id.len() - self.owner_id.len()) as u64;

        self.extra_storage_in_bytes_per_token =
            tokens_per_owner_entry_in_bytes + owner_id_extra_cost_in_bytes;

        self.tokens_per_owner.remove(&tmp_account_id);
    }

    /// non-standard methods for guest and free mint/approval management

    /// guest mint restricts token ID and metadata size 
    /// contract needs to know upper bound of storage it will sponsor
    /// guests are limited mints and approvals
    pub fn nft_mint_guest(&mut self, token_id: TokenId, metadata: String) {
        assert!(
            token_id.len() < GUEST_STRING_LENGTH_LIMIT,
            "Token ID too long for guest mint"
        );
        assert!(
            metadata.len() < GUEST_STRING_LENGTH_LIMIT,
            "Metadata too long for guest mint"
        );
        let guest = self.admin_guest(1);
        let owner_id = guest.account_id;
        let token = Token {
            owner_id,
            metadata,
            approved_account_ids: Default::default(),
        };
        assert!(
            self.tokens_by_id.insert(&token_id, &token).is_none(),
            "Token already exists"
        );
        self.internal_add_token_to_owner(&token.owner_id, &token_id);
        self.total_supply += 1;
        self.token_ids.push(token_id);
    }

    pub fn nft_add_sale_guest(&mut self, token_id: TokenId, price: U128, market_id: ValidAccountId, market_deposit: U128) {
        let deposit: Balance = market_deposit.into();
        assert!(deposit <= MAX_MARKET_DEPOSIT, "Cannot make market deposits more than {}", MAX_MARKET_DEPOSIT);
        let guest = self.admin_guest(0);
        let token = self.tokens_by_id.get(&token_id).expect("Token not found");
        assert_eq!(&guest.account_id, &token.owner_id);
        assert_eq!(token.approved_account_ids.len(), 0, "Can only approve one market at a time as guest");
        let market_contract: AccountId = market_id.into();
        let sale = GuestSale {
            public_key: env::signer_account_pk(),
            price: price.clone().into(),
            deposit: deposit.clone()
        };
        // make market add sale
        ext_market::add_sale(
            env::current_account_id(),
            token_id.clone(),
            price,
            guest.account_id,
            &market_contract,
            deposit,
            GAS_FOR_MARKET_CALL
        ).then(ext_self::on_market_updated(
            token_id,
            market_contract,
            Some(sale),
            &env::current_account_id(),
            NO_DEPOSIT,
            ON_CALLBACK_GAS,
        ));
    }

    pub fn nft_remove_sale_guest(&mut self, token_id: TokenId, market_id: ValidAccountId) {
        let guest = self.admin_guest(0);
        let token = self.tokens_by_id.get(&token_id).expect("Token not found");
        assert_eq!(&guest.account_id, &token.owner_id);
        let market_contract: AccountId = market_id.into();
        assert_eq!(token.approved_account_ids.len(), 1, "No sale at market {}", market_contract.clone());
        // make market remove sale
        ext_market::remove_sale(
            env::current_account_id(),
            token_id.clone(),
            &market_contract,
            NO_DEPOSIT,
            GAS_FOR_MARKET_CALL
        ).then(ext_self::on_market_updated(
            token_id,
            market_contract,
            None,
            &env::current_account_id(),
            NO_DEPOSIT,
            ON_CALLBACK_GAS,
        ));
    }

    /// internal helpers for guest admin
    
    fn admin_guest(&mut self, new_mints: u8) -> Guest {
        let signer_id = env::signer_account_pk();
        let mut guest = self.guests.get(&signer_id).expect("Not a guest");
        assert!(
            guest.mints < GUEST_MINT_LIMIT,
            "Exceeded guest mint limit {}", GUEST_MINT_LIMIT
        );
        guest.mints += new_mints;
        self.guests.insert(&signer_id, &guest);
        guest
    }

    /// user wants to become a real NEAR account
    pub fn upgrade_guest(&mut self,
        public_key: Base58PublicKey,
        access_key: Base58PublicKey,
        method_names: String
    ) -> Promise {
        let pk = env::signer_account_pk();
        let guest = self.guests.get(&pk).expect("No guest");
        let balance: Balance = guest.balance.into();
        let fees = SPONSOR_FEE;
        assert!(balance > fees, "Not enough to upgrade");
        env::log(format!("Withdrawing {} from contract", balance).as_bytes());
        
        let account_id = guest.account_id;
        Promise::new(account_id.clone())
            .create_account()
            .add_full_access_key(public_key.into())
            .add_access_key(
                access_key.into(),
                ACCESS_KEY_ALLOWANCE,
                env::current_account_id(),
                method_names.as_bytes().to_vec(),
            )
            .transfer(balance - fees)
            .then(ext_self::on_account_created(
                pk,
                &env::current_account_id(),
                NO_DEPOSIT,
                ON_CALLBACK_GAS,
            ))
    }

    /// only owner/backend API should be able to do this to avoid unwanted storage usage in creating new guest records

    /// add account_id to guests for get_predecessor and to storage to receive tokens
    pub fn add_guest(&mut self, account_id: AccountId, public_key: Base58PublicKey) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "must be owner_id");
        
        if self.tokens_per_owner.get(&account_id).is_some() {
            env::panic(b"The account is already registered");
        }

        let mut tokens_set = UnorderedSet::new(unique_prefix(&account_id));
        self.tokens_per_owner.insert(&account_id, &tokens_set);
        
        if self.guests.insert(&public_key.into(), &Guest{
            account_id,
            mints: 0,
            balance: U128(0),
        }).is_some() {
            env::panic(b"guest account already added");
        }
    }

    pub fn remove_guest(&mut self, public_key: Base58PublicKey) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "must be owner_id");
        let guest = self.guests.get(&public_key.clone().into()).expect("not a guest");
        // TODO transfer NFTs
        self.tokens_per_owner.remove(&guest.account_id);
        self.guests.remove(&public_key.into());
    }

    /// view methods

    pub fn get_guest(&self, public_key: Base58PublicKey) -> Guest {
        self.guests.get(&public_key.into()).expect("no guest")
    }

    pub fn get_account(&self, account_id: ValidAccountId) -> Vec<TokenId> {
        self.tokens_per_owner.get(&account_id.into()).expect("no account").to_vec()
    }

    pub fn get_token_ids(&self) -> Vec<TokenId> {
        self.token_ids.clone()
    }

    /// self callbacks

    /// after account creation delete all the guests activity
    pub fn on_account_created(&mut self, public_key: PublicKey) -> bool {
        let success = is_promise_success();
        if success {
            self.guests.remove(&public_key);
        }
        success
    }

    /// remove approval and guest_sale if there was a removal or if market promise failed to add sale
    pub fn on_market_updated(&mut self, token_id: TokenId, market_contract: AccountId, sale: Option<GuestSale>) -> bool {
        let success = is_promise_success();
        if let Some(sale) = sale {
            if !success {
                return success;
            }
            let mut token = self.tokens_by_id.get(&token_id).expect("Token not found");
            token.approved_account_ids.insert(market_contract);
            self.tokens_by_id.insert(&token_id, &token);
            self.guest_sales.insert(&token_id, &sale);
        } else {
            let mut token = self.tokens_by_id.get(&token_id).expect("Token not found");
            token.approved_account_ids.remove(&market_contract);
            self.tokens_by_id.insert(&token_id, &token);
            self.guest_sales.remove(&token_id);
        }
        success
    }
}

/// Callback for after upgrade_guest
#[ext_contract(ext_self)]
pub trait ExtContract {
    fn on_account_created(&mut self, public_key: PublicKey) -> bool;
    fn on_market_updated(&mut self, token_id: TokenId, market_contract: AccountId, sale: Option<GuestSale>) -> bool;
}

/// external calls to marketplace
#[ext_contract(ext_market)]
trait ExtTransfer {
    fn add_sale(&mut self, token_contract_id: AccountId, token_id: String, price: U128, on_behalf_of: AccountId);
    fn remove_sale(&mut self, token_contract_id: AccountId, token_id: String);
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