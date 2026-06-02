import { Skeleton } from "@/components/ui/skeleton";

/** Render N skeleton rows that visually match a data-table row. */
export function TableSkeletonRows({
  colSpan,
  rows = 4,
}: {
  colSpan: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={`sk-${i}`}>
          <td colSpan={colSpan} className="py-2">
            <Skeleton className="h-5 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}
