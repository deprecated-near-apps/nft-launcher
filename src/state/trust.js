import { getContract } from '../utils/near-utils';
import { get, set, del } from '../utils/storage';
import { formatNearAmount, parseNearAmount } from './near';

export const DEPOSIT_ACTION = '__DEPOSIT_ACTION';

export const initContract = () => async ({ update, getState, dispatch }) => {
	const { account } = await getState();
	const contract = getContract(account);
	await update('', { contract });
	dispatch(getDepositAction());
};

export const getBalances = () => async ({ update, getState, dispatch }) => {
	const { account, contract } = await getState();
	console.log(contract);
	const trustBalance = formatNearAmount(await contract.get_balance({ account_id: account.accountId }), 2);
	update('account', { trustBalance });
};

export const getDepositAction = () => async ({ update, dispatch, getState }) => {
	const amount = get(DEPOSIT_ACTION, '0');
	if (amount) {
		update('account', { pendingDeposit: true });
		const limit = 60, delay = 2000;
		let checks = 0;
		const check = async () => {
			await dispatch(getBalances());
			const { account } = await getState();
			const balance = parseNearAmount(account.trustBalance);
			console.log('checking', checks, amount, balance);
			if (amount === balance) {
				delDepositAction();
				return update('account', { pendingDeposit: false });
			}
			checks++;
			if (checks < limit) {
				setTimeout(check, delay);
			}
		};
		check();
	} else {
		await dispatch(getBalances());
	}
};

/********************************
Not dispatched
********************************/

export const setDepositAction = (amount) => {
	set(DEPOSIT_ACTION, amount);
};

export const delDepositAction = () => {
	del(DEPOSIT_ACTION);
};