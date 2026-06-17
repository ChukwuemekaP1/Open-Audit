# Contributing to Open-Audit

Thank you for your interest in contributing! Open-Audit is a community-driven project and every contribution — from fixing a typo to adding a full translation blueprint — makes the Stellar ecosystem more transparent.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Running Tests](#running-tests)
5. [Code Standards](#code-standards)
6. [How to Add a Translation Blueprint](#how-to-add-a-translation-blueprint)
7. [Submitting a Pull Request](#submitting-a-pull-request)
8. [Good First Issues](#good-first-issues)

---

## Code of Conduct

Be respectful, inclusive, and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/open-audit.git
   cd open-audit
   ```
3. **Add the upstream remote:**
   ```bash
   git remote add upstream https://github.com/your-org/open-audit.git
   ```

---

## Development Setup

### Prerequisites

- Node.js >= 18 (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm >= 9

### Install Dependencies

```bash
npm install
```

### Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your preferred Stellar network endpoints. The defaults point to **testnet**, which is safe for development.

### Start the Dev Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run type checking
npx tsc --noEmit

# Run linting
npm run lint
```

All tests live alongside the code they test in `__tests__` directories or as `*.test.ts` files.

---

## Code Standards

Please read [CODE_STANDARDS.md](CODE_STANDARDS.md) before writing any code. The most important rules:

- **Standard function declarations only** — no arrow functions for component or utility definitions.
- **No `any` types** — use proper TypeScript interfaces.
- **Prettier formatting** — run `npm run format` before committing.

---

## How to Add a Translation Blueprint

This is the most impactful contribution you can make. A **blueprint** teaches Open-Audit how to translate a specific contract's events into plain English.

### Step-by-Step Guide

#### Step 1: Understand Soroban Event Structure

Soroban contract events have a consistent structure:
- `contractId`: The contract's address (starts with "C")
- `topics`: An array of hex-encoded XDR values
  - `topics[0]`: The event name/discriminant (encoded as a Symbol XDR)
  - `topics[1..n]`: Additional indexed fields (like addresses)
- `data`: Hex-encoded XDR payload for unindexed fields (like amounts)

#### Step 2: Identify the Contract

Find:
1. The contract's deployed address (Contract ID)
2. The contract's ABI or event schema (defines which topics/data each event uses)
3. Real sample events from the network (for testing)

#### Step 3: Create the Blueprint File

Create `/lib/translator/blueprints/your-contract-name.ts`:

```typescript
import { decodeAddress, decodeAmount } from "../decode";
import type { TranslationBlueprint, TranslationResult, RawEvent } from "../types";

/** Hex-encoded event topics (Symbol XDR). */
const YOUR_EVENT_TOPIC = "0x00000000000000000000000000000000000000000000000000000000796f75725f6576656e74";

/** Translate your event. */
function translateYourEvent(event: RawEvent): TranslationResult | null {
  if (!event.topics[0]?.includes("796f75725f6576656e74")) return null;

  const field1 = decodeAddress(event.topics[1] ?? "0x00");
  const field2 = decodeAddress(event.topics[2] ?? "0x00");
  const amount = decodeAmount(event.data, "SYMBOL");

  return {
    description: `[${field1.short}] did something with [${field2.short}] for ${amount.formatted} SYMBOL`,
    eventType: "Your Event",
  };
}

/** Create the full blueprint. */
export function createYourContractBlueprint(): TranslationBlueprint {
  return {
    contractId: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    contractName: "Your Contract Name",
    translate: function (event: RawEvent): TranslationResult | null {
      return translateYourEvent(event);
    },
  };
}
```

#### Step 4: Register the Blueprint

Open `/lib/translator/registry.ts` and import + register your blueprint:

```typescript
import { createYourContractBlueprint } from "./blueprints/your-contract-name";

// Add to buildRegistry()
const yourBlueprint = createYourContractBlueprint();
registry.set(yourBlueprint.contractId, yourBlueprint);
```

#### Step 5: Test Locally

Use the Custom ABI feature in the dashboard first to test your event structure:

1. Start the dev server: `npm run dev`
2. Open http://localhost:3000
3. Click "Upload ABI" and paste your JSON configuration
4. Test with sample events

#### JSON Configuration Example (for Custom ABI Testing)

Here's a clean, copy-pasteable JSON configuration you can use with the "Upload ABI" dialog:

```json
{
  "contractId": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "contractName": "Your Contract Name",
  "events": [
    {
      "name": "your_event",
      "fields": [
        { "name": "from", "type": "address" },
        { "name": "to", "type": "address" },
        { "name": "amount", "type": "i128" }
      ]
    }
  ]
}
```

#### Step 6: Run the Test Suite

Before pushing a PR, always run:

```bash
# Run all tests
npm test

# Run type checking
npx tsc --noEmit

# Run linting
npm run lint

# Format code
npm run format
```

#### Step 7: Add a Test File (Optional but Recommended)

Add a test in `/lib/translator/__tests__/your-contract-name.test.ts` with real raw events from the network.

---

## Submitting a Pull Request

1. Create a feature branch: `git checkout -b feat/your-feature-name`
2. Make your changes following the code standards.
3. Run `npm run lint` and `npm run format` — fix any issues.
4. Run `npx tsc --noEmit` — fix any type errors.
5. Commit with a clear message: `git commit -m "feat: add Soroswap swap translation blueprint"`
6. Push and open a PR against `main`.

### PR Checklist

- [ ] Code follows [CODE_STANDARDS.md](CODE_STANDARDS.md)
- [ ] No `any` types introduced
- [ ] All functions use standard declarations (no arrow functions)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npx tsc --noEmit`)
- [ ] PR description explains what was changed and why

---

## Good First Issues

Check [`/docs/good-first-issues.json`](docs/good-first-issues.json) for beginner-friendly tasks, or look for issues labeled `good first issue` on GitHub.

Questions? Open a Discussion on GitHub or reach out in the Stellar Developer Discord.
