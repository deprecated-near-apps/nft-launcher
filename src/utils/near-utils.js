import getConfig from '../config';
import * as nearAPI from 'near-api-js';

export const {
	GAS,
	networkId, nodeUrl, walletUrl, nameSuffix,
	contractName, contractMethods,
	accessKeyMethods,
    marketId, marketDeposit,
} = getConfig();

const {
	Account,
	Contract,
	InMemorySigner,
} = nearAPI;

export function formatAccountId (accountId, len = 16) {
	if (accountId.length > len) {
		return accountId.substr(0, len - 3) + '...';
	}
	return accountId;
}

export function getContract(account, methods = contractMethods) {
	return new Contract(account, contractName, { ...methods });
}

export const getWallet = async () => {
	const near = await nearAPI.connect({
		networkId, nodeUrl, walletUrl, deps: { keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore() },
	});
	const wallet = new nearAPI.WalletAccount(near);
	const contractAccount = new Account(near.connection, contractName);
	return { near, wallet, contractAccount };
};

export const getSignature = async (account, key) => {
	const { accountId } = account;
	const block = await account.connection.provider.block({ finality: 'final' });
	const blockNumber = block.header.height.toString();
	const signer = account.inMemorySigner || account.connection.signer;
	const signed = await signer.signMessage(Buffer.from(blockNumber), accountId, networkId);
	const blockNumberSignature = Buffer.from(signed.signature).toString('base64');
	return { blockNumber, blockNumberSignature };
};

export const postSignedJson = async ({ account, contractName, url, data = {} }) => {
	return await fetch(url, {
		method: 'POST',
		headers: new Headers({ 'content-type': 'application/json' }),
		body: JSON.stringify({
			...data,
			accountId: account.accountId,
			contractName,
			...(await getSignature(account))
		})
	}).then((res) => res.json());
};

export const postJson = async ({ url, data = {} }) => {
	return await fetch(url, {
		method: 'POST',
		headers: new Headers({ 'content-type': 'application/json' }),
		body: JSON.stringify({ ...data })
	}).then((res) => res.json());
};



export const createGuestAccount = (near, key) => {
	key.toString = () => key.secretKey;
	near.connection.signer.keyStore.setKey(networkId, 'guests.' + contractName, key);
	const account = new Account(near.connection, 'guests.' + contractName);
	return account;
};

export const createAccessKeyAccount = (near, key) => {
	key.toString = () => key.secretKey;
	near.connection.signer.keyStore.setKey(networkId, contractName, key);
	const account = new Account(near.connection, contractName);
	return account;
};

/********************************
Not used
********************************/

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
	} catch (e) {
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