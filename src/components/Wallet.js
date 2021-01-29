import React from 'react';

export const Wallet = ({ walletAccount }) => {
	if (!walletAccount) return null;

	if (walletAccount.signedIn) {
		return <>
			<h3>Wallet Account</h3>
			<p>Signed In: { walletAccount.accountId }</p>
			<p>Balance: { walletAccount.balance }</p>
			<button onClick={() => walletAccount.signOut()}>Sign Out</button>
		</>;
	}

	return <>
		<p>Sign in with your NEAR Wallet</p>
		<button onClick={() => walletAccount.signIn()}>Sign In</button>
	</>;
};

