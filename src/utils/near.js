import getConfig from '../config';
import * as nearAPI from 'near-api-js';

export const {
	GAS,
	networkId, nodeUrl, walletUrl, nameSuffix,
	contractName, contractMethods
} = getConfig();

const {
	KeyPair,
	InMemorySigner,
	transactions: {
		addKey, deleteKey, fullAccessKey
	},
	utils: {
		PublicKey,
		format: {
			parseNearAmount, formatNearAmount
		}
	}
} = nearAPI;

export const getWallet = async () => {
	const near = await nearAPI.connect({
		networkId, nodeUrl, walletUrl, deps: { keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore() },
	});
	const wallet = new nearAPI.WalletAccount(near);
	return { near, wallet };
};

export const getContract = async () => {
	const contract = await new nearAPI.Contract(wallet.account(), contractName, { ...contractMethods });
	return { contract, contractName, contractMethods };
};

export const hasKey = async (near, accountId, publicKey) => {
	const pubKeyStr = publicKey.toString();
	const account = new nearAPI.Account(near.connection, accountId);
	try {
		const accessKeys = await account.getAccessKeys();
		if (accessKeys.length > 0 && accessKeys.find(({ public_key }) => public_key === pubKeyStr)) {
			return true;
		}
	} catch (e) {
		console.warn(e);
	}
	return false;
};

export const isAccountTaken = async (near, accountId) => {
	if (accountId.indexOf(nameSuffix) > -1) {
		return true;
	}
	accountId = accountId + nameSuffix;
	const account = new nearAPI.Account(near.connection, accountId);
	try {
		await account.state();
		return true;
	} catch(e) {
		if (!/does not exist/.test(e.toString())) {
			throw e;
		}
	}
	return false;
};

export const getContractSigner = async ({ keyPair }) => {
	const signer = await InMemorySigner.fromKeyPair(networkId, contractName, keyPair);
	const near = await nearAPI.connect({
		networkId, nodeUrl, walletUrl, deps: { keyStore: signer.keyStore },
	});
	const account = new nearAPI.Account(near.connection, contractName);
	const contract = await new nearAPI.Contract(account, contractName, {
		changeMethods: ['send', 'claim', 'create_account_and_claim'],
		sender: account
	});
	return { contract };
};