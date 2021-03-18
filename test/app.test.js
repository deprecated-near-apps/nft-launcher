const fs = require('fs');
const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');

const { 
    Contract, KeyPair, Account,
    utils: { format: { parseNearAmount }},
    transactions: { deployContract, functionCall },
} = nearAPI;
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
    let alice, bobId, bob, bobKey, marketAccount;

    const market_deposit = parseNearAmount('0.1');
    const metadata = 'https://media1.tenor.com/images/4c1d96a989150e7019bfbabbebd2ff36/tenor.gif?itemid=20269144'
    const metadata2 = 'https://media1.tenor.com/images/818161c07948bac34aa7c5f5712ec3d7/tenor.gif?itemid=15065455'

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
    const marketId = 'market.' + contractId;

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
        /// saving public_key to bobKey (available for future tests)
		const public_key = bobKey = keyPair.publicKey.toString();
		const guestAccount = await createOrInitAccount(guestId, GUESTS_ACCOUNT_SECRET);
		await guestAccount.addKey(public_key, contractId, contractMethods.changeMethods, parseNearAmount('0.1'));
		try {
			await contract.add_guest({ account_id: bobId, public_key }, GAS);
		} catch(e) {
			console.warn(e);
		}
		connection.signer.keyStore.setKey(networkId, guestId, keyPair);
		bob = new Account(connection, guestId);
		const guest = await bob.viewFunction(contractId, 'get_guest', { public_key: bobKey });
		console.log('\n\nBob guest record:', guest, '\n\n');

        /// create or get market account and deploy market.wasm
		marketAccount = await createOrInitAccount(marketId, GUESTS_ACCOUNT_SECRET);
        let state = await marketAccount.state()
		console.log('\n\nstate:', state, '\n\n');
        if (state.code_hash === '11111111111111111111111111111111') {
            const contractBytes = fs.readFileSync('./out/market.wasm');
            console.log('\n\ndeploying contractBytes:', contractBytes.length, '\n\n');
            const actions = [
                deployContract(contractBytes),
                functionCall('new', { owner_id: contractId }, GAS)
            ]
            await marketAccount.signAndSendTransaction(marketId, actions)
        }
	});

	test('nft mint', async () => {
        const token_id = tokenIds[0]
		await alice.functionCall(contractId, 'nft_mint', { token_id, metadata }, GAS, parseNearAmount('1'));
        const token = await contract.nft_token({ token_id });
        expect(token.metadata).toEqual(metadata)
        expect(token.owner_id).toEqual(alice.accountId)
	});

	test('nft transfer to guest', async () => {
        const token_id = tokenIds[0]
		await alice.functionCall(contractId, 'nft_transfer', { token_id, receiver_id: bobId }, GAS, 1);
        const token = await contract.nft_token({ token_id });
        expect(token.owner_id).toEqual(bobId)
	});

    test('nft mint and approve but no sale', async () => {
        const token_id = tokenIds[2]
		await alice.functionCall(contractId, 'nft_mint', { token_id, metadata: metadata2 }, GAS, parseNearAmount('1'));
        await alice.functionCall(contractId, 'nft_approve_account_id', { token_id, account_id: marketId }, GAS, parseNearAmount('0.1'));
        await alice.functionCall(marketId, 'add_sale', { token_contract_id: contractId, token_id, price: parseNearAmount('1') }, GAS, parseNearAmount('0.1'));
        const token = await contract.nft_token({ token_id });
        const sale = await alice.viewFunction(marketId, 'get_sale', { token_contract_id: contractId, token_id });
		console.log('\n\n', sale, '\n\n');
        expect(sale.price).toEqual(parseNearAmount('1'))
        expect(token.owner_id).toEqual(alice.accountId)
	});

	test('nft mint guest', async () => {
        const token_id = tokenIds[1]
		await bob.functionCall(contractId, 'nft_mint_guest', { token_id, metadata }, GAS);
        const token = await contract.nft_token({ token_id });
        expect(token.metadata).toEqual(metadata)
        expect(token.owner_id).toEqual(bobId)
	});

    /// selling token as guest

	test('nft approve account id guest', async () => {
        const token_id = tokenIds[0]
		await bob.functionCall(contractId, 'nft_add_sale_guest', {
            token_id,
            price: parseNearAmount('1'),
            market_id: marketId,
            market_deposit
        }, GAS);
	});

	test('get sale', async () => {
        const token_id = tokenIds[0]
		const sale = await alice.functionCall(marketId, 'get_sale', {
            token_contract_id: contractId,
            token_id
        }, GAS);
        console.log('\n\nsale.status', sale.status, '\n\n');
	});

	test('purchase nft from market', async () => {
        const token_id = tokenIds[0]
		await alice.functionCall(marketId, 'purchase', {
            token_contract_id: contractId,
            token_id
        }, GAS, parseNearAmount('1'));
        const token = await contract.nft_token({ token_id });
        expect(token.owner_id).toEqual(alice.accountId)
	});

	test('get guest', async () => {
		const guest = await bob.viewFunction(contractId, 'get_guest', { public_key: bobKey });
        console.log('\n\n', guest, '\n\n');
	});

	test('upgrade guest self', async () => {
		const keyPair = KeyPair.fromRandom('ed25519');
		const keyPair2 = KeyPair.fromRandom('ed25519');
		const public_key = keyPair.publicKey.toString();
		const public_key2 = keyPair2.publicKey.toString();
		connection.signer.keyStore.setKey(networkId, bobId, keyPair);
		const result = await bob.functionCall(contractId, 'upgrade_guest', {
			public_key,
			access_key: public_key2,
			method_names: '',
		}, GAS);
		/// update account and contract for bob (bob now pays gas)
		const balance = await testUtils.getAccountBalance(bobId);
		expect(balance.total).toEqual(parseNearAmount('0.9'));
		
	});
});