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

app.post('/add-key', hasAccessKey, async (req, res) => {
    const { publicKey } = req.body;
    const result = await contractAccount.addAccessKey(publicKey);
	res.json({ success: true, result });
});

app.listen(port, () => {
	console.log(`\nContract Account ID:\n${contractName}\nListening at http://localhost:${port}`);
});