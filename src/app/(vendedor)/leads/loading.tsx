import { HeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <TableSkeleton cols={4} />
    </div>
  );
}
