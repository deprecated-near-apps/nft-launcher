import React, { useEffect, useState } from 'react';

import * as nearAPI from 'near-api-js';
import { updateWallet } from '../state/near'
import {
    getContract,
    contractMethods,
	GAS
} from '../utils/near-utils';
const {
	KeyPair,
	utils: { PublicKey,
		format: {
			formatNearAmount
		} }
} = nearAPI;

export const Wallet = ({ wallet, account, update, dispatch, handleClose }) => {

	const [accountId, setAccountId] = useState('');
	const [proceeds, setProceeds] = useState('0');

	useEffect(() => {
		if (account) loadProceeds();
	}, []);
	const loadProceeds = async () => {
        const contract = getContract(account, contractMethods);
        console.log(await contract.get_proceeds({ owner_id: account.accountId }))
		setProceeds(formatNearAmount(await contract.get_proceeds({ owner_id: account.accountId }), 2));
	};

	const handleFundAccount = async() => {
		if (!accountId.length) return alert('Please enter an accountId to fund!');
		update('loading', true);
		const contract = getContract(account, contractMethods);
		await contract.withdraw({
			account_id: account.accountId,
			beneficiary: accountId,
		}, GAS);
        loadProceeds();
        dispatch(updateWallet());
		update('loading', false);
	};


	if (wallet && wallet.signedIn) {
		return <>
			<h3>Wallet</h3>
			<p>Balance: { wallet.balance } N</p>
			<p>Sale Proceeds: {proceeds} N</p>
			{
				proceeds !== '0' && <>
					<input placeholder="Funding AccountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
					<button onClick={() => handleFundAccount()}>Transfer Funds</button>
				</>
			}
			<br />
			<button onClick={handleClose}>Close</button>
			<br />
			<button onClick={() => wallet.signOut()}>Sign Out</button>
		</>;
	}

	return <>
		<button onClick={() => wallet.signIn()}>Connect Wallet</button>
	</>;
};

