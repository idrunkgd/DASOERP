"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary btn-sm">
      <Printer className="w-4 h-4" /> Export PDF
    </button>
  );
}

export function MonthPicker({ month }: { month: string }) {
  return (
    <input
      type="month" defaultValue={month}
      className="input text-sm max-w-[150px]"
      onChange={(e) => { if (typeof window !== "undefined") window.location.href = `/timesheet/overview?month=${e.target.value}`; }}
    />
  );
}
