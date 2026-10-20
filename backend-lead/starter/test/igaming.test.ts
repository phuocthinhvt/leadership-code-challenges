import request from "supertest";
import { createApp } from "../src/app";
import { sequelize } from "../src/db/sequelize";
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { Wallet } from "../src/db/models/wallet";

describe("iGaming Backend - Critical Risk Tests", () => {
  let memberId: string;
  let walletId: string;
  let pspRef: string;
  let app: ReturnType<typeof createApp>;

  // Helper to create a unique test member and retrieve their wallet ID
  const createTestMember = async () => {
    const res = await request(app)
      .post("/members")
      .send({
        username: `test_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });

    const id = res.body.member.id;
    const walletRes = await request(app).get(`/members/${id}/wallet`);
    return { memberId: id, walletId: walletRes.body.id };
  };

  // Helper to initiate a deposit transaction and return the PSP reference
  const initiateDeposit = async (
    mId: string,
    amount = "100.00",
    turnoverMultiplier = 2,
  ) => {
    const res = await request(app).post("/deposits").send({
      memberId: mId,
      amount,
      turnoverMultiplier,
    });
    return res.body.pspRef;
  };

  beforeAll(async () => {
    await sequelize.authenticate();
    app = createApp();
  });

  beforeEach(async () => {
    const setup = await createTestMember();
    memberId = setup.memberId;
    walletId = setup.walletId;
    pspRef = await initiateDeposit(memberId);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // 1. Sequential duplicate callback prevention
  test("Sequential duplicate PSP callbacks do not double-credit the wallet", async () => {
    const callbackPayload = { pspRef, status: "completed", amount: "100.00" };

    const res1 = await request(app)
      .post("/psp/callbacks")
      .send(callbackPayload);
    const res2 = await request(app)
      .post("/psp/callbacks")
      .send(callbackPayload);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Verify wallet balance is credited only once directly from database
    const wallet = await Wallet.findByPk(walletId);
    expect(wallet).not.toBeNull();
    expect(parseFloat(String(wallet?.balance))).toBe(100.0);
  });

  // 2. Concurrent duplicate callbacks
  test("Concurrent duplicate PSP callbacks do not double-credit", async () => {
    const callbackPayload = { pspRef, status: "completed", amount: "100.00" };

    // Fire 5 identical callback requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        request(app).post("/psp/callbacks").send(callbackPayload),
      ),
    );

    responses.forEach((res) => expect(res.status).toBe(200));

    // Ensure balance increased only once despite concurrent processing
    const wallet = await Wallet.findByPk(walletId);
    expect(parseFloat(String(wallet?.balance))).toBe(100.0);
  });

  // 3. Concurrent wagers overdraw protection
  test("Concurrent wagers cannot overdraw the wallet balance", async () => {
    // Credit wallet first
    await request(app).post("/psp/callbacks").send({
      pspRef,
      status: "completed",
      amount: "100.00",
    });

    // Execute two concurrent wagers that exceed available balance combined
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/wallets/${walletId}/wagers`)
        .send({ amount: "70.00" }),
      request(app)
        .post(`/wallets/${walletId}/wagers`)
        .send({ amount: "70.00" }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 400]);
  });

  // 4. Turnover lock validation and fulfillment
  test("Turnover lock blocks withdrawal when insufficient and unblocks when fulfilled", async () => {
    // Deposit with turnover multiplier requiring a wager before withdrawal
    const turnoverPspRef = await initiateDeposit(memberId, "100.00", 1);
    await request(app).post("/psp/callbacks").send({
      pspRef: turnoverPspRef,
      status: "completed",
      amount: "100.00",
    });

    // Attempt withdrawal before fulfilling turnover requirements -> Must be blocked
    const blockedWithdrawal = await request(app).post("/withdrawals").send({
      memberId,
      amount: "50.00",
    });
    expect([400, 422].includes(blockedWithdrawal.status)).toBe(true);

    // Fund additional balance to satisfy withdrawal limits
    const extraPspRef = await initiateDeposit(memberId, "100.00", 0);
    await request(app).post("/psp/callbacks").send({
      pspRef: extraPspRef,
      status: "completed",
      amount: "100.00",
    });

    // Place required wagers to fulfill turnover lock
    await request(app)
      .post(`/wallets/${walletId}/wagers`)
      .send({ amount: "100.00" });

    // Retry withdrawal after turnover fulfillment -> Must succeed
    const successfulWithdrawal = await request(app).post("/withdrawals").send({
      memberId,
      amount: "50.00",
    });
    expect([200, 201].includes(successfulWithdrawal.status)).toBe(true);
  });
});
