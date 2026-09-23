import renderPresale from './componants/render_presale';
import './main.css';

import { box, modal } from './web3/connect';
import { FairLaunch } from './web3/contracts/contract_fairlaunch';
import { buypresaleExt } from './web3/intereacts/buypresaleExt';

window.connectWallet = async () => {
    modal.open();
};

const mockupPresaledata = {
    islive:       true,
    hardcap:      '33000000000000000000000',
    saleTokens:   '400000000000000000000000000',
    startTime:    1789138800,
    endTime:      1789138800 + (86400 * 60),
    finalized:    false,
};

async function getContractData(wallet) {
    const account = wallet?.address ?? box.ZERO;

    const fairlaunch = box.createWeb3Contract(FairLaunch, box.getCurrentRpc());

    let PromiseSetting = [
        fairlaunch.methods.getFairLaunchInfo(account).call(),
    ];

    const [getFairLaunchInfo] = await Promise.all(PromiseSetting);

    const [
        totalUser,
        totalRised,
        userUSDTHas,
        userUSDTBought,
        userUSDTReward,
        userIsClaimed
    ] = [
        getFairLaunchInfo[0],
        getFairLaunchInfo[2],
        getFairLaunchInfo[3],
        getFairLaunchInfo[4],
        getFairLaunchInfo[5],
        false
    ];

    return {
        wallet,
        account,
        totalUser,
        totalRised,
        userUSDTHas,
        userUSDTBought,
        userUSDTReward,
        userIsClaimed,
        presale: mockupPresaledata,
    };
}

function SSR(data) {
    const app = document.querySelector('#app');
    if (!app) return;

    const fetchUrlAddress = new URLSearchParams(location.search).get('ref');
    if (fetchUrlAddress) { localStorage.setItem('ref', fetchUrlAddress); }

    const referrerAddress = localStorage.getItem('ref') || '0xF8200b863544249d1fcf3c7F0DBC29b87e08d810';

    app.innerHTML = /*html*/`
        <div class="w-full">
            ${renderPresale({ ...data, referrerAddress })}
        </div>
    `;
}

let currentWallet = null;

async function renderApp(wallet) {
    const path = window.location.pathname;
    if (path !== '/') return;

    currentWallet = wallet;

    const data = await getContractData(wallet);

    SSR(data);
}

window.refreshPresale = async () => {
    const data = await getContractData(currentWallet);
    SSR(data);
};

window.buyPresale = async (amountUsdt, referrerAddress) => {
    return await buypresaleExt(amountUsdt, referrerAddress);
};

window.claimTokens = async () => {
    // return { result: true, txhash }
};

box.safeRenderApp(renderApp);