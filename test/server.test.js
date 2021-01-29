const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');

const { KeyPair, utils: { format: { parseNearAmount }} } = nearAPI;
const { keyStore, initContract, getAccount, contractAccount, postSignedJson, postJson } = testUtils;
const { contractName, networkId } = getConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;

describe('deploy contract ' + contractName, () => {
	let alice;
	let accessKey;

	beforeAll(async () => {
		alice = await getAccount();
		await initContract();
	});

	test('contract hash', async () => {
		let state = await (await getAccount(contractName)).state();
		expect(state.code_hash).not.toEqual('11111111111111111111111111111111');
	});

	test('check wallet sign in', async () => {
		// simulated wallet sign in
		// add a new key and manually set the signer for alice to the access key instead of full access key
		const newKeyPair = KeyPair.fromRandom('ed25519');
		await alice.addKey(newKeyPair.publicKey, contractName, null, parseNearAmount('0.1'));
		keyStore.setKey(networkId, alice.accountId, newKeyPair);
		const result = await postSignedJson({ account: alice, contractName, url: 'http://localhost:3000/has-access-key/' });
		expect(result.success).toEqual(true);
	});

	test('check adding key to contract account', async () => {
		accessKey = KeyPair.fromRandom('ed25519');
		const publicKey = accessKey.publicKey.toString();
		const result = await postJson({
			url: 'http://localhost:3000/add-key/',
			data: {
				publicKey
			}
		});
		expect(result.success).toEqual(true);
		const accessKeys = await contractAccount.getAccessKeys();
		expect(accessKeys.find(({ public_key }) => public_key === publicKey)).not.toEqual(undefined);
	});

	test('check using contract key', async () => {
		// use the access key from the previous test to sign txs on behalf of the contract account now
		keyStore.setKey(networkId, contractName, accessKey);
		const result = await postSignedJson({ account: contractAccount, contractName, url: 'http://localhost:3000/has-access-key/' });
		console.log(result);
		expect(result.success).toEqual(true);
	});

});