const contractName = 'dev-1615782978803-2546372';

module.exports = function getConfig() {
	let config = {
		networkId: 'default',
		nodeUrl: 'https://rpc.testnet.near.org',
		// walletUrl: 'http://localhost:1234',
		walletUrl: 'https://wallet.testnet.near.org',
		helperUrl: 'https://helper.testnet.near.org',
		contractName,
	};
    
	if (process.env.REACT_APP_ENV !== undefined) {
		config = {
			...config,
			GAS: '200000000000000',
			DEFAULT_NEW_ACCOUNT_AMOUNT: '5',
			GUESTS_ACCOUNT_SECRET: '7UVfzoKZL4WZGF98C3Ue7tmmA6QamHCiB1Wd5pkxVPAc7j6jf3HXz5Y9cR93Y68BfGDtMLQ9Q29Njw5ZtzGhPxv',
			contractMethods: {
				changeMethods: [
                    'new', 'nft_mint', 'nft_transfer', 'add_guest', 'remove_guest',
                    'nft_mint_guest', 'nft_add_sale_guest', 'nft_remove_sale_guest', 'upgrade_guest'
                ],
				viewMethods: ['get_guest', 'nft_token'],
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
