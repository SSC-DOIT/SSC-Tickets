import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { DualResponseTrendPoint } from "@/types/analytics";

interface FirstResponseTrendChartProps {
  data: DualResponseTrendPoint[];
  rolloutDate?: string;
}

const formatMinutes = (minutes: number | null): string => {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const FirstResponseTrendChart = ({ data, rolloutDate }: FirstResponseTrendChartProps) => {
  // Find the rollout date index for the reference line
  const rolloutIndex = data.findIndex((d) => d.date === rolloutDate);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">First Response Time Trend</h3>
          <p className="text-sm text-muted-foreground">
            Weekly average first response time (AI vs Human) in business minutes
          </p>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              label={{
                value: "Minutes",
                angle: -90,
                position: "insideLeft",
                style: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              formatter={(value: number | null, name: string) => {
                if (value === null) return ["No data", name];
                return [formatMinutes(value), name];
              }}
              labelFormatter={(label) => `Week of ${label}`}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
              )}
            />
            {rolloutDate && rolloutIndex >= 0 && (
              <ReferenceLine
                x={rolloutDate}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: "Automation Rollout",
                  position: "top",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="avgAIResponseMinutes"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              name="AI Teammate"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="avgHumanResponseMinutes"
              stroke="hsl(25 95% 53%)"
              strokeWidth={2.5}
              dot={{ fill: "hsl(25 95% 53%)", strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              name="Human"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">AI Teammate Response</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: "hsl(25 95% 53%)" }} 
            />
            <span className="text-muted-foreground">Human Response</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
