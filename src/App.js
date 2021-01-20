import React, { useContext, useEffect } from 'react';

import { appStore, onAppMount } from './state/app';

import { Wallet } from './components/Wallet';

import './App.css';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);
	console.log(state);
	const { wallet } = state;

	const onMount = () => {
		dispatch(onAppMount());
	};
	useEffect(onMount, []);
    
	return (
		<div className="root">
			<Wallet {...{ wallet }} />
		</div>
	);
};

export default App;
