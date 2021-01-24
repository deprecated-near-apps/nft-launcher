const fs = require('fs');
const BN = require('bn.js');
const getConfig = require('../src/config');
const nearAPI = require('near-api-js');
const { KeyPair, Account, Contract, utils: { format: { parseNearAmount } } } = nearAPI;

const devEnv = getConfig();
const {
	networkId, contractName, contractMethods, DEFAULT_NEW_ACCOUNT_AMOUNT
} = devEnv;

let near, contract, contractAccount, keyStore;

/********************************
Internal Helpers
********************************/
async function createAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT) {
	const contractAccount = new Account(near.connection, contractName);
	const newKeyPair = KeyPair.fromRandom('ed25519');
	await keyStore.setKey(networkId, accountId, newKeyPair);
	await contractAccount.createAccount(accountId, newKeyPair.publicKey, new BN(parseNearAmount(fundingAmount)));
	const newAccount = new nearAPI.Account(near.connection, accountId);
	return newAccount;
}

/********************************
Exports
********************************/
async function initConnection() {
	keyStore = new nearAPI.keyStores.InMemoryKeyStore();
	const config = Object.assign(devEnv, {
		deps: { keyStore },
	});
	const credentials = JSON.parse(fs.readFileSync(process.env.HOME + '/.near-credentials/default/' + contractName + '.json'));
	await keyStore.setKey(networkId, contractName, KeyPair.fromString(credentials.private_key));
	near = await nearAPI.connect(config);
	return near;
}

async function initContract(owner_id) {
	if (contract) return { contract, contractName };
	contractAccount = await getAccount(contractName);
	contract = new Contract(contractAccount, contractName, contractMethods);
	try {
		await contract.new({ owner_id });
	} catch (e) {
		if (!/Already initialized/.test(e.toString())) {
			throw e;
		}
	}
	return contract;
}

async function getContract(account) {
	return new Contract(account || contractAccount, contractName, {
		...contractMethods,
		signer: account || undefined
	});
}

async function getAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT) {
	accountId = accountId || generateUniqueString('test');
	const account = new nearAPI.Account(near.connection, accountId);
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

function generateUniqueString(prefix) {
	return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000000)}`;
}

module.exports = { initConnection, initContract, getAccount, getContract };