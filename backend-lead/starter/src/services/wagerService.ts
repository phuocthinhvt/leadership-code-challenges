import { sequelize } from "../db/sequelize";
import { Wallet } from "../db/models/wallet";
import { WalletTx } from "../db/models/walletTx";
import BigNumber from "bignumber.js";
import { v4 as uuidv4 } from "uuid";

export async function recordWager(walletId: string, amount: string) {
  const wagerAmount = new BigNumber(amount);
  if (!wagerAmount.isGreaterThan(0)) {
    const error: any = new Error("Wager amount must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  return await sequelize.transaction(async (t) => {
    // Using pessimistic locking to prevent overdraws during concurrent calls
    const wallet = await Wallet.findByPk(walletId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wallet) {
      const error: any = new Error("Wallet not found");
      error.statusCode = 404;
      throw error;
    }

    const currentBalance = new BigNumber(wallet.balance);
    // Check available balance
    if (currentBalance.isLessThan(wagerAmount)) {
      const error: any = new Error("Insufficient balance");
      error.statusCode = 400;
      throw error;
    }

    const balanceAfter = currentBalance.minus(wagerAmount);

    // Update wallet balance
    wallet.balance = balanceAfter.toFixed(4);
    await wallet.save({ transaction: t });

    const tx = await WalletTx.create(
      {
        id: uuidv4(),
        walletId: wallet.id,
        memberId: wallet.memberId,
        type: "WAGER",
        amount: wagerAmount.toFixed(4),
        balanceBefore: currentBalance.toFixed(4),
        balanceAfter: balanceAfter.toFixed(4),
      },
      { transaction: t },
    );

    return {
      walletId: wallet.id,
      balance: wallet.balance,
      wagerTxId: tx.id,
    };
  });
}
