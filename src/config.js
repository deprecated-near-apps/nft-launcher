const contractName = 'dev-1611501879767-3047763';

module.exports = function getConfig() {
    let config = {
        networkId: 'default',
        nodeUrl: 'https://rpc.testnet.near.org',
        walletUrl: 'https://wallet.testnet.near.org',
        helperUrl: 'https://helper.testnet.near.org',
        contractName,
    };

    if (!process.env.DEV_DEPLOY) {
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

    return config;
};
