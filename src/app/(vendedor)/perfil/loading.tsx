import { HeaderSkeleton, FormSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <FormSkeleton fields={5} />
    </div>
  );
}
