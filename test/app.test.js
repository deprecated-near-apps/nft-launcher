const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');

const { Contract, KeyPair, Account, utils: { format: { parseNearAmount }} } = nearAPI;
const { 
	connection, initContract, getAccount, getAccountBalance,
	contract, contractAccount, contractName, contractMethods, createAccessKeyAccount,
	createOrInitAccount,
    getContract,
} = testUtils;
const { 
	networkId, GAS, GUESTS_ACCOUNT_SECRET
} = getConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;

describe('deploy contract ' + contractName, () => {
    let alice, bobId, bob;

    const metadata = 'hello world!'

    const tokenIds = [
        'token' + Date.now(),
        'token' + Date.now() + 1,
        'token' + Date.now() + 2
    ]

    /// contractAccount.accountId is the token contract and contractAccount is the owner
    /// see initContract in ./test-utils.js for details
    const contractId = contractAccount.accountId
    /// this MUST be guests.NFT_CONTRACT_ACCOUNT_ID
    /// see lib.rs get_predecessor method for details
    const guestId = 'guests.' + contractId;

	beforeAll(async () => {
	    await initContract();

		// /// normal user alice
		alice = await getAccount();
		console.log('\n\nAlice accountId:', alice.accountId, '\n\n');

		/// create guest account for bob
        /// add key to guests account (pays for gas, manages guest keys)
        /// add guest record to contract
        /// add key to current near connection signer keyStore (bob's key signs for guestId account)
		bobId = 'g' + Date.now() + '.' + contractId;
		console.log('\n\nBob accountId:', bobId, '\n\n');
		const keyPair = KeyPair.fromRandom('ed25519');
		const public_key = keyPair.publicKey.toString();
		const guestAccount = await createOrInitAccount(guestId, GUESTS_ACCOUNT_SECRET);
		await guestAccount.addKey(public_key, contractId, contractMethods.changeMethods, parseNearAmount('0.1'));
		try {
			await contract.add_guest({ account_id: bobId, public_key }, GAS);
		} catch(e) {
			console.warn(e);
		}
		connection.signer.keyStore.setKey(networkId, guestId, keyPair);
		bob = new Account(connection, guestId);
		const guest = await bob.viewFunction(contractId, 'get_guest', { public_key });
		console.log('\n\nBob guest record:', guest, '\n\n');
	});

	test('nft mint', async () => {
        const token_id = tokenIds[0]
		await alice.functionCall(contractId, 'nft_mint', { token_id, metadata }, GAS, parseNearAmount('1'));
        const token = await contract.nft_token({ token_id });
		console.log('\n\n', token, '\n\n');
        expect(token.metadata).toEqual(metadata)
        expect(token.owner_id).toEqual(alice.accountId)
	});

	test('nft transfer to guest', async () => {
        const token_id = tokenIds[0]
		await alice.functionCall(contractId, 'nft_transfer', { token_id, receiver_id: bobId }, GAS, 1);
        const token = await contract.nft_token({ token_id });
		console.log('\n\n', token, '\n\n');
        expect(token.owner_id).toEqual(bobId)
	});

	test('nft mint guest', async () => {
        const token_id = tokenIds[1]
		await bob.functionCall(contractId, 'nft_mint_guest', { token_id, metadata }, GAS);
        const token = await contract.nft_token({ token_id });
		console.log('\n\n', token, '\n\n');
        expect(token.metadata).toEqual(metadata)
        expect(token.owner_id).toEqual(bobId)
	});

	test('nft approve account id guest', async () => {
        const token_id = tokenIds[1]
		await bob.functionCall(contractId, 'nft_approve_account_id_guest', { token_id, account_id: alice.accountId }, GAS);
        const token = await contract.nft_token({ token_id });
		console.log('\n\n', token, '\n\n');
	});

	test('nft transfer from guest to self', async () => {
        const token_id = tokenIds[1]
		await alice.functionCall(contractId, 'nft_transfer', { token_id, receiver_id: alice.accountId, enforce_owner_id: bobId }, GAS, 1);
        const token = await contract.nft_token({ token_id });
		console.log('\n\n', token, '\n\n');
        expect(token.owner_id).toEqual(alice.accountId)
	});

});