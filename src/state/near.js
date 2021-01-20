import getConfig from '../config';
import * as nearAPI from 'near-api-js';
import { getWallet } from '../utils/near';

export const {
	GAS,
	networkId, nodeUrl, walletUrl, nameSuffix,
	contractName,
} = getConfig();

const {
	KeyPair,
	InMemorySigner,
	transactions: {
		addKey, deleteKey, fullAccessKey
	},
	utils: {
		PublicKey,
		format: {
			parseNearAmount, formatNearAmount
		}
	}
} = nearAPI;

export const initNear = () => async ({ update, getState, dispatch }) => {
	const { near, wallet } = await getWallet();

	wallet.signIn = () => {
		wallet.requestSignIn(contractName, 'Blah Blah');
	};
	const signOut = wallet.signOut;
	wallet.signOut = () => {
		signOut.call(wallet);
		update('wallet.signedIn', false);
	};
	wallet.signedIn = wallet.isSignedIn();
	if (wallet.signedIn) {
		wallet.balance = formatNearAmount((await wallet.account().getAccountBalance()).available, 2);
	}

	update('', { near, wallet });
};
