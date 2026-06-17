"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { FileJson, Upload, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCustomAbi } from "@/lib/translator/custom-abi";
import type { CustomAbi } from "@/lib/translator/types";

interface UploadAbiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (abi: CustomAbi) => void;
}

export function UploadAbiDialog({
  open,
  onOpenChange,
  onUpload,
}: UploadAbiDialogProps): React.JSX.Element {
  const [contractId, setContractId] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm(): void {
    setContractId("");
    setJsonText("");
    setError(null);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (): void {
      setJsonText(typeof reader.result === "string" ? reader.result : "");
      setError(null);
    };
    reader.onerror = function (): void {
      setError("Could not read the selected file.");
    };
    reader.readAsText(file);

    // Allow re-selecting the same file later.
    e.target.value = "";
  }

  function handleSubmit(): void {
    if (!jsonText.trim()) {
      setError("Paste an ABI or choose a .json file first.");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      setError("The ABI is not valid JSON. Please check the file and try again.");
      return;
    }

    try {
      const abi = parseCustomAbi(parsedJson, contractId);
      onUpload(abi);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse this ABI.");
    }
  }

  function handleOpenChange(next: boolean): void {
    if (!next) resetForm();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-violet-500" />
            Upload Custom ABI
          </DialogTitle>
          <DialogDescription>
            Translate events from a contract that isn&apos;t in the global registry yet. Upload the
            JSON produced by{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
              soroban contract bindings
            </code>
            . It is stored only in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Contract ID */}
          <div className="space-y-1.5">
            <label htmlFor="abi-contract-id" className="text-sm font-medium">
              Contract ID
            </label>
            <Input
              id="abi-contract-id"
              value={contractId}
              onChange={function (e) {
                setContractId(e.target.value);
              }}
              placeholder="C..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The deployed contract address these events come from. Optional if the ABI file already
              contains a <code className="font-mono">contractId</code>.
            </p>
          </div>

          {/* ABI JSON */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="abi-json" className="text-sm font-medium">
                ABI JSON
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={function () {
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                Choose file
              </Button>
            </div>
            <textarea
              id="abi-json"
              value={jsonText}
              onChange={function (e) {
                setJsonText(e.target.value);
                setError(null);
              }}
              rows={8}
              spellCheck={false}
              placeholder={
                '{\n  "contractName": "My Token",\n  "events": [\n    { "name": "transfer", "fields": [{ "name": "from", "type": "address" }] }\n  ]\n}'
              }
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              onClick={function () {
                handleOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Add ABI</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
