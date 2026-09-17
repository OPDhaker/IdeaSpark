"use client";

import { useState } from "react";
import { scanAttendance } from "@/app/actions";

export default function AdminPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleScan() {
    setMessage("");
    setError("");

    if (!code.trim()) {
      setError("Please enter an attendance code.");
      return;
    }

    setLoading(true);

    try {
      const response = await scanAttendance(code);

      if (response.alreadyPresent) {
        setMessage(
          `Already marked present: ${response.member.name} — ${response.team.teamName}`,
        );
      } else {
        setMessage(
          `Attendance recorded: ${response.member.name} — ${response.team.teamName}`,
        );
      }

      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan attendance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold">Admin Panel</h1>

        <section className="mt-8 rounded-lg border p-6">
          <h2 className="text-xl font-semibold">Attendance</h2>
          <p className="mt-2 text-sm text-gray-500">
            Enter the member&apos;s attendance barcode value.
          </p>

          <div className="mt-6 flex gap-3">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleScan();
                }
              }}
              placeholder="Attendance code"
              className="flex-1 rounded-md border px-3 py-2"
              disabled={loading}
            />

            <button
              onClick={handleScan}
              disabled={loading}
              className="rounded-md bg-black px-5 py-2 text-white disabled:opacity-50"
            >
              {loading ? "Scanning..." : "Scan"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-md border p-4">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md border p-4">
              {error}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}