import getConfig from '../config';
import * as nearAPI from 'near-api-js';
import { getWallet, postSignedJson } from '../utils/near-utils';

export const {
	GAS,
	networkId, nodeUrl, walletUrl, nameSuffix,
	contractName,
} = getConfig();

export const {
	utils: {
		format: {
			formatNearAmount, parseNearAmount
		}
	}
} = nearAPI;

export const initNear = () => async ({ update, getState, dispatch }) => {
	const { near, wallet, contractAccount } = await getWallet();

	wallet.signIn = () => {
		wallet.requestSignIn(contractName, 'Blah Blah');
	};
	const signOut = wallet.signOut;
	wallet.signOut = () => {
		signOut.call(wallet);
		update('wallet.signedIn', false);
		update('', { account: null });
	};

	wallet.signedIn = wallet.isSignedIn();
    
	let account;
	if (wallet.signedIn) {
		account = wallet.account();
		wallet.balance = formatNearAmount((await wallet.account().getAccountBalance()).available, 2);
		await update('', { near, wallet, contractAccount, account });
	}

	await update('', { near, wallet, contractAccount, account });
};

export const updateWallet = () => async ({ update, getState }) => {
    const { wallet } = await getState()
    wallet.balance = formatNearAmount((await wallet.account().getAccountBalance()).available, 2);
    await update('', { wallet });
}
