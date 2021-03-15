import React, { useState, useEffect } from 'react';
import * as nearAPI from 'near-api-js';
import { get, set, del } from '../utils/storage';
import { generateSeedPhrase, parseSeedPhrase } from 'near-seed-phrase';
import {
	accessKeyMethods,
	getContract,
	contractName,
	createAccessKeyAccount,
	postJson,
	postSignedJson,
	GAS
} from '../utils/near-utils';

const LOCAL_KEYS = '__LOCAL_KEYS';

const {
	KeyPair,
	utils: { PublicKey,
		format: {
			formatNearAmount
		} }
} = nearAPI;

export const Keys = ({ near, update, localKeys }) => {
	if (!near.connection) return null;
    
	const [accountId, setAccountId] = useState('');

	useEffect(() => {
		if (!localKeys) loadKeys();
	}, []);

	const loadKeys = async () => {
		const { seedPhrase, accessAccountId, accessPublic, accessSecret, signedIn } = get(LOCAL_KEYS);
		if (!accessAccountId) return;
		const { secretKey } = parseSeedPhrase(seedPhrase);
		const keyPair = KeyPair.fromString(secretKey);
		const account = createAccessKeyAccount(near, keyPair);
		const contract = getContract(account, accessKeyMethods);
		const proceeds = formatNearAmount(await contract.get_proceeds({ owner_id: accessAccountId }), 2);
		update('localKeys', { seedPhrase, accessAccountId, accessPublic, accessSecret, signedIn, proceeds });
	};

	const getNewAccessKey = async () => {

		if (localKeys) {
			return signIn();
		}

		update('loading', true);
		const { seedPhrase, publicKey, secretKey } = generateSeedPhrase();
		const keyPair = KeyPair.fromString(secretKey);
		// WARNING NO RESTRICTION ON THIS ENDPOINT
		const result = await postJson({
			url: 'http://localhost:3000/add-key',
			data: { publicKey: publicKey.toString() }
		});
		if (result && result.success) {
			const isValid = await checkAccessKey(keyPair);
			if (isValid) {
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

	const checkAccessKey = async (key) => {
		const account = createAccessKeyAccount(near, key);
		const result = await postSignedJson({
			url: 'http://localhost:3000/has-access-key',
			contractName,
			account
		});
		return result && result.success;
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
			<button onClick={() => getNewAccessKey()}>Sign In As Guest</button>
		}
		{/* <button onClick={() => deleteAccessKeys()}>DELETE ALL ACCESS KEY ACCOUNTS</button> */}
	</>;
};

