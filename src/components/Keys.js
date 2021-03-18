import React, { useState, useEffect } from 'react';
import * as nearAPI from 'near-api-js';
import { get, set, del } from '../utils/storage';
import { generateSeedPhrase, parseSeedPhrase } from 'near-seed-phrase';
import {
    setSignerFromSeed,
	contractName,
    createGuestAccount,
	postJson,
    networkId,
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
        let guest
        try {
            guest = await guestAccount.viewFunction(contractName, 'get_guest', { public_key: accessPublic })
            console.log(guest)
        } catch (e) {
            console.warn(e)
        }
        
		update('localKeys', { seedPhrase, accessAccountId, accessPublic, accessSecret, signedIn, balance: guest.balance });
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

    const handleUpgrade = async () => {
        /// the new full access key
        const { seedPhrase, publicKey } = generateSeedPhrase();
        if (!window.prompt('Keep this somewhere safe!', seedPhrase)) {
            return alert('you have to copy the seed phrase down somewhere')
        }
        console.log('seedPhrase', seedPhrase)
        /// additional access key so upgraded user doens't have to sign in with wallet
        const { seedPhrase: accessSeed, secretKey: accessSecret, publicKey: accessPublic } = generateSeedPhrase();

        /// current guest credentials
        const { accessAccountId: accountId, seedPhrase: guestSeed } = localKeys
        /// prep contract and args
        const guestAccount = createGuestAccount(near, KeyPair.fromString(localKeys.accessSecret));
        update('loading', true);
        const public_key = publicKey.toString();
        try {
            await guestAccount.functionCall(contractName, 'upgrade_guest', {
                public_key,
                access_key: accessPublic,
                method_names: ''
            }, GAS);

            /// wallet hijacking
            set(`near-api-js:keystore:${accountId}:default`, accessSecret);
            set(`undefined_wallet_auth_key`, `{"accountId":"${accountId}","allKeys":["${accessPublic}"]}`);
            /// set to access key pair, still a guest 
            /// e.g. don't have to get full access key secret from app (can use wallet /extention)
            const accessKeyPair = KeyPair.fromString(accessSecret)
            near.connection.signer.keyStore.setKey(networkId, accountId, accessKeyPair);
            signOut()
            update('loading', false);
            /// because we hacked the wallet
            window.location.reload();
        } catch (e) {
            console.warn(e);
            alert('upgrading failed')
        }
    };

	const deleteAccessKeys = window.deleteUsers = async () => {
		del(LOCAL_KEYS);
	};

	return <>
		{ localKeys && localKeys.signedIn ?
			<>
				<p>Balance: {formatNearAmount(localKeys.balance, 2) || '0'} N</p>
				{
					localKeys.balance && localKeys.balance !== '0' && <>
						<button onClick={() => handleUpgrade()}>Upgrade Account</button>
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

