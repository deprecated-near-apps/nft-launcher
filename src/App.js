import React, { useContext, useEffect } from 'react';

import { appStore, onAppMount } from './state/app';

import { Wallet } from './components/Wallet';
import { Contract } from './components/Contract';
import { Keys } from './components/Keys';

import './App.css';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);
    
    const { near, wallet, account, contract } = state;

	const onMount = () => {
		dispatch(onAppMount());
	};
	useEffect(onMount, []);
    
	return (
		<div className="root">
			<Wallet {...{ wallet, account }} />
            <Keys {...{ near, account, dispatch }} />
			<Contract {...{ contract, account, dispatch }} />
		</div>
	);
};

export default App;
