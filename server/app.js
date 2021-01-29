const express = require('express');
const cors = require('cors');
const nearAPI = require('near-api-js');
const getConfig = require('../src/config');
const { contractAccount, withNear, hasAccessKey } = require('./middleware/near');
const { contractName } = getConfig();
const {
	
} = nearAPI;

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(withNear());

app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.post('/has-access-key', hasAccessKey, (req, res) => {
	res.json({ success: true });
});

// WARNING NO RESTRICTION ON THIS ENDPOINT
app.post('/add-key', async (req, res) => {
	const { publicKey } = req.body;
	try {
		const result = await contractAccount.addAccessKey(publicKey);
		res.json({ success: true, result });
	} catch(e) {
		return res.status(403).send({ error: `key is already added`});
	}
});

// WARNING NO RESTRICTION ON THIS ENDPOINT
app.get('/delete-access-keys', async (req, res) => {
	const accessKeys = (await contractAccount.getAccessKeys()).filter(({ access_key: { permission }}) => permission && permission.FunctionCall && permission.FunctionCall.receiver_id === contractName);
	try {
		const result = await Promise.all(accessKeys.map(async ({ public_key }) => await contractAccount.deleteKey(public_key)));
		res.json({ success: true, result });
	} catch(e) {
		return res.status(403).send({ error: e.message});
	}
});

app.listen(port, () => {
	console.log(`\nContract Account ID:\n${contractName}\nListening at http://localhost:${port}`);
});