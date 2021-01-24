import getConfig from '../config';
import * as nearAPI from 'near-api-js';
import { getWallet, postSignedJson } from '../utils/near-utils';
import { initContract } from './trust';

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
    
	let account;
	if (wallet.signedIn) {
		wallet.balance = formatNearAmount((await wallet.account().getAccountBalance()).available, 2);
		account = wallet.account();
	}

	update('', { near, wallet, account });
    
	dispatch(initContract());
};

export const signFetch = (url, data = {}) => async ({ getState }) => {
    const { account } = await getState();
    const result = await postSignedJson({ account, contractName, url, data })
    console.log(result)
}
