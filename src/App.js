import React, { useContext, useEffect } from 'react';

import { appStore, onAppMount } from './state/app';
import { signFetch } from './state/near';

import { Wallet } from './components/Wallet';
import { Trust } from './components/Trust';

import './App.css';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);
    
	console.log(state);
    
	const { wallet, account, contract } = state;

	const onMount = () => {
		dispatch(onAppMount());
	};
	useEffect(onMount, []);
    
	return (
		<div className="root">
			<Wallet {...{ wallet, account }} />
			<Trust {...{ contract, account, dispatch }} />

			<button onClick={() => dispatch(signFetch('http://localhost:3000/has-access-key'))}>Test Signed Message</button>
			<button onClick={() => dispatch(signFetch('http://localhost:3000/get-key'))}>Test Add Key</button>
		</div>
	);
};

export default App;
