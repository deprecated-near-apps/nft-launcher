import React, {useEffect, useState} from 'react';
import * as nearAPI from 'near-api-js';
import { GAS, parseNearAmount } from '../state/near';
import { 
	createAccessKeyAccount,
	getContract,
} from '../utils/near-utils';

const {
	KeyPair,
	utils: { format: { formatNearAmount } }
} = nearAPI;

export const Contract = ({ near, update, localKeys = {}, account }) => {
	if (!localKeys || !localKeys.accessPublic) return null;

	const [message, setMessage] = useState('');
	const [amount, setAmount] = useState('');
	const [messageForSale, setMessageForSale] = useState();
	const [purchaseKey, setPurchaseKey] = useState('');
    
	useEffect(() => {
		if (!localKeys.accessPublic) return;
		loadMessage();
	}, [localKeys.accessPublic]);


	const loadMessage = async () => {
		const contract = getContract(createAccessKeyAccount(near, KeyPair.fromString(localKeys.accessSecret)));
		try {
			const result = await contract.get_message({ public_key: localKeys.accessPublic });
			result.amount = formatNearAmount(result.amount, 2);
			console.log(result);
			setMessageForSale(result);
			setPurchaseKey(localKeys.accessPublic);
		} catch (e) {
			if (!/No message/.test(e.toString())) {
				throw e;
			}
		}
	};

	const handleCreateMessage = async () => {
		if (!message.length || !amount.length) {
			alert('Please enter a message and amount!');
			return;
		}
		update('loading', true);
		const appAccount = createAccessKeyAccount(near, KeyPair.fromString(localKeys.accessSecret));
		const contract = getContract(appAccount);
		await contract.create({
			message,
			amount: parseNearAmount(amount),
			owner: localKeys.accountId
		}, GAS);
		await loadMessage();
		update('loading', false);
	};

	const handleBuyMessage = async () => {
		if (!purchaseKey.length) {
			alert('Please enter an app key selling a message');
			return;
		}
		update('loading', true);
		const contract = getContract(account);
		let result;
		try {
			result = await contract.get_message({ public_key: purchaseKey });
		} catch (e) {
			if (!/No message/.test(e.toString())) {
				throw e;
			}
			alert('Please enter an app key selling a message');
			update('loading', false);
			return;
		}
		if (!window.confirm(`Purchase message: "${result.message}" for ${formatNearAmount(result.amount, 2)} N ?`)) {
			update('loading', false);
			return;
		}
		const purchasedMessage = await contract.purchase({ public_key: purchaseKey }, GAS, result.amount);
		console.log(purchasedMessage);
		await loadMessage();
		update('loading', false);
	};

	return <>
		{
			messageForSale ?
				<>
					<h3>Message for Sale</h3>
					<p><b>App Key:</b> { localKeys.accessPublic }</p>
					<p><b>Message:</b> { messageForSale.message }</p>
					<p><b>Amount:</b> { messageForSale.amount }</p>
				</> :
				<>
					<h3>Sell a Message</h3>
					<p>Seller Account Id: { localKeys.accountId }</p>
					<p>Using App Key: { localKeys.accessPublic }</p>
					<input placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
					<br />
					<input placeholder="Amount (N)" value={amount} onChange={(e) => setAmount(e.target.value)} />
					<br />
					<button onClick={() => handleCreateMessage()}>Create Message</button>
				</>
		}
		{
			account &&
            <>
            	<h3>Buy a Message</h3>
            	<input placeholder="App Key" value={purchaseKey} onChange={(e) => setPurchaseKey(e.target.value)} />
            	<br />
            	<button onClick={() => handleBuyMessage()}>Buy Message</button>
            </>
		}
		
	</>;
};

