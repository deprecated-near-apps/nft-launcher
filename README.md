# NFT Launcher & Easy User Onboarding

Associated Video Demos (most recent at top)

[![NEAR Protocol - NFT Launcher & Easy User Onboarding Demo - Hackathon Starter Kit!](https://img.youtube.com/vi/59Lzt1PFF6I/0.jpg)](https://www.youtube.com/watch?v=59Lzt1PFF6I)

[![Live App Review 14 - NFT Launcher Contract and Tests (Part 1)](https://img.youtube.com/vi/AtAa8hMRueY/0.jpg)](https://youtu.be/AtAa8hMRueY)


# Quickstart

#### If you don't have Rust
Install Rust https://rustup.rs/
#### If you have never used near-cli
1. Install near-cli: `npm i -g near-cli`
2. Create testnet account: [Wallet](https://wallet.testnet.near.org)
3. Login: `near login`
#### Installing and Running Tests for this Example
1. Install everything: `yarn && (cd server && yarn)`
2. Deploy the contract and run the app tests: `yarn test:deploy`
3. (WIP) Start server and run server tests: `cd server && yarn start` then in another terminal from the root `yarn test:server`

#### Notes
- If you ONLY change the JS tests use `yarn test`.
- If you change the contract run `yarn test:deploy` again.
- If you run out of funds in the dev account run `yarn test:deploy` again.
- If you change the dev account (yarn test:deploy) the server should restart automatically, but you may need to restart the app and sign out/in again with NEAR Wallet.
### Moar Context

There's 3 main areas to explore and learn from:
- frontend only (use the app, sign in with NEAR wallet, deploy token contract, sign in as guest users, claim drops, transfer tokens, upgrade) as shown in the video
- app.test.js (demos frontend only tests)
- server.test.js (demos the server api, run server in background, and you can deploy token, add guests and transfer tokens via API calls vs. frontend)
### Owner Account, Token Account, etc...

The tests are set up to auto generate the dev account each time you run `test:deploy` and the token account each time you run any test. **e.g. you will get a new token address each time you run a test**.

This is just for testing. You can obviously deploy a token to a fixed address on testnet / mainnet, it's an easy config update.

#### Guests Account (key and tx gas sponsorship)
When you run app / server tests. There's a contract deployed and a special account created `guests.OWNER_ACCOUNT_ID` to manage the sponsored users (the ones you will pay for gas fees while onboarding). This special "guests" account is different from the test guest account `bob.TOKEN_ID.OWNER_ACCOUNT_ID`. It is an account, different from the owner or token accounts, that manages the guests keys.

#### Guest Accounts
The guest users can `claim_drop, ft_transfer_guest` and receive tokens from other users, e.g. in the server tests the owner transfers tokens to the guest account via API call and using client side code.

Then, following the server tests, the guest transfers tokens to alice (who is a real NEAR account e.g. she pays her own gas).

Finally, the guest upgrades themselves to a real NEAR account, something demoed in the video.

It's a lot to digest but if you focus on the `/test/app.test.js` and `/test/server.test.js` you will start to see the patterns.
# Background

One of the issues with Social Tokens is that they start with zero value. A creator, artist or community might want to drop a bunch of tokens to their fans but the audience has (1) no crypto to pay for fees (2) no wallet (3) no concept of crypto or blockchain; prior to the drop. 

So let's solve these issues by dropping tokens to users in the traditional Web2 way!

We do a demo of creating a "guest" named account for an app where the gas fees are sponsored by a special app account called "guests.APP_NAME.near". The guest account doesn't exist (sometimes called a virtual or contract account) until the user decides to swap their tokens and upgrade to a real account. Until then their name is reserved because only the app is able to create "USERNAME.APP_NAME.near".

This has many advantages for user onboarding, where users can use the app immediately and later can be upgraded to a full account. The users also don't have to move any assets - namely the fungible tokens they earned as a guest user. 

## Installation

Beyond having npm and node (latest versions), you should have Rust installed. I recommend nightly because living on the edge is fun.

https://rustup.rs/

Also recommend installing near-cli globally

`npm i -g near-cli`

Everything else can be installed via:
`yarn`
`cd server && yarn`

## NEAR Config

There is only one config.js file found in `src/config.js`, this is also used for running tests.

Using `src/config.js` you can set up your different environments. Use `REACT_APP_ENV` to switch environments e.g. in `package.json` script `deploy`.

## Running Tests

You can run unit tests in the Rust contracts themselves, but it may be more useful to JS tests against testnet itself.

Note: to run the app and server tests make sure you install and start the server.
- cd server
- yarn && yarn start

Commands:
- `test` will simply run app tests against the contract already deployed. You can mess around with `app.test.js` and try different frontend stuff
- `test:deploy` - will deploy a new dev account (`/neardev`) and deploy a new contract to this account, then run `test`
- `test:server` - will test the server, make sure you start it (see "Note" above)
- `test:unit` - runs the rust unit tests

If you've changed your contract or your dev account has run out of funds use `test:deploy`, if you're updating your JS tests only then use `test`.

## Test Utils

There are helpers in `test/test-utils.js` that take care of:
1. creating a near connection and establishing a keystore for the dev account
2. creating test accounts each time a test is run
3. establishing a contract instance so you can call methods

You can change the default funding amount for test accounts in `src/config.js`

## Using the NEAR Config in your app

In `src/state/near.js` you will see that `src/config.js` is loaded as a function. This is to satisfy the jest/node test runner.

You can destructure any properies of the config easily in any module you import it in like this:

```
// example file app.js

import getConfig from '../config';
export const {
	GAS,
	networkId, nodeUrl, walletUrl, nameSuffix,
	contractName,
} = getConfig();
```
Note the export const in the destructuring?

Now you can import these like so:
```
//example file Component.js
import { GAS } from '../app.js'
...
await contract.withdraw({ amount: parseNearAmount('1') }, GAS)
...
```

# React 17, Parcel with useContext and useReducer
- Bundled with Parcel 2.0 (@next) && eslint
- *Minimal all-in-one state management with async/await support*

## Getting Started: State Store & useContext

>The following steps describe how to use `src/utils/state` to create and use your own `store` and `StateProvider`.

1. Create a file e.g. `/state/app.js` and add the following code
```js
import { State } from '../utils/state';

// example
const initialState = {
	app: {
		mounted: false
	}
};

export const { store, Provider } = State(initialState);
```
2. Now in your `index.js` wrap your `App` component with the `StateProvider`
```js
import { Provider } from './state/app';

ReactDOM.render(
    <Provider>
        <App />
    </Provider>,
    document.getElementById('root')
);
```
3. Finally in `App.js` you can `useContext(store)`
```js
const { state, dispatch, update } = useContext(store);
```

## Usage in Components
### Print out state values
```js
<p>Hello {state.foo && state.foo.bar.hello}</p>
```
### Update state directly in component functions
```js
const handleClick = () => {
    update('clicked', !state.clicked);
};
```
### Dispatch a state update function (action listener)
```js
const onMount = () => {
    dispatch(onAppMount('world'));
};
useEffect(onMount, []);
```
## Dispatched Functions with context (update, getState, dispatch)

When a function is called using dispatch, it expects arguments passed in to the outer function and the inner function returned to be async with the following json args: `{ update, getState, dispatch }`

Example of a call:
```js
dispatch(onAppMount('world'));
```

All dispatched methods **and** update calls are async and can be awaited. It also doesn't matter what file/module the functions are in, since the json args provide all the context needed for updates to state.

For example:
```js
import { helloWorld } from './hello';

export const onAppMount = (message) => async ({ update, getState, dispatch }) => {
	update('app', { mounted: true });
	update('clicked', false);
	update('data', { mounted: true });
	await update('', { data: { mounted: false } });

	console.log('getState', getState());

	update('foo.bar', { hello: true });
	update('foo.bar', { hello: false, goodbye: true });
	update('foo', { bar: { hello: true, goodbye: false } });
	update('foo.bar.goodbye', true);

	await new Promise((resolve) => setTimeout(() => {
		console.log('getState', getState());
		resolve();
	}, 2000));

	dispatch(helloWorld(message));
};
```
## Prefixing store and Provider

The default names the `State` factory method returns are `store` and `Provider`. However, if you want multiple stores and provider contexts you can pass an additional `prefix` argument to disambiguate.

```js
export const { appStore, AppProvider } = State(initialState, 'app');
```

## Performance and memo

The updating of a single store, even several levels down, is quite quick. If you're worried about components re-rendering, use `memo`:
```js
import React, { memo } from 'react';

const HelloMessage = memo(({ message }) => {
	console.log('rendered message');
	return <p>Hello { message }</p>;
});

export default HelloMessage;
```
Higher up the component hierarchy you might have:
```js
const App = () => {
	const { state, dispatch, update } = useContext(appStore);
    ...
	const handleClick = () => {
		update('clicked', !state.clicked);
	};

	return (
		<div className="root">
			<HelloMessage message={state.foo && state.foo.bar.hello} />
			<p>clicked: {JSON.stringify(state.clicked)}</p>
			<button onClick={handleClick}>Click Me</button>
		</div>
	);
};
```
When the button is clicked, the component HelloMessage will not re-render, it's value has been memoized (cached). Using this method you can easily prevent performance intensive state updates in further down components until they are neccessary.

Reference:
- https://reactjs.org/docs/context.html
- https://dmitripavlutin.com/use-react-memo-wisely/



