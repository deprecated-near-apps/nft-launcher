import { State } from '../utils/state';

import { initNear } from './near';

const initialState = {
	app: {
		mounted: false,
	},
	near: {
		initialized: false,
	},
};

export const { appStore, AppProvider } = State(initialState, 'app');

export const onAppMount = () => async ({ update, getState, dispatch }) => {
	update('app', { mounted: true });
	dispatch(initNear());
};
