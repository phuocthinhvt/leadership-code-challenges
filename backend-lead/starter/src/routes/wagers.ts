import { Router } from "express";
import { z } from "zod";
import * as wagerService from "../services/wagerService";

export const wagersRouter = Router();

const wagerSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

wagersRouter.post("/:walletId/wagers", async (req, res, next) => {
  try {
    const body = wagerSchema.parse(req.body);
    const result = await wagerService.recordWager(
      req.params.walletId,
      body.amount,
    );
    return res.status(200).json(result);
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});
