const express = require('express');
const cors = require('cors');
const nearAPI = require('near-api-js');
const getConfig = require('../src/config');
const { withNear } = require('./middleware/near');
const { near, contractAccount } = require('./utils/near-utils');
const { contractName, networkId, GAS, contractMethods, GUESTS_ACCOUNT_SECRET } = getConfig();
const {
    Account,
    KeyPair,
	utils: {
		format: {
			parseNearAmount
		}
	}
} = nearAPI;

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(withNear());

app.get('/', (req, res) => {
	res.send('Hello World!');
});

/// WARNING NO RESTRICTION ON THIS ENDPOINT
app.post('/add-guest', async (req, res) => {
	const { account_id, public_key } = req.body;
    const contractId = account_id.substr(account_id.indexOf('.') + 1)
    /// setup signer for guestAccount txs
    const guestId = 'guests.' + contractId
    const guestKeyPair = KeyPair.fromString(GUESTS_ACCOUNT_SECRET)
    near.connection.signer.keyStore.setKey(networkId, guestId, guestKeyPair);
    const guestsAccount = new Account(near.connection, guestId)
    /// try adding key to guestAccount and guest record to contract
    console.log('\nAdding guest account:', account_id)
	try {
		const addKey = await guestsAccount.addKey(public_key, contractId, contractMethods.changeMethods, parseNearAmount('0.1'));
		const add_guest = await contractAccount.functionCall(contractId, 'add_guest', { account_id, public_key }, GAS);
		res.json({ success: true, result: { addKey, add_guest } });
	} catch(e) {
		console.log(e);
		return res.status(403).send({ error: `error adding guest`, e});
	}
});

app.listen(port, () => {
	console.log(`\nContract Account ID:\n${contractName}\nListening at http://localhost:${port}`);
});