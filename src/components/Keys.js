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
		update('loading', true);
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
                    update('loading', false);
					return keyPair;
				}
				localKeys.accessPublic = keyPair.publicKey.toString(),
				localKeys.accessSecret = keyPair.secretKey;
				update('localKeys', localKeys);
				set(LOCAL_KEYS, localKeys);
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
		<h3>Your Local Guest Account</h3>
        <p>The seed phrase and associated implicitAccountId do not have to be revealed to the application. This is similar to a JWT, where only the implicitAccountId may need to be known by the app. The seed phrase is presented only for convenience.</p>
		{ localKeys && localKeys.seedPhrase ?
			<>
				<p><b>Seed Phrase:</b> {localKeys.seedPhrase}</p>
				<p><b>Implicit Account Id:</b> {localKeys.accountId}</p>
				
                <h3>Current App Key</h3>
                <p>An app key with a limited allowance of NEAR to spend on gas fees has been added to the app's contract account. This will allow a user to "mint" a message and set a price, without having NEAR tokens.</p>
                <p>This calls an endpoint on the server (see /server/app.js) that will add the access key using the contract account's master key.</p>
                <p>{localKeys.accessPublic}</p>
				<button onClick={() => getNewAccessKey(true)}>Get New App Key</button>(warning removes current message for sale, if there is one)
                <p>Each app key can be associated with one message for sale.</p>
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

