import { sequelize } from "../db/sequelize";
import { Wallet } from "../db/models/wallet";
import { Deposit } from "../db/models/deposit";
import { WalletTx } from "../db/models/walletTx";
import { Withdrawal } from "../db/models/withdrawal";
import BigNumber from "bignumber.js";
import { v4 as uuidv4 } from "uuid";

export async function requestWithdrawal(memberId: string, amount: string) {
  const withdrawalAmount = new BigNumber(amount);
  if (!withdrawalAmount.isGreaterThan(0)) {
    const error: any = new Error("Withdrawal amount must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  return await sequelize.transaction(async (t) => {
    // Calculate the total Required Turnover from all COMPLETED deposits.
    const totalSum = await Deposit.sum("requiredTurnover", {
      where: { memberId, status: "Completed" },
      transaction: t,
    });

    const totalRequiredTurnover = new BigNumber(totalSum || 0);

    const totalWager = await WalletTx.sum("amount", {
      where: { memberId, type: "WAGER" },
      transaction: t,
    });

    const totalAccruedTurnover = new BigNumber(totalWager || 0);

    if (totalAccruedTurnover.isLessThan(totalRequiredTurnover)) {
      const outstandingTurnover =
        totalRequiredTurnover.minus(totalAccruedTurnover);
      const error: any = new Error("Turnover requirement not met");
      error.statusCode = 422;
      error.data = {
        requiredTurnover: totalRequiredTurnover.toFixed(4),
        accruedTurnover: totalAccruedTurnover.toFixed(4),
        outstandingTurnover: outstandingTurnover.toFixed(4),
      };
      throw error;
    }

    const wallet = await Wallet.findOne({
      where: { memberId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wallet) {
      const error: any = new Error("Wallet not found");
      error.statusCode = 404;
      throw error;
    }

    const currentBalance = new BigNumber(wallet.balance);

    if (currentBalance.isLessThan(withdrawalAmount)) {
      const error: any = new Error("Insufficient wallet balance");
      error.statusCode = 400;
      throw error;
    }

    const balanceAfterBN = currentBalance.minus(withdrawalAmount);

    wallet.balance = balanceAfterBN.toFixed(4);
    await wallet.save({ transaction: t });

    const withdrawal = await Withdrawal.create(
      {
        id: uuidv4(),
        memberId,
        amount: withdrawalAmount.toFixed(4),
        status: "Pending",
      },
      { transaction: t },
    );

    await WalletTx.create(
      {
        id: uuidv4(),
        walletId: wallet.id,
        memberId,
        type: "WITHDRAWAL",
        amount: withdrawalAmount.toFixed(4),
        balanceBefore: currentBalance.toFixed(4),
        balanceAfter: balanceAfterBN.toFixed(4),
        referenceId: withdrawal.id,
      },
      { transaction: t },
    );

    return {
      withdrawalId: withdrawal.id,
      memberId: withdrawal.memberId,
      amount: withdrawal.amount,
      status: withdrawal.status,
      remainingBalance: wallet.balance,
    };
  });
}
