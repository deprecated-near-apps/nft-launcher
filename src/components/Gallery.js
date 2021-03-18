import React, {useEffect, useState} from 'react';
import * as nearAPI from 'near-api-js';
import { GAS, parseNearAmount } from '../state/near';
import { 
	createAccessKeyAccount,
	accessKeyMethods,
	contractMethods,
	getContract,
	formatAccountId,
} from '../utils/near-utils';

const {
	KeyPair,
	utils: { format: { formatNearAmount } }
} = nearAPI;

export const Gallery = ({ near, signedIn, contractAccount, account, localKeys, loading, update }) => {
	if (!contractAccount) return null;

	const [fetching, setFetching] = useState(false);
	const [items, setItems] = useState([]);
	const [amount, setAmount] = useState('');
	const [filter, setFilter] = useState(1);

	useEffect(() => {
		if (!fetching && !loading) loadItems();
	}, [loading]);

	const loadItems = async () => {
		setFetching(true);
		const contract = getContract(contractAccount);
		const token_ids = await contract.get_token_ids();
        console.log(token_ids)
		const newItems = [];
		for (let i = 0; i < token_ids.length; i++) {
            const token_id = token_ids[i]
			const data = await contract.nft_token({
				token_id
			});
            data.sales = []
            for (let j = 0; j < data.approved_account_ids.length; j++) {
                const marketId = data.approved_account_ids[j]
                /// gotta get sale from marketplace contract
                const sale = await contractAccount.viewFunction(marketId, 'get_sale', {
                    token_contract_id: contractAccount.accountId,
                    token_id
                });
                data.sales.push(sale)
            }
			newItems.push({
				...data,
				token_id
			});
		}
		newItems.reverse();
		setItems(newItems);
		console.log('loaded items', newItems);
		setFetching(false);
	};

	const handlePurchase = async (token_id) => {
		update('loading', true);
		console.log(token_id);
		const contract = getContract(account);
		const item = items.find(({ token_id: id }) => token_id === id);
		await contract.purchase({
			new_owner_id: account.accountId,
			token_id: token_id
		}, GAS, item.price);
		await loadItems();
		update('loading', false);
	};

	const handleSetPrice = async (token_id) => {
		update('loading', true);
		let appAccount = account;
		let methods = contractMethods;
		if (!appAccount) {
			appAccount = createAccessKeyAccount(near, KeyPair.fromString(localKeys.accessSecret));
			methods = accessKeyMethods;
		}
		const contract = getContract(appAccount, methods);
		try {
            await contract.set_price({
                token_id: token_id,
                amount: parseNearAmount(amount)
            }, GAS);
        } catch(e) {
            console.warn(e)
        }

		await loadItems();
		update('loading', false);
	};

	let accountId;
	if (account) accountId = account.accountId;
	if (localKeys) accountId = localKeys.accessAccountId;

	let market = [], mine = [];
	if (signedIn) {
		market = items.filter(({ owner_id }) => owner_id !== accountId);
		mine = items.filter(({ owner_id }) => owner_id === accountId);
	} else {
		market = items;
    }

	return <>
		{signedIn && <div className="filters">
			<button onClick={() => setFilter(1)} style={{ background: filter === 1 ? '#FFB259' : ''}}>Market</button>
			<button onClick={() => setFilter(2)} style={{ background: filter === 2 ? '#FFB259' : ''}}>My Tokens</button>
		</div>}
		{
			(filter === 1 ? market : mine).map(({ metadata, owner_id, sales, token_id }) => <div key={token_id} className="item">
				<img src={metadata} />
				{(filter === 1 || price !== '0') &&<div className="line"></div>}
				{filter === 1 && <p>Owned by {formatAccountId(owner_id)}</p>}
				{
					sales.map(({ price }, i) =>
                        <div key={i}>
                            <p>Price {formatNearAmount(price, 2)}</p>
                            {
                                account && <button onClick={() => handlePurchase(token_id)}>Purchase</button>
                            }
                        </div>
                    ) 
				}
				{filter === 2 && <>
					<input placeholder="Price (N)" value={amount} onChange={(e) => setAmount(e.target.value)} />
					<button onClick={() => handleSetPrice(token_id)}>Set Price</button>
				</>}
			</div>)
		}
	</>;
};

