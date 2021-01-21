import React from 'react';

export const Wallet = ({ wallet, account }) => {
	if (!wallet) return null;

	if (wallet.signedIn) {
		return <>
            <p>Signed In: { account.accountId }</p>
            <p>Balance: { wallet.balance }</p>
            <button onClick={() => wallet.signOut()}>Sign Out</button>
        </>;
	}

	return <button onClick={() => wallet.signIn()}>Sign In</button>;
};

