use std::convert::TryFrom;
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap};
use near_sdk::json_types::{U128, ValidAccountId};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, ext_contract, near_bindgen, AccountId, Gas, Balance, PanicOnDefault, Promise, PromiseResult};

#[global_allocator]
static ALLOC: near_sdk::wee_alloc::WeeAlloc<'_> = near_sdk::wee_alloc::WeeAlloc::INIT;

const GAS_FOR_RESOLVE_TRANSFER: Gas = 10_000_000_000_000;
const GAS_FOR_NFT_TRANSFER_CALL: Gas = 25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER;
const NO_DEPOSIT: Balance = 0;
const MIN_ATTACHED_DEPOSIT: u128 = 100_000_000_000_000_000_000_000;
pub type TokenId = String;
pub type ContractAndTokenId = String;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Sale {
    pub owner_id: AccountId,
    pub beneficiary: AccountId,
    pub price: U128,
    pub deposit: Balance,
    pub processing: bool,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub sales: LookupMap<ContractAndTokenId, Sale>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner_id: ValidAccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            owner_id: owner_id.into(),
            sales: LookupMap::new(b"s".to_vec()),
        }
    }

    #[payable]
    pub fn add_sale(&mut self, token_contract_id: ValidAccountId, token_id: String, price: U128, owner_id: ValidAccountId, beneficiary: Option<ValidAccountId>) {
        let deposit = env::attached_deposit();
        assert!(deposit >= MIN_ATTACHED_DEPOSIT, "Must attach at least 0.1 NEAR as deposit to list sale");
        let contract_id: AccountId = token_contract_id.into();
        
        // if you are making a sale on someone's behalf and you want to escrow the funds (guest accounts)
        let mut sale_beneficiary = owner_id.clone();
        if let Some(beneficiary) = beneficiary {
            sale_beneficiary = beneficiary;
        }
        let owner: AccountId = owner_id.into();

        env::log(format!("add_sale for owner: {}", owner.clone()).as_bytes());
        
        self.sales.insert(&format!("{}:{}", contract_id, token_id), &Sale{
            owner_id: owner,
            beneficiary: sale_beneficiary.into(),
            price,
            deposit,
            processing: false,
        });
    }
    
    pub fn update_price(&mut self, token_contract_id: ValidAccountId, token_id: String, price: U128) {
        let contract_id: AccountId = token_contract_id.into();
        let contract_and_token_id = format!("{}:{}", contract_id, token_id);
        let mut sale = self.sales.remove(&contract_and_token_id).expect("No sale");
        assert_eq!(
            env::predecessor_account_id(),
            sale.owner_id,
            "Must be sale owner"
        );
        sale.price = price;
        self.sales.insert(&contract_and_token_id, &sale);
    }

    /// should be able to pull a sale without yocto redirect to wallet?
    pub fn remove_sale(&mut self, token_contract_id: ValidAccountId, token_id: String) {
        let contract_id: AccountId = token_contract_id.into();
        let sale = self.sales.remove(&format!("{}:{}", contract_id, token_id)).expect("No sale");
        assert_eq!(
            env::predecessor_account_id(),
            sale.owner_id,
            "Must be sale owner"
        );
        Promise::new(sale.owner_id).transfer(sale.deposit);
    }

    #[payable]
    pub fn purchase(&mut self, token_contract_id: ValidAccountId, token_id: String) -> Promise {
        let contract_id: AccountId = token_contract_id.clone().into();
        let contract_and_token_id = format!("{}:{}", contract_id, token_id);
        let mut sale = self.sales.get(&contract_and_token_id).expect("No sale");
        assert_eq!(sale.processing, false, "Sale is currently in progress");
        let deposit = env::attached_deposit();
        let price = sale.price.into();
        assert_eq!(
            env::attached_deposit(),
            price,
            "Must pay exactly the sale amount {}", deposit
        );
        sale.processing = true;
        self.sales.insert(&contract_and_token_id, &sale);
        let predecessor = env::predecessor_account_id();
        let receiver_id = ValidAccountId::try_from(predecessor.clone()).unwrap();
        let owner_id = ValidAccountId::try_from(sale.owner_id).unwrap();
        let memo: String = "Sold by Matt Market".to_string();
        // call NFT contract transfer call function
        ext_transfer::nft_transfer(
            receiver_id,
            token_id.clone(),
            owner_id, // who added sale must still be token owner
            memo,
            &contract_id,
            1,
            env::prepaid_gas() - GAS_FOR_NFT_TRANSFER_CALL,
        ).then(ext_self::nft_resolve_purchase(
            contract_id,
            token_id,
            predecessor,
            &env::current_account_id(),
            NO_DEPOSIT,
            GAS_FOR_RESOLVE_TRANSFER,
        ))
    }

    /// self callback

    pub fn nft_resolve_purchase(
        &mut self,
        token_contract_id: AccountId,
        token_id: TokenId,
        buyer_id: AccountId,
    ) -> bool {
        env::log(format!("Promise Result {:?}", env::promise_result(0)).as_bytes());
        let contract_and_token_id = format!("{}:{}", token_contract_id, token_id);
        // value is nothing, checking if nft_transfer was Successful promise execution
        if let PromiseResult::Successful(_value) = env::promise_result(0) {
            // pay seller and remove sale
            let sale = self.sales.remove(&contract_and_token_id).expect("No sale");
            Promise::new(sale.beneficiary).transfer(u128::from(sale.price) + sale.deposit);
            return true;
        }
        // no promise result, refund buyer and update sale state to not processing
        let mut sale = self.sales.get(&contract_and_token_id).expect("No sale");
        sale.processing = false;
        self.sales.insert(&contract_and_token_id, &sale);
        Promise::new(buyer_id).transfer(u128::from(sale.price));
        return false;
    }

    /// view methods

    pub fn get_sale(&self, token_contract_id: ValidAccountId, token_id: String) -> Sale {
        let contract_id: AccountId = token_contract_id.into();
        self.sales.get(&format!("{}:{}", contract_id, token_id.clone())).expect("No sale")
    }
}

#[ext_contract(ext_self)]
trait ResolvePurchase {
    fn nft_resolve_purchase(
        &mut self,
        token_contract_id: AccountId,
        token_id: TokenId,
        buyer_id: AccountId,
    ) -> Promise;
}

#[ext_contract(ext_transfer)]
trait ExtTransfer {
    fn nft_transfer(
        &mut self,
        receiver_id: ValidAccountId,
        token_id: TokenId,
        enforce_owner_id: ValidAccountId,
        memo: String,
    );
}

/// approval callbacks from NFT contracts 

trait NonFungibleTokenApprovalsReceiver {
    fn nft_on_approve_account_id(
        &mut self,
        token_contract_id: ValidAccountId,
        token_id: TokenId,
        owner_id: ValidAccountId,
        msg: Option<String>,
    ) -> bool;
    fn nft_on_revoke_account_id(
        &mut self,
        token_contract_id: ValidAccountId,
        token_id: TokenId,
        owner_id: ValidAccountId,
        msg: Option<String>,
    ) -> bool;
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct OnApprovalMsg {
    pub beneficiary: AccountId,
    pub price: U128,
}

#[near_bindgen]
impl NonFungibleTokenApprovalsReceiver for Contract {

    #[payable]
    fn nft_on_approve_account_id(
        &mut self,
        token_contract_id: ValidAccountId,
        token_id: TokenId,
        owner_id: ValidAccountId,
        msg: Option<String>,
    ) -> bool {
        let contract: AccountId = token_contract_id.clone().into();
        assert_eq!(env::predecessor_account_id(), contract, "Approval callbacks need to be called by the NFT Contract");
        if let Some(msg) = msg {
            let msg_data: OnApprovalMsg = near_sdk::serde_json::from_str(&msg).expect("Valid OnApprovalMsg");
            let beneficiary = ValidAccountId::try_from(msg_data.beneficiary).expect("Valid account id passd in msg to nft_on_approve_account_id");
            self.add_sale(token_contract_id, token_id, msg_data.price.into(), owner_id, Some(beneficiary));
            true
        } else {
            false
        }
    }

    fn nft_on_revoke_account_id(
        &mut self,
        token_contract_id: ValidAccountId,
        token_id: TokenId,
        _owner_id: ValidAccountId,
        _msg: Option<String>,
    ) -> bool {
        let contract: AccountId = token_contract_id.clone().into();
        assert_eq!(env::predecessor_account_id(), contract, "Approval callbacks need to be called by the NFT Contract");
        self.remove_sale(token_contract_id, token_id);
        true
    }
}