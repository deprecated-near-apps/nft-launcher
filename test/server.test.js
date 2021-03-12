const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');

const { Account, KeyPair, utils: { format: { parseNearAmount }} } = nearAPI;
const { near, TEST_HOST, initContract, getAccount, contractAccount: ownerAccount, postJson } = testUtils;
const { GAS, contractName: ownerId, networkId } = getConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;

describe('deploy API owned by: ' + ownerId, () => {
	let alice, contractAlice, bob, bobId, bobAccount;
    const name = `token-${Date.now()}`
    const tokenId = `${name}.${ownerId}`
    const guestId = 'guests.' + ownerId

	beforeAll(async () => {
		alice = await getAccount();
		await initContract();
	});

    /// API
	test('deploy token', async () => {
		const { success, result } = await postJson({
            url: TEST_HOST + '/launch-token',
            data: {
                name,
                symbol: 'TEST',
                totalSupply: parseNearAmount('1000000'),
            }
        })
        expect(success).toEqual(true)
	});

    /// API
	test('add guest user', async () => {
		bobId = 'bob.' + tokenId
        const keyPair = KeyPair.fromRandom('ed25519');
        /// bob's key signs tx from guest account (sponsored)
        near.connection.signer.keyStore.setKey(networkId, guestId, keyPair)
        bobAccount = new Account(near.connection, guestId)

        const { success, result } = await postJson({
            url: TEST_HOST + '/add-guest',
            data: {
                account_id: bobId,
                public_key: keyPair.publicKey.toString(),
            }
        })
        expect(success).toEqual(true)
	});


    /// CLIENT
	test('bob guest claim drop self', async () => {
		await bobAccount.functionCall(tokenId, 'claim_drop', {}, GAS)
        const balance = await bobAccount.viewFunction(tokenId, 'ft_balance_of', { account_id: bobId }, GAS)
        expect(balance).toEqual(parseNearAmount('100'))
	});

    /// CLIENT
	test('owner transfer tokens to guest (client)', async () => {
		await ownerAccount.functionCall(tokenId, 'ft_transfer', {
            receiver_id: bobId,
            amount: parseNearAmount('50'),
        }, GAS, 1)
        const balance = await bobAccount.viewFunction(tokenId, 'ft_balance_of', { account_id: bobId }, GAS)
        expect(balance).toEqual(parseNearAmount('150'))
	});

    /// API
	test('owner transfer tokens to guest (api)', async () => {
		const { success, result } = await postJson({
            url: TEST_HOST + '/transfer-tokens',
            data: {
                tokenId,
                receiver_id: bobId,
                amount: parseNearAmount('50'),
            }
        })
        expect(success).toEqual(true)
        const balance = await bobAccount.viewFunction(tokenId, 'ft_balance_of', { account_id: bobId }, GAS)
        expect(balance).toEqual(parseNearAmount('200'))
	});

    /// CLIENT
	test('bob guest transfer to alice', async () => {
        /// send tokens to alice who needs to register her storage
		const storageMinimum = await alice.viewFunction(tokenId, 'storage_minimum_balance', {});
		await alice.functionCall(tokenId, 'storage_deposit', {}, GAS, storageMinimum);
        const amount = parseNearAmount('100')
		await bobAccount.functionCall(tokenId, 'ft_transfer_guest', { receiver_id: alice.accountId, amount }, GAS)
        const balance = await bobAccount.viewFunction(tokenId, 'ft_balance_of', { account_id: bobId }, GAS)
        expect(balance).toEqual(amount)
        const balance2 = await bobAccount.viewFunction(tokenId, 'ft_balance_of', { account_id: alice.accountId }, GAS)
        expect(balance2).toEqual(amount)
	});

    /// CLIENT
	test('bob upgrades to full account', async () => {
        const keyPair = KeyPair.fromRandom('ed25519');
		const keyPair2 = KeyPair.fromRandom('ed25519');
		const public_key = keyPair.publicKey.toString();
		const public_key2 = keyPair2.publicKey.toString();
		near.connection.signer.keyStore.setKey(networkId, bobId, keyPair);
		await bobAccount.functionCall(tokenId, 'upgrade_guest', {
			public_key,
			access_key: public_key2,
			method_names: '',
		}, GAS);
		/// update account and contract for bob (bob now pays gas)
		const balance = await testUtils.getAccountBalance(bobId);
		/// creating account only moves 0.5 NEAR and the rest is still wNEAR
		expect(balance.total).toEqual(parseNearAmount('0.5'));
	});

});