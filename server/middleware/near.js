
const nacl = require('tweetnacl');
const crypto = require('crypto');
const bs58 = require('bs58');
const { near, connection, contractAccount } = require('../utils/near-utils')

const withNear = () => (req, res, next) => {
	req.near = near;
	next();
};

const VALID_BLOCK_AGE = 100;

const validBlock = async (blockNumber) => {
	const currentBlock = (await connection.provider.status()).sync_info.latest_block_height;
	const givenBlock = Number(blockNumber);
	if (givenBlock <= currentBlock - VALID_BLOCK_AGE || givenBlock > currentBlock) {
		return false;
	}
	return true;
};

const verifySignature = async (accountId, data, signature, contractName = '') => {
	const nearAccount = await near.account(accountId);
	try {
		const hash = crypto.createHash('sha256').update(data).digest();
		let accessKeys = await nearAccount.getAccessKeys();
		if (contractName.length) {
			accessKeys = accessKeys.filter(({ access_key: { permission }}) => permission && permission.FunctionCall && permission.FunctionCall.receiver_id === contractName);
		} else {
			accessKeys = accessKeys.filter(({ access_key: { permission }}) => permission === 'FullAccess');
        }

		return accessKeys.some(({ public_key }) => {
			const publicKey = public_key.replace('ed25519:', '');
			return nacl.sign.detached.verify(hash, Buffer.from(signature, 'base64'), bs58.decode(publicKey));
		});
	} catch (e) {
		console.error(e);
		return false;
	}
};

const hasAccessKey = async (req, res, next) => {
    const { accountId, contractName, blockNumber, blockNumberSignature } = req.body;
    
	if (!accountId || !contractName || !blockNumber || !blockNumberSignature) {
		return res.status(403).send({ error: 'You must provide an accountId, contractName, blockNumber, and blockNumberSignature' });
	}

	if (!(await validBlock(blockNumber))) {
		return res.status(403).send({ error: `You must provide a blockNumber within ${VALID_BLOCK_AGE} of the most recent block; provided: ${blockNumber}, current: ${currentBlock}`});
	}

	if (!(await verifySignature(accountId, blockNumber, blockNumberSignature, contractName))) {
		return res.status(403).send({ error: `blockNumberSignature did not match a signature of blockNumber=${blockNumber} from accountId=${accountId}`});
	}

	return await next();
};

module.exports = {
    contractAccount,
	withNear,
	hasAccessKey,
};