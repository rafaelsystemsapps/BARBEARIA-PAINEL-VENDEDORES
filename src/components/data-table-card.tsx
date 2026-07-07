import { ReactNode } from "react";
import { Table } from "@/components/ui/table";

export function DataTableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>{children}</Table>
    </div>
  );
}
