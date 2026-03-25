import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Repeat } from "lucide-react";
import { RecurringCharge } from "@/lib/recurring";
import { format } from "date-fns";

export function RecurringTransactions({ charges }: { charges: RecurringCharge[] }) {
  if (charges.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-base">Recurring Charges</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Repeat className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No recurring charges detected yet.</p>
            <p className="text-xs mt-1">Patterns emerge after 2+ months of data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalMonthly = charges.reduce((s, c) => s + c.monthlyEstimate, 0);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recurring Charges</CardTitle>
          <span className="text-sm text-muted-foreground">~৳{totalMonthly.toLocaleString()}/mo</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {charges.map((charge) => (
            <div key={charge.merchant} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{charge.merchant}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{charge.frequency}</Badge>
                  <span className="text-xs text-muted-foreground">{charge.count} charges</span>
                  {charge.confidence >= 0.8 && <Badge variant="secondary" className="text-xs">Reliable</Badge>}
                </div>
                {charge.nextExpectedDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Next: ~{format(new Date(charge.nextExpectedDate), "MMM d")}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">৳{charge.avgAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">~৳{charge.monthlyEstimate.toLocaleString()}/mo</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
