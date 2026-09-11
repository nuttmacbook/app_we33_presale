import { box } from "../connect";
import { FairLaunch } from "../contracts/contract_fairlaunch";
import { Tether } from "../contracts/contract_tether";

async function approval(amount) {
    const wallet = await box.getCurrentState();

    const account = wallet?.address;
    const signer = wallet?.signer;

    const tether = await box.createEtherContract(Tether, signer);
    const allowance = await tether.allowance(account, FairLaunch.address);

    if (BigInt(amount) > allowance) {
        try {
            const tx = await tether.approve(FairLaunch.address, box.maxUint256);
            await tx.wait();
        } catch (error) {
            throw new Error(contextError);
        }
    }
}

export async function buypresaleExt(amount, referrer) {
    const wallet = await box.getCurrentState();

    const account = wallet?.address;
    const signer = wallet?.signer;

    const fairlaunch = await box.createEtherContract(FairLaunch, signer);

    amount = BigInt(amount) * BigInt(1e18);

    await approval(amount);

    try {
        const tx = await fairlaunch.mint(account, referrer, amount);
        const result = await tx.wait();
        return { result: result.status, txhash: result.hash };
    } catch (error) {
        const handleTxError = box.handleTxError(FairLaunch, error);
        const contextError = handleTxError?.raw?.reason || handleTxError?.raw?.shortMessage
        console.log({ handleTxError })
        throw new Error(contextError);
    }
}