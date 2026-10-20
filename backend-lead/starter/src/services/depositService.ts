import { v4 as uuidv4 } from "uuid";
import BigNumber from "bignumber.js";
import { Deposit, Wallet } from "../db/models";
import { sequelize } from "../db/sequelize";
import { WalletTx } from "../db/models/walletTx";

export async function createDeposit(data: {
  memberId: string;
  amount: string;
  turnoverMultiplier: number;
}) {
  const amount = new BigNumber(data.amount);
  if (!amount.isGreaterThan(0)) {
    throw new Error("amount must be a positive number");
  }

  let wallet = await Wallet.findOne({ where: { memberId: data.memberId } });
  if (!wallet) {
    wallet = await Wallet.create({
      id: uuidv4(),
      memberId: data.memberId,
      balance: "0",
    });
  }

  const pspRef = `psp_ref_${uuidv4()}`;
  const requiredTurnover = amount
    .multipliedBy(data.turnoverMultiplier)
    .toFixed(4);

  const deposit = await Deposit.create({
    id: uuidv4(),
    memberId: data.memberId,
    pspRef,
    amount: amount.toFixed(4),
    turnoverMultiplier: data.turnoverMultiplier,
    requiredTurnover,
    status: "Pending",
  });

  return deposit;
}

export async function handlePspCallback(data: {
  pspRef: string;
  status: "completed" | "failed";
  amount: string;
}) {
  return await sequelize.transaction(async (t) => {
    // Find the deposit by pspRef and apply a row-level lock to prevent concurrency issues
    const deposit = await Deposit.findOne({
      where: { pspRef: data.pspRef },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // In case pspRef does not exist in the system
    if (!deposit) {
      const error: any = new Error("Deposit not found for given pspRef");
      error.statusCode = 404;
      throw error;
    }

    // If the deposit is no longer in the 'Pending' state, this is a retry or duplicate notification. Ignore it and return a success response.
    if (deposit.status !== "Pending") {
      return {
        success: true,
        message: `Callback already processed. Current status is ${deposit.status}`,
        depositId: deposit.id,
        status: deposit.status,
      };
    }

    // Handling the FAILED state
    if (data.status === "failed") {
      deposit.status = "Failed";
      await deposit.save({ transaction: t });
      return {
        success: true,
        message: "Deposit marked as failed",
        depositId: deposit.id,
        status: deposit.status,
      };
    }

    // Handling the COMPLETED state
    const callbackAmount = new BigNumber(data.amount);
    if (!callbackAmount.isGreaterThan(0)) {
      const error: any = new Error("Callback amount must be greater than zero");
      error.statusCode = 400;
      throw error;
    }

    // Lock the member's Wallet record to prevent race conditions when updating the balance.
    const wallet = await Wallet.findOne({
      where: { memberId: deposit.memberId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!wallet) {
      const error: any = new Error("Wallet not found for member");
      error.statusCode = 404;
      throw error;
    }

    const balanceBefore = new BigNumber(wallet.balance);
    const balanceAfter = balanceBefore.plus(callbackAmount);

    // Update wallet balance
    wallet.balance = balanceAfter.toFixed(4);
    await wallet.save({ transaction: t });

    // Update the status and actual amount in the Deposit
    deposit.status = "Completed";
    deposit.amount = callbackAmount.toFixed(4);
    await deposit.save({ transaction: t });

    await WalletTx.create(
      {
        id: uuidv4(),
        walletId: wallet.id,
        memberId: deposit.memberId,
        type: "DEPOSIT",
        amount: callbackAmount.toFixed(4),
        balanceBefore: balanceBefore.toFixed(4),
        balanceAfter: balanceAfter.toFixed(4),
        referenceId: deposit.id,
      },
      { transaction: t },
    );

    return {
      success: true,
      message: "Deposit completed successfully and wallet credited",
      depositId: deposit.id,
      status: deposit.status,
    };
  });
}
