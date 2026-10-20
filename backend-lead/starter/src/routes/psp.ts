import { Router } from "express";
import { z } from "zod";
import * as depositService from "../services/depositService";

export const pspRouter = Router();

const pspCallbackSchema = z.object({
  pspRef: z.string().min(1, "pspRef is required"),
  status: z
    .enum(["completed", "failed", "Completed", "Failed"])
    .transform((val) => val.toLowerCase() as "completed" | "failed"),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

pspRouter.post("/callbacks", async (req, res, next) => {
  try {
    const body = pspCallbackSchema.parse(req.body);
    const result = await depositService.handlePspCallback(body);

    return res.status(200).json(result);
  } catch (err: any) {
    if (err.statusCode) {
      return res
        .status(err.statusCode)
        .json({ success: false, error: err.message });
    }
    next(err);
  }
});
