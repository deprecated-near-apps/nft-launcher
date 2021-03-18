import React, {useEffect, useState} from 'react';
import * as nearAPI from 'near-api-js';
import { GAS, parseNearAmount } from '../state/near';
import { 
    contractName,
    createGuestAccount,
	accessKeyMethods,
	createAccessKeyAccount,
	getContract,
} from '../utils/near-utils';

const {
	KeyPair,
} = nearAPI;

export const Contract = ({ near, update, localKeys = {}, account }) => {
	if (!account && !localKeys.signedIn) return null;

	const [metadata, setMetadata] = useState('');
	const [freebies, setFreebies] = useState(0);
    
	const checkFreebies = async () => {
        if (!localKeys.accessPublic) return
		const guestAccount = createGuestAccount(near, KeyPair.fromString(localKeys.accessSecret));
        const guest = await guestAccount.viewFunction(contractName, 'get_guest', { public_key: localKeys.accessPublic })
		setFreebies(guest.mints + 1);
	};
	useEffect(checkFreebies, []);

	const handleMint = async () => {
		if (!metadata.length) {
			alert('Please enter some metadata');
			return;
		}
		update('loading', true);
		let appAccount = account;
		let accountId, deposit;
		if (!appAccount) {
			appAccount = createGuestAccount(near, KeyPair.fromString(localKeys.accessSecret));
			accountId = localKeys.accessAccountId;
		} else {
			accountId = account.accountId;
			deposit = parseNearAmount('1');
		}
        
		const contract = getContract(appAccount);
		await contract[!account ? 'nft_mint_guest' : 'nft_mint']({
            token_id: 'token-' + Date.now(),
			metadata,
		}, GAS, deposit);
		checkFreebies();
		update('loading', false);
        setMetadata('')
	};

	return <>
		<h3>Mint Something</h3>
		{ 
			!account ? <>
				{
					freebies > 0 && <>{
						freebies < 4 ? <>
							<p>{freebies} / 3 Free Mint</p>
							<input placeholder="Metadata (Image URL)" value={metadata} onChange={(e) => setMetadata(e.target.value)} />
							<button onClick={() => handleMint()}>Mint</button>
						</> :
							<p>You are out of free mints 😭</p>
					}</>
				}
			</> :
				<>
					<input placeholder="Metadata (Image URL)" value={metadata} onChange={(e) => setMetadata(e.target.value)} />
					<button onClick={() => handleMint()}>Mint</button>
				</>
		}
	</>;
};

