import React, { useContext, useEffect } from 'react';

import { appStore, onAppMount } from './state/app';

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
		</div>
	);
};

export default App;
