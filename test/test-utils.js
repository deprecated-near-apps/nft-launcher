const BN = require('bn.js');
const fetch = require('node-fetch');
const nearAPI = require('near-api-js');
const { KeyPair, Account, Contract, utils: { format: { parseNearAmount } } } = nearAPI;
const { near, connection, keyStore, contract, contractAccount } = require('./near-utils');
const getConfig = require('../src/config');
const {
	networkId, contractName, contractMethods,
	DEFAULT_NEW_ACCOUNT_AMOUNT, 
} = getConfig();

const TEST_HOST = 'http://localhost:3000'
/// exports
async function initContract() {
	/// try to call new on contract, swallow e if already initialized
	try {
        const newArgs = {
			owner_id: contractAccount.accountId,
		};
		await contract.new(newArgs);
	} catch (e) {
		if (!/initialized/.test(e.toString())) {
			throw e;
		}
	}
	return { contract, contractName };
}
const getAccountBalance = async (accountId) => (new nearAPI.Account(connection, accountId)).getAccountBalance();

const createOrInitAccount = async(accountId, secret) => {
	let account;
	try {
		account = await createAccount(accountId, DEFAULT_NEW_ACCOUNT_AMOUNT, secret);
	} catch (e) {
		if (!/because it already exists/.test(e.toString())) {
			throw e;
		}
		account = new nearAPI.Account(connection, accountId);
		const newKeyPair = KeyPair.fromString(secret);
		keyStore.setKey(networkId, accountId, newKeyPair);
	}
	return account;
};

async function getAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT) {
	accountId = accountId || generateUniqueSubAccount();
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


async function getContract(account) {
	return new Contract(account || contractAccount, contractName, {
		...contractMethods,
		signer: account || undefined
	});
}


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

function generateUniqueSubAccount() {
	return `t${Date.now()}.${contractName}`;
}

/// internal
async function createAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT, secret) {
	const contractAccount = new Account(connection, contractName);
	const newKeyPair = secret ? KeyPair.fromString(secret) : KeyPair.fromRandom('ed25519');
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

module.exports = { 
    TEST_HOST,
	near,
	connection,
	keyStore,
	getContract,
	getAccountBalance,
	contract,
	contractName,
	contractMethods,
	contractAccount,
	createOrInitAccount,
	createAccessKeyAccount,
	initContract, getAccount, postSignedJson, postJson,
};