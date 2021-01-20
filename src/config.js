let devEnv;
try {
	devEnv = require('dotenv').parse(require('fs').readFileSync('./neardev/dev-account.env'));
} catch (e) {
	console.warn('cannot find ./neardev/dev-account.env (may be resetting)');
}

// testnet / default
let config = {
	networkId: 'default',
	nodeUrl: 'https://rpc.testnet.near.org',
	walletUrl: 'https://wallet.testnet.near.org',
	helperUrl: 'https://helper.testnet.near.org',
	contractName: devEnv && devEnv.CONTRACT_NAME,
};

// testing / app
if (devEnv) {
	config = {
		...config,
        GAS: '200000000000000',
        DEFAULT_NEW_ACCOUNT_AMOUNT: '5',
		contractMethods: {
			changeMethods: ['new', 'deposit', 'withdraw'],
			viewMethods: ['get_balance'],
		},
	};
}

if (process.env.REACT_APP_ENV === 'prod') {
	config = {
		...config,
		networkId: 'mainnet',
		nodeUrl: 'https://rpc.mainnet.near.org',
		walletUrl: 'https://wallet.near.org',
		helperUrl: 'https://helper.mainnet.near.org',
		contractName: 'near',
	};
}

module.exports = function getConfig() {
	return config;
};
