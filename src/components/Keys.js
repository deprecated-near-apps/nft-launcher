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
        try {
            const guest = await guestAccount.viewFunction(contractName, 'get_guest', { public_key: accessPublic })
            console.log(guest)
        } catch (e) {
            console.warn(e)
        }
        
		update('localKeys', { seedPhrase, accessAccountId, accessPublic, accessSecret, signedIn });
	};

	const handleCreateGuest = async () => {
        if (localKeys && window.confirm('Sign in as: ' + localKeys.accessAccountId + ' or CANCEL to sign in with a new username. WARNING you will lose access to the account: ' + localKeys.accessAccountId)) {
			return signIn();
		}
        const account_id = username + '.' + contractName
        const contractAccount = new Account(near.connection, contractName)
        try {
            await contractAccount.viewFunction(contractName, 'get_account', { account_id })
            return alert('username taken')
        } catch (e) {
            console.warn(e)
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
			try {
                await contractAccount.viewFunction(contractName, 'get_account', { account_id })
                const keys = {
					seedPhrase,
                    accessAccountId: account_id,
					accessPublic: publicKey.toString(),
					accessSecret: secretKey,
					signedIn: true,
				};
				update('localKeys', keys);
				set(LOCAL_KEYS, keys);
            } catch (e) {
                update('loading', false);
                return alert('error creating guest account')
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

	const deleteAccessKeys = window.deleteUsers = async () => {
		del(LOCAL_KEYS);
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

