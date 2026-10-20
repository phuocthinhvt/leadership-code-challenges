import { Router } from "express";
import { z } from "zod";
import * as withdrawalService from "../services/withdrawalService";

export const withdrawalsRouter = Router();

const withdrawalSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

withdrawalsRouter.post("/", async (req, res, next) => {
  try {
    const body = withdrawalSchema.parse(req.body);
    const result = await withdrawalService.requestWithdrawal(
      body.memberId,
      body.amount,
    );
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.statusCode === 422) {
      return res.status(422).json({
        error: err.message,
        details: err.data,
      });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});
