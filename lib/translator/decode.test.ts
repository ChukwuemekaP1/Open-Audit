import { describe, it, expect } from "vitest";
import { translateEvent } from "./registry";
import type { RawEvent } from "./types";

/**
 * Mock XDR data for testing Soroban event translation.
 * These represent standard SAC (Stellar Asset Contract) events:
 * 1. Transfer - tokens moved between accounts
 * 2. Mint - new tokens created
 * 3. Burn - tokens destroyed
 *
 * In production, these would come from Horizon/RPC endpoints.
 */
const MOCK_SAC_TRANSFER_EVENT: RawEvent = {
  id: "0000001-0",
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  topics: [
    "0x0000000000000000000000000000000000000000000000000000000074726e73", // "transfer"
    // Address ScVal: SCV_ADDRESS (type=18) + SC_ADDRESS_TYPE_ACCOUNT (type=0) + 32-byte ed25519 pubkey
    "0x00000012000000000000000085a825af25ab38c944150cc569311cf76c80b8b521297c049c5c53204cd43e38",
    "0x000000120000000000000000fa6798a578d9f9f012f70a00cae3d6b15a7ada4518f98ad68c0cab21d16a0f5d",
  ],
  data: "0x00000000000000000000000000000000000000000005F5E100", // 100 USDC
  ledger: 52_341_001,
  timestamp: Math.floor(Date.now() / 1000) - 45,
  txHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
};

const MOCK_SAC_MINT_EVENT: RawEvent = {
  id: "0000001-3",
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  topics: [
    "0x000000000000000000000000000000000000000000000000000000006d696e74", // "mint"
    // Address ScVal: SCV_ADDRESS (type=18) + SC_ADDRESS_TYPE_ACCOUNT (type=0) + 32-byte ed25519 pubkey
    "0x00000012000000000000000046b154e5ed3790ed2ff68484460559e6502361ff3ac0d0197e98edf3700731d4",
    "0x000000120000000000000000c16847681b580e9fe1ee7d4c99496f6aa20bd5bf02712ccc338813bdb21559b9",
  ],
  data: "0x0000000000000000000000000000000000000000017D7840", // 250 USDC
  ledger: 52_341_004,
  timestamp: Math.floor(Date.now() / 1000) - 310,
  txHash: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
};

const MOCK_SAC_BURN_EVENT: RawEvent = {
  id: "0000001-5",
  contractId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  topics: [
    "0x000000000000000000000000000000000000000000000000000000006275726e", // "burn"
    // Address ScVal: SCV_ADDRESS (type=18) + SC_ADDRESS_TYPE_ACCOUNT (type=0) + 32-byte ed25519 pubkey
    "0x0000001200000000000000005c0e8833db222000465cc32bdf60ed355e6408d12e65e7c988bd25fa4aee6ddd",
  ],
  data: "0x00000000000000000000000000000000000000000017D784", // 25 XLM
  ledger: 52_341_006,
  timestamp: Math.floor(Date.now() / 1000) - 600,
  txHash: "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
};

describe("translateEvent", () => {
  it("translates a SAC transfer event to plain English", () => {
    const result = translateEvent(MOCK_SAC_TRANSFER_EVENT);

    expect(result.status).toBe("translated");
    expect(result.description).toContain("transferred");
    expect(result.description).toContain("USDC");
    expect(result.description).toContain("to [");
    expect(result.eventType).toBe("Transfer");
    expect(result.blueprintName).toContain("Stellar Asset Contract");
  });

  it("translates a SAC mint event to plain English", () => {
    const result = translateEvent(MOCK_SAC_MINT_EVENT);

    expect(result.status).toBe("translated");
    expect(result.description).toContain("minted");
    expect(result.description).toContain("USDC");
    expect(result.description).toContain("to [");
    expect(result.eventType).toBe("Mint");
    expect(result.blueprintName).toContain("Stellar Asset Contract");
  });

  it("translates a SAC burn event to plain English", () => {
    const result = translateEvent(MOCK_SAC_BURN_EVENT);

    expect(result.status).toBe("translated");
    expect(result.description).toContain("burned");
    expect(result.description).toContain("XLM");
    expect(result.eventType).toBe("Burn");
    expect(result.blueprintName).toContain("Stellar Asset Contract");
  });
});
