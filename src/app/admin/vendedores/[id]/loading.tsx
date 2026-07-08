import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <TableSkeleton cols={6} />
    </div>
  );
}
