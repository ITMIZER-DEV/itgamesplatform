import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export function GameCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </Card>
  )
}
