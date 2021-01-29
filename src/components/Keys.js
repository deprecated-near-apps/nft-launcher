import React, { useEffect } from 'react';
import * as nearAPI from 'near-api-js';
import { get, set, del } from '../utils/storage';
import { generateSeedPhrase } from 'near-seed-phrase';
import { 
	contractName,
	createAccessKeyAccount,
	postJson,
	postSignedJson
} from '../utils/near-utils';

const LOCAL_KEYS = '__LOCAL_KEYS';

const {
	KeyPair,
	utils: { PublicKey }
} = nearAPI;

export const Keys = ({ near, update, localKeys }) => {
	if (!near.connection) return null;

	useEffect(() => {
		if (!localKeys) loadKeys();
	}, []);

	const loadKeys = async () => {
		const { seedPhrase, accountId, accessPublic, accessSecret } = get(LOCAL_KEYS);
		if (!seedPhrase) return;
		update('localKeys', { seedPhrase, accountId, accessPublic, accessSecret });
	};

	const getNewAccount = async () => {
		update('loading', true);
		const { seedPhrase, publicKey } = generateSeedPhrase();
		const accountId = Buffer.from(PublicKey.from(publicKey).data).toString('hex');
		const keyPair = await getNewAccessKey();
		if (keyPair) {
			const keys = {
				seedPhrase,
				accountId,
				accessPublic: keyPair.publicKey.toString(),
				accessSecret: keyPair.secretKey
			};
			update('localKeys', keys);
			set(LOCAL_KEYS, keys);
		} else {
			alert('Something happened. Try "Get New App Key" again!');
		}
		update('loading', false);
	};

	const getNewAccessKey = async (selfUpdate = false) => {
		const keyPair = KeyPair.fromRandom('ed25519');
		// WARNING NO RESTRICTION ON THIS ENDPOINT
		const result = await postJson({
			url: 'http://localhost:3000/add-key',
			data: { publicKey: keyPair.publicKey.toString() }
		});
		if (result && result.success) {
			const isValid = await checkAccessKey(keyPair);
			if (isValid) {
				if (!localKeys || !selfUpdate) {
					return keyPair;
				}
				localKeys.accessPublic = keyPair.publicKey.toString(),
				localKeys.accessSecret = keyPair.secretKey;
				update('localKeys', localKeys);
				set(LOCAL_KEYS, localKeys);
			}
		}
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
		<h3>Implicit Account</h3>
		{ localKeys && localKeys.seedPhrase ?
			<>
				<p><b>Seed Phrase:</b> {localKeys.seedPhrase}</p>
				<p><b>Implicit Account Id:</b> {localKeys.accountId}</p>
				<p><b>App Key:</b> {localKeys.accessPublic}</p>
				<button onClick={() => getNewAccessKey(true)}>Get New App Key</button>
				<br />
				<button onClick={() => deleteAccessKeys()}>Remove Account</button>(warning removes all access keys from contract, for you and everyone else)
			</> :
			<>
				<p>Creates a seed phrase + access key to interact with the app. Normally you would set up your seed phrase with a wallet and the app would add an access key.</p>
				<button onClick={() => getNewAccount()}>Get New Account</button>
			</>
		}
	</>;
};

