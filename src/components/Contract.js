import { BN } from 'bn.js';

import React, {useState} from 'react';

import { GAS, parseNearAmount } from '../state/near';
import { getBalances, setDepositAction } from '../state/trust';

export const Contract = ({ contract, account, dispatch }) => {
	if (!contract || !account) return null;

	const [amount, setAmount] = useState('');

	const handleDeposit = async () => {
		const deposit = parseNearAmount(amount);
		// calc what should be the next deposit amount
		const pendingDepositAmount = new BN(parseNearAmount(account.trustBalance)).add(new BN(deposit)).toString();
		setDepositAction(pendingDepositAmount);
		//redirect to wallet will lose state here
		contract.deposit({}, GAS, deposit);
	};

	const handleWithdraw = async () => {
		const withdrawal = parseNearAmount(amount);
		const result = await contract.withdraw({ amount: withdrawal }, GAS);
		console.log(result);
		dispatch(getBalances());
	};

	return <>
        <h4>Trust Contract: {contract.contractId}</h4>
		<p>Balance: {account.trustBalance}</p>

		<p>Make a Deposit</p>
		<input id="amount" placeholder="Amount (N)" onChange={(e) => setAmount(e.target.value)} />
		<br />
		<br />
		<button onClick={handleDeposit}>Deposit</button>
		{ account.trustBalance !== '0' &&
            <button onClick={handleWithdraw}>Withdraw</button>
		}
		<button onClick={() => setAmount(111)}>Clear</button>
	</>;
};

