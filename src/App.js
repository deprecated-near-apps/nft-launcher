import React, { useContext, useEffect, useState } from 'react';

import { appStore, onAppMount } from './state/app';

import { Wallet } from './components/Wallet';
import { Contract } from './components/Contract';
import { Keys } from './components/Keys';
import { Gallery } from './components/Gallery';

import Avatar from 'url:./img/avatar.jpg';
import NearLogo from 'url:./img/near_icon.svg';

import './App.scss';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);

    console.log(state)
    
	const { near, wallet, contractAccount, account, localKeys, loading } = state;
    
	const [profile, setProfile] = useState(false);

	const onMount = () => {
		dispatch(onAppMount());
	};
	useEffect(onMount, []);

	const signedIn = ((wallet && wallet.signedIn) || (localKeys && localKeys.signedIn));
	let accountId = '';
	if (signedIn) {
		accountId = account ? account.accountId : <span>Guest Account<br />{localKeys.accessAccountId.split('.')[0]}</span>;
	}

	if (profile && !signedIn) {
		setProfile(false);
	}
    
	return <>
		{ loading && <div className="loading">
			<img src={NearLogo} />
		</div>
		}
        
		<div id="menu">
			<div>
				<div>
					<img style={{ opacity: signedIn ? 1 : 0.25 }} src={Avatar} 
						onClick={() => setProfile(!profile)}
					/>
				</div>
				<div>
					{ !signedIn ? <Wallet {...{ wallet }} /> : accountId }
				</div>
			</div>
		</div>

		{
			profile && signedIn && <div id="profile">
				<div>
					{
						wallet && wallet.signedIn && <Wallet {...{ wallet, account, update, dispatch, handleClose: () => setProfile(false) }} />
					}
					{
						localKeys && localKeys.signedIn && <Keys {...{ near, update, localKeys }} />
					}
				</div>
			</div>
		}

		{ !signedIn &&
            <div id="guest">
            	<>
            		<Keys {...{ near, update, localKeys }} />
            	</>
            </div>
		}
		{ signedIn &&
            <div id="contract">
            	{
            		signedIn &&
                    <Contract {...{ near, update, localKeys, wallet, account }} />
            	}
            </div>
		}
		<div id="gallery">
			<Gallery {...{ near, signedIn, contractAccount, account, localKeys, loading, update }} />
		</div>
	</>;
};

export default App;
