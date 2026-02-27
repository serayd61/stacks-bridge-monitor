import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { STACKS_MAINNET } from '@stacks/network';

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export const appDetails = {
  name: 'Stacks Bridge Monitor',
  icon: '/stacks-icon.png',
};

export const network = STACKS_MAINNET;

export function authenticate() {
  showConnect({
    appDetails,
    redirectTo: '/',
    onFinish: () => {
      window.location.reload();
    },
    userSession,
  });
}

export function disconnect() {
  userSession.signUserOut('/');
}

export function isSignedIn() {
  return userSession.isUserSignedIn();
}

export function getUserAddress() {
  if (!isSignedIn()) return null;
  const userData = userSession.loadUserData();
  return userData.profile.stxAddress.mainnet;
}
