const fs = require('fs');
const nearAPI = require('near-api-js');
const getConfig = require('../../src/config');
const { nodeUrl, networkId, contractName, contractMethods, accessKeyMethods } = getConfig();
const {
	keyStores: { InMemoryKeyStore },
	Near, Account, Contract, KeyPair,
} = nearAPI;

const credentials = JSON.parse(fs.readFileSync(process.env.HOME + '/.near-credentials/default/' + contractName + '.json'));
const keyStore = new InMemoryKeyStore();
keyStore.setKey(networkId, contractName, KeyPair.fromString(credentials.private_key));
const near = new Near({
	networkId, nodeUrl,
	deps: { keyStore },
});
const { connection } = near;
const contractAccount = new Account(connection, contractName);
const contract = new Contract(contractAccount, contractName, contractMethods);

module.exports = {
	near,
	keyStore,
	connection,
	contract,
	contractName,
	contractAccount,
	accessKeyMethods,
};