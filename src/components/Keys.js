import React, { useState, useEffect } from 'react';
import * as nearAPI from 'near-api-js';
import { get, set, del } from '../utils/storage';
import { generateSeedPhrase, parseSeedPhrase } from 'near-seed-phrase';
import {
	accessKeyMethods,
	getContract,
	contractName,
	createAccessKeyAccount,
    createGuestAccount,
	postJson,
    isAccountTaken,
	postSignedJson,
	GAS
} from '../utils/near-utils';

const LOCAL_KEYS = '__LOCAL_KEYS';

const {
    Account,
	KeyPair,
	utils: { PublicKey,
		format: {
			formatNearAmount
		} }
} = nearAPI;

export const Keys = ({ near, update, localKeys }) => {
	if (!near.connection) return null;
    
	const [username, setUsername] = useState('');
	const [accountId, setAccountId] = useState('');

	useEffect(() => {
		if (!localKeys) loadKeys();
	}, []);

	const loadKeys = async () => {
        console.log(loadKeys)
		const { seedPhrase, accessAccountId, accessPublic, accessSecret, signedIn } = get(LOCAL_KEYS);
		if (!accessAccountId) return;
		const { secretKey } = parseSeedPhrase(seedPhrase);
		const keyPair = KeyPair.fromString(secretKey);
		const guestAccount = createGuestAccount(near, keyPair);
        const guest = await guestAccount.viewFunction(contractName, 'get_guest', { public_key: accessPublic })
        console.log(guest)
        
		update('localKeys', { seedPhrase, accessAccountId, accessPublic, accessSecret, signedIn });
	};

	const handleCreateGuest = async () => {
		if (localKeys) {
			return signIn();
		}
        const account_id = username + '.' + contractName
        if (await isAccountTaken(near, account_id)) {
            return alert('username is taken')
        }
		update('loading', true);
		const { seedPhrase, publicKey, secretKey } = generateSeedPhrase();
        let public_key = publicKey.toString()
		// WARNING NO RESTRICTION ON THIS ENDPOINT
		const result = await postJson({
			url: 'http://localhost:3000/add-guest',
			data: { 
                account_id,
                public_key
            }
		});
		if (result && result.success) {
            const contractAccount = new Account(near.connection, contractName)
			const guest = await contractAccount.viewFunction(contractName, 'get_guest', { public_key })
            console.log(guest)
			if (guest) {
				const keys = {
					seedPhrase,
					accessAccountId: Buffer.from(PublicKey.from(publicKey).data).toString('hex'),
					accessPublic: publicKey.toString(),
					accessSecret: secretKey,
					signedIn: true,
				};
				update('localKeys', keys);
				set(LOCAL_KEYS, keys);
			}
		}
		update('loading', false);
		return null;
	};

	const signIn = () => {
		localKeys.signedIn = true;
		update('localKeys', localKeys);
		set(LOCAL_KEYS, localKeys);
	};

	const signOut = () => {
		localKeys.signedIn = false;
		update('localKeys', localKeys);
		set(LOCAL_KEYS, localKeys);
	};

	const handleFundAccount = async() => {
		if (!accountId.length) return alert('Please enter an accountId to fund!');
		update('loading', true);
		const { secretKey } = parseSeedPhrase(localKeys.seedPhrase);
		const keyPair = KeyPair.fromString(secretKey);
		const account = createAccessKeyAccount(near, keyPair);
		const contract = getContract(account, accessKeyMethods);
		await contract.withdraw({
			account_id: localKeys.accessAccountId,
			beneficiary: accountId,
		}, GAS);
		loadKeys();
		update('loading', false);
	};

	const deleteAccessKeys = async () => {
		update('loading', true);
		// WARNING NO RESTRICTION ON THIS ENDPOINT
		const result = await fetch('http://localhost:3000/delete-access-keys').then((res) => res.json());
		if (result && result.success) {
			update('localKeys', null);
			del(LOCAL_KEYS);
		}
		update('loading', false);
	};

	return <>
		{ localKeys && localKeys.signedIn ?
			<>
				<p>Balance: {localKeys.proceeds || '0'} N</p>
				{
					localKeys.proceeds && localKeys.proceeds !== '0' && <>
						<input placeholder="Funding AccountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
						<button onClick={() => handleFundAccount()}>Fund Account</button>
					</>
				}
				<br />
				<button onClick={() => signOut()}>Sign Out</button>
			</> :

            <div>
            <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} /> 
            <br />
			<button onClick={() => handleCreateGuest()}>Create Guest Account</button>
            </div>
		}
		{/* <button onClick={() => deleteAccessKeys()}>DELETE ALL ACCESS KEY ACCOUNTS</button> */}
	</>;
};

