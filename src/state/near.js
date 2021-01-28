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
        account = wallet.account();
        const result = await dispatch(signFetch(account, 'http://localhost:3000/has-access-key'))
        if (result && result.success) {
            wallet.balance = formatNearAmount((await wallet.account().getAccountBalance()).available, 2);
            await update('', { near, wallet, account });
            return dispatch(initContract());
        }
        wallet.signOut()
    }

    await update('', { near, wallet });
};

export const signFetch = (account, url, data = {}) => async ({ getState }) => {
	return await postSignedJson({ account, contractName, url, data });
};
