import { Router } from "express";
import { z } from "zod";
import * as depositService from "../services/depositService";

export const depositsRouter = Router();

const createDepositBody = z.object({
  memberId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
  turnoverMultiplier: z.number().int().nonnegative().optional().default(1),
});

depositsRouter.post("/", async (req, res, next) => {
  try {
    const body = createDepositBody.parse(req.body);
    const deposit = await depositService.createDeposit({
      memberId: body.memberId,
      amount: body.amount,
      turnoverMultiplier: body.turnoverMultiplier,
    });

    res.status(201).json({
      id: deposit.id,
      pspRef: deposit.pspRef,
      amount: deposit.amount,
      status: deposit.status,
    });
  } catch (err) {
    next(err);
  }
});
