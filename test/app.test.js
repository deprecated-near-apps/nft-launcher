const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');

const { KeyPair, Account, utils: { format: { parseNearAmount }} } = nearAPI;
const { 
    connection, initContract, getAccount, getContract,
    contractAccount, contractName, contractMethods, createAccessKeyAccount
} = testUtils;
const { GAS } = getConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;

describe('deploy contract ' + contractName, () => {
    let alice, bobPublicKey, implicitAccountId;
    
    const testMessage = "hello world!"

	beforeAll(async () => {
		alice = await getAccount();
		await initContract(alice.accountId);
	});

	test('contract hash', async () => {
		let state = (await new Account(connection, contractName)).state();
		expect(state.code_hash).not.toEqual('11111111111111111111111111111111');
	});

	test('check create', async () => {
        const contract = await getContract(alice);
        const accessKeys = await alice.getAccessKeys()

		await contract.create({
            message: testMessage,
            amount: parseNearAmount('1'),
            owner: alice.accountId
        }, GAS);
        
        const message = await contract.get_message({ public_key: accessKeys[0].public_key });
		expect(message.message).toEqual(testMessage);
    });

    test('check create with no near', async () => {
        const keyPair = KeyPair.fromRandom('ed25519')
        const public_key = bobPublicKey = keyPair.publicKey.toString()

        // typically done on server
        await contractAccount.addKey(public_key, contractName, contractMethods.changeMethods, parseNearAmount('0.1'))

        const bob = createAccessKeyAccount(keyPair)
        implicitAccountId = Buffer.from(keyPair.publicKey.data).toString('hex')
        
        const contract = await getContract(bob);
		await contract.create({
            message: testMessage,
            amount: parseNearAmount('1'),
            owner: implicitAccountId
        }, GAS);
        
        const message = await contract.get_message({ public_key });
		expect(message.message).toEqual(testMessage);
    });

    test('check purchase and credit bob (implicitAccountId)', async () => {
        const contract = await getContract(alice);
		const message = await contract.purchase({ public_key: bobPublicKey}, GAS, parseNearAmount('1'));
        expect(message.message).toEqual(testMessage);
        bob = await getAccount(implicitAccountId)
        const bobbyBalance = (await bob.state()).amount
        expect(bobbyBalance).toEqual(parseNearAmount('1').toString());
    });

});