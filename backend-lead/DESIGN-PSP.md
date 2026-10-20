# PSP Integration Architecture & Extensibility Design

To make adding a new PSP a safe, one-day task for a junior engineer, we decouple PSP-specific quirks (signature verification, data formats, currency unit conversions) from our core financial logic (wallets, double-entry bookkeeping, turnover tracking) using the **Adapter Pattern** and **Configuration-Driven Registry**.

---

## Architecture Sketch

```
                              [ Incoming Webhook ]
                                       │
                                       ▼
                       ┌──────────────────────────────┐
                       │    Generic PSP Controller    │
                       │ (/api/v1/psp/:provider/...)  │
                       └──────────────┬───────────────┘
                                      │
                         Lookup adapter in Registry
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │      IPspAdapter Engine      │
                       └──────────────┬───────────────┘
                                      │
              ┌───────────────────────┼────────────────────────┐
              │                       │                        │
              ▼                       ▼                        ▼
     ┌─────────────────┐      ┌────────────────┐      ┌─────────────────┐
     │  StripeAdapter  │      │  MomoAdapter   │      │    NewAdapter   │
     └────────┬────────┘      └───────┬────────┘      └────────┬────────┘
              │                       │                        │
              └───────────────────────┴────────────────────────┘
                                      │
                       1. Verify Signature (Raw Payload)
                       2. Normalize Payload to Domain Object
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │ NormalizedTransaction Payload│
                       │  (Standard Units, Standard   │
                       │     Status Enums, UTC)       │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │   Core Wallet Domain Engine  │
                       │  (DB Locks, Balance Credit)  │
                       └──────────────────────────────┘
```

## 1. Core Abstraction & Interface

A junior engineer only ever touches **one file**: implementing `IPspAdapter`. They never modify core wallet processing logic.

```typescript
export enum NormalizedStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface NormalizedTransaction {
  pspRef: string;
  status: NormalizedStatus;
  amountInMinorUnits: bigint;
  currency: string;
  rawPayload: Record<string, unknown>;
}

export interface IPspAdapter {
  readonly providerName: string;

  /**
   * Cryptographically verifies signature using raw payload before parsing
   */
  verifySignature(
    headers: Record<string, string>,
    rawBody: Buffer,
    secret: string,
  ): boolean;

  /**
   * Normalizes disparate PSP payloads, minor/major unit conversions, status enums
   */
  normalizeCallback(body: Record<string, unknown>): NormalizedTransaction;

  /**
   * Maps internal deposit intent into PSP-specific outward request
   */
  buildDepositRequest(intent: {
    pspRef: string;
    amountInMinorUnits: bigint;
    currency: string;
  }): Record<string, unknown>;
}
```

---

## 2. Verification, Normalization & Config-Driven Registry

1. **Signature Verification & Normalization**:
   - Signature verification occurs in the adapter using the `rawBody` Buffer before JSON parsing to avoid formatting discrepancies.
   - Normalization converts provider-specific status vocabulary into `NormalizedStatus` and major units (`100.00 USD`) into standard minor integer units (`10000n`).

2. **Configuration-Driven Registry**:
   - PSP credentials and features are managed via environment variables/config tables.

```typescript
// Registered dynamically without altering core controller
export class PspRegistry {
  private static adapters = new Map<string, IPspAdapter>();

  public static register(adapter: IPspAdapter): void {
    this.adapters.set(adapter.providerName.toLowerCase(), adapter);
  }

  public static get(provider: string): IPspAdapter {
    const adapter = this.adapters.get(provider.toLowerCase());
    if (!adapter) throw new Error(`Unsupported PSP Provider: ${provider}`);
    return adapter;
  }
}
```

---

## 3. Safely Onboarding a Junior Engineer (1-Day Workflow)

A junior engineer's task list is strictly scoped:

1. **Create Adapter**: Implement `IPspAdapter` in `src/adapters/<new-psp>.ts`.
2. **Register**: Add `PspRegistry.register(new NewPspAdapter())` in the adapter index.
3. **Write Contract Unit Tests**: Write unit test suites using pre-recorded raw fixtures without deploying or touching DB logic.

---

## 4. Testing Against Providers Unreachable in CI

To reliably test PSPs with no sandbox APIs or firewalled webhooks in CI environments:

1. **Fixture Recording (VCR Pattern / WireMock)**:
   - Save pre-recorded HTTP requests/responses and incoming raw webhook payloads as static `.json` fixtures in `test/fixtures/psp/<provider>/`.
2. **Contract Testing Matrix**:
   - Write unit tests against the adapter using recorded fixtures to ensure proper parsing, error handling, and signature validation without making real network calls.

```typescript
describe("NewPSPAdapter Contract Tests", () => {
  const adapter = new NewPspAdapter();
  const sampleCallback = require("./fixtures/newpsp/success_callback.json");

  test("correctly parses success payload & converts minor units", () => {
    const normalized = adapter.normalizeCallback(sampleCallback.body);
    expect(normalized.status).toBe(NormalizedStatus.COMPLETED);
    expect(normalized.amountInMinorUnits).toBe(10000n);
  });

  test("rejects invalid signature", () => {
    const isValid = adapter.verifySignature(
      sampleCallback.headers,
      Buffer.from(JSON.stringify(sampleCallback.body)),
      "invalid_secret",
    );
    expect(isValid).toBe(false);
  });
});
```
