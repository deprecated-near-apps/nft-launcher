import React from 'react';

export const Wallet = ({ wallet }) => {
	if (!wallet) return null;

	if (wallet.signedIn) {
		return <button onClick={() => wallet.signOut()}>Sign Out</button>;
	}

	return <button onClick={() => wallet.signIn()}>Sign In</button>;
};

