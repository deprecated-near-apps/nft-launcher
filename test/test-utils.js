const BN = require('bn.js');
const fetch = require('node-fetch');
const nearAPI = require('near-api-js');
const { KeyPair, Account, Contract, utils: { format: { parseNearAmount } } } = nearAPI;
const { near, connection, keyStore, contract, contractAccount } = require('./near-utils');
const getConfig = require('../src/config');
const {
	networkId, contractName, contractMethods, DEFAULT_NEW_ACCOUNT_AMOUNT
} = getConfig();

/********************************
Internal Helpers
********************************/
async function createAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT) {
	const contractAccount = new Account(connection, contractName);
	const newKeyPair = KeyPair.fromRandom('ed25519');
	await contractAccount.createAccount(accountId, newKeyPair.publicKey, new BN(parseNearAmount(fundingAmount)));
	keyStore.setKey(networkId, accountId, newKeyPair);
	return new nearAPI.Account(connection, accountId);
}

const getSignature = async (account) => {
	const { accountId } = account;
	const block = await account.connection.provider.block({ finality: 'final' });
	const blockNumber = block.header.height.toString();
	const signer = account.inMemorySigner || account.connection.signer;
	const signed = await signer.signMessage(Buffer.from(blockNumber), accountId, networkId);
	const blockNumberSignature = Buffer.from(signed.signature).toString('base64');
	return { blockNumber, blockNumberSignature };
};

function generateUniqueString(prefix) {
	return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000000)}`;
}

/********************************
Exports
********************************/

async function initContract() {
	try {
		await contract.new({ owner_id: contractName });
	} catch (e) {
		if (!/Already initialized/.test(e.toString())) {
			throw e;
		}
	}
	return { contract, contractName };
}

async function getContract(account) {
	return new Contract(account || contractAccount, contractName, {
		...contractMethods,
		signer: account || undefined
	});
}

async function getAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT) {
	accountId = accountId || generateUniqueString('test');
	const account = new nearAPI.Account(connection, accountId);
	try {
		await account.state();
		return account;
	} catch(e) {
		if (!/does not exist/.test(e.toString())) {
			throw e;
		}
	}
	return await createAccount(accountId, fundingAmount);
};

const createAccessKeyAccount = (key) => {
	connection.signer.keyStore.setKey(networkId, contractName, key);
	return new Account(connection, contractName);
};

const postSignedJson = async ({ account, contractName, url, data = {} }) => {
	return await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			...data,
			accountId: account.accountId,
			contractName,
			...(await getSignature(account))
		})
	}).then((res) => {
		// console.log(res)
		return res.json();
	});
};

const postJson = async ({ url, data = {} }) => {
	return await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ...data })
	}).then((res) => {
		console.log(res);
		return res.json();
	});
};

module.exports = { 
	near,
	connection,
	keyStore,
	getContract,
	contract,
	contractName,
	contractMethods,
	contractAccount,
	createAccessKeyAccount,
	initContract, getAccount, postSignedJson, postJson
};