import { HeaderSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/page-skeletons";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <StatCardsSkeleton />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <div className="px-6 pb-6">
          <TableSkeleton cols={6} />
        </div>
      </Card>
    </div>
  );
}
