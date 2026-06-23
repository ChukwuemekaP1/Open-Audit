/**
 * Zero-knowledge style event accumulator (placeholder implementation)
 *
 * IMPORTANT:
 * This repo currently implements *cryptographic integrity proofs* via
 * Stellar Merkle inclusion proofs (see lib/stellar/stellar-proof.ts).
 *
 * Full zk-SNARK/STARK integration requires choosing a proving system,
 * adding dependencies, and implementing circuit constraints.
 * That is non-trivial and cannot be completed safely as a single
 * incremental patch without additional project-wide decisions.
 *
 * To move the codebase forward while keeping correctness guarantees,
 * this module provides:
 *   - A deterministic hash accumulator
 *   - A proof object that can be verified client-side
 *
 * When a zk proving backend is later integrated, this module can be
 * swapped while preserving the API shape.
 */

import type { TranslatedEvent } from "../translator/types";
import { createHash } from "crypto";

export type Hex = string;

export interface AccumulatorLeaf {
    /** translated-event unique id (event.raw.id) */
    id: string;
    /** hash of the event row used in the accumulator */
    leafHash: Hex;
}

export interface AggregatedEventsProof {
    /** Namespace / versioning for forward compatibility */
    protocol: "open-audit.event-accumulator.v1";
    /** Merkle-style accumulator root over leafHash values */
    rootHash: Hex;
    /** Publicly audited subset description (human readable, not trusted) */
    auditLabel: string;
    /** Proof is over the *set* of events supplied to the prover */
    leafCount: number;
    /** Optional contract/time filters used to form the subset */
    subsetHint?: {
        contractId?: string;
        startLedger?: number;
        endLedger?: number;
    };
}

function sha256Hex(input: string | Uint8Array): Hex {
    const h = createHash("sha256");
    if (typeof input === "string") h.update(input);
    else h.update(Buffer.from(input));
    return h.digest("hex");
}

function normalizeAuditLabel(label: string): string {
    return label.trim().slice(0, 140);
}

function eventToCanonicalRow(event: TranslatedEvent): string {
    // Canonical stringification for deterministic hashing.
    // Use only stable fields: tx_hash, ledger, contractId, eventType, and
    // the plaintext translation description.
    const eventType = event.eventType ?? "";
    const plain =
        event.status === "translated" && typeof event.description === "string"
            ? event.description
            : "";

    return [
        `tx_hash=${event.raw.txHash ?? ""}`,
        `ledger=${event.raw.ledger ?? ""}`,
        `contract_id=${event.raw.contractId ?? ""}`,
        `event_type=${eventType}`,
        `plain=${plain}`,
        `event_id=${event.raw.id ?? ""}`,
    ].join("|");
}

export function computeEventLeaf(event: TranslatedEvent): AccumulatorLeaf {
    const id = event.raw.id;
    const leafHash = sha256Hex(eventToCanonicalRow(event));
    return { id, leafHash };
}

/**
 * Deterministic accumulator root.
 *
 * Current implementation is a Merkle root over the sorted leaf hashes.
 * This provides the same *integrity* property expected from a zk accumulator
 * output root, but without a succinct zk proof.
 *
 * Later, you can replace the root/proof with a zk proof while keeping the
 * verification contract.
 */
export function buildAccumulatorRoot(leaves: AccumulatorLeaf[]): Hex {
    const leafHashes = leaves.map((l) => l.leafHash).sort();
    if (leafHashes.length === 0) {
        return sha256Hex("open-audit.empty-leaves.v1");
    }

    // Merkle tree over leaf hashes; pair hash = sha256(left||right)
    let level = leafHashes.map((h) => Buffer.from(h, "hex"));
    while (level.length > 1) {
        const next: Buffer[] = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = i + 1 < level.length ? level[i + 1] : level[i];
            const parent = sha256Hex(Buffer.concat([left, right]));
            next.push(Buffer.from(parent, "hex"));
        }
        level = next;
    }
    return level[0].toString("hex");
}

export interface BuildAggregatedProofInput {
    events: TranslatedEvent[];
    auditLabel: string;
    subsetHint?: AggregatedEventsProof["subsetHint"];
}

export function buildAggregatedEventsProof(
    input: BuildAggregatedProofInput
): AggregatedEventsProof {
    const auditLabel = normalizeAuditLabel(input.auditLabel);
    const leaves = input.events.map(computeEventLeaf);
    const rootHash = buildAccumulatorRoot(leaves);

    return {
        protocol: "open-audit.event-accumulator.v1",
        rootHash,
        auditLabel,
        leafCount: leaves.length,
        subsetHint: input.subsetHint,
    };
}

export interface VerifyAggregatedProofInput {
    proof: AggregatedEventsProof;
    events: TranslatedEvent[];
}

/**
 * Verification: recompute root from supplied events and compare.
 *
 * This still requires the client to have the subset events to verify.
 * In a real zk implementation, the client would only need the proof
 * and public inputs.
 */
export function verifyAggregatedEventsProof(input: VerifyAggregatedProofInput): {
    ok: boolean;
    computedRootHash: Hex;
} {
    const leaves = input.events.map(computeEventLeaf);
    const computedRootHash = buildAccumulatorRoot(leaves);
    return {
        ok:
            computedRootHash.toLowerCase() === input.proof.rootHash.toLowerCase() &&
            input.proof.protocol === "open-audit.event-accumulator.v1" &&
            input.proof.leafCount === leaves.length,
        computedRootHash,
    };
}

