"use client";

import { useState } from "react";
import { scanAttendance } from "@/app/actions";

export default function AdminPage() {
  const [attendanceCode, setAttendanceCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleScan() {
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const response = await scanAttendance(attendanceCode);

      if (response.status === "already_present") {
        setResult(
          `${response.member.name} from ${response.team.teamName} is already marked present.`,
        );
      } else {
        setResult(
          `Attendance recorded for ${response.member.name} from ${response.team.teamName}.`,
        );
      }

      setAttendanceCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Admin Panel</h1>

      <section>
        <h2>Attendance</h2>

        <input
          type="text"
          placeholder="Scan or enter attendance code"
          value={attendanceCode}
          onChange={(event) => setAttendanceCode(event.target.value)}
        />

        <button onClick={handleScan} disabled={loading}>
          {loading ? "Scanning..." : "Scan"}
        </button>

        {result && <p>{result}</p>}
        {error && <p>{error}</p>}
      </section>
    </main>
  );
}