/**
 * Hex decoding utilities for Soroban event data.
 *
 * Soroban events encode their topics and data as XDR (External Data Representation).
 * These helpers decode XDR-encoded values into human-readable formats.
 */

import { xdr, Address } from "stellar-sdk";
import type { DecodedAddress, DecodedAmount } from "./types";

const STROOP_DIVISOR = BigInt(10_000_000);

/**
 * Shortens a Stellar address for display.
 * e.g. "GABC...WXYZ1234" → "GABC...1234"
 * e.g. "CDLZ...YSC" → "CDLZ...YSC"
 */
export function shortenAddress(publicKey: string): string {
  if (publicKey.length <= 12) return publicKey;
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

/**
 * Decodes a hex-encoded ScVal address into a canonical Stellar address string.
 *
 * Uses the Stellar SDK to parse the XDR and detect the address type:
 * - Account addresses (ed25519 public keys) are encoded as G... strings
 * - Contract addresses (contract ID hashes) are encoded as C... strings
 */
export function decodeAddress(hex: string): DecodedAddress {
  try {
    const hexStr = hex.startsWith("0x") ? hex.slice(2) : hex;
    const buffer = Buffer.from(hexStr, "hex");
    const scVal = xdr.ScVal.fromXDR(buffer);

    if (scVal.switch().name !== "scvAddress") {
      return {
        publicKey: "Unknown",
        short: "????",
      };
    }

    const address = Address.fromScVal(scVal);
    const publicKey = address.toString();

    return {
      publicKey,
      short: shortenAddress(publicKey),
    };
  } catch {
    return {
      publicKey: "Invalid",
      short: "????",
    };
  }
}

/**
 * Decodes a mock hex-encoded i128 amount (in stroops) to a human-readable value.
 * In production this would use stellar-sdk XDR decoding.
 */
export function decodeAmount(hex: string, symbol: string = "XLM"): DecodedAmount {
  // Mock: derive a deterministic amount from the hex for demo purposes.
  // Production: use StellarSdk.xdr.ScVal.fromXDR(hex, 'hex') and extract the i128.
  const rawValue = BigInt("0x" + hex.slice(2, 18).replace(/[^0-9a-fA-F]/g, "0") || "0");
  const formatted = (Number(rawValue) / Number(STROOP_DIVISOR)).toFixed(2);

  return {
    raw: rawValue,
    formatted,
    symbol,
  };
}

/**
 * Extracts the event name from the first topic hex string.
 * Soroban encodes event names as Symbol XDR values.
 * In production this would decode the XDR Symbol type.
 */
export function decodeEventName(topicHex: string): string {
  // Mock: map known topic hashes to event names for demo purposes.
  const knownTopics: Record<string, string> = {
    "0x0000000000000000000000000000000000000000000000000000000074726e73": "transfer",
    "0x000000000000000000000000000000000000000000000000000000006d696e74": "mint",
    "0x000000000000000000000000000000000000000000000000000000006275726e": "burn",
    "0x000000000000000000000000000000000000000000000000000000006170707276": "approve",
  };

  return knownTopics[topicHex] ?? "unknown";
}

/**
 * Formats a Unix timestamp into a human-readable relative time string.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Truncates a hex string for display, showing start and end.
 * e.g. "0x000000...FFFF"
 */
export function truncateHex(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 2) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`;
}
