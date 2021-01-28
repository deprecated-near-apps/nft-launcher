import React from 'react';

export const Wallet = ({ wallet, account }) => {
	if (!wallet) return null;

	if (account) {
		return <>
            <h4>Account</h4>
			<p>Signed In: { account.accountId }</p>
			<p>Balance: { wallet.balance }</p>
			<button onClick={() => wallet.signOut()}>Sign Out</button>
		</>;
	}

	return <>
        <p>Sign in with your NEAR Wallet</p>
        <button onClick={() => wallet.signIn()}>Sign In</button>
    </>;
};

