import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AgentTrendData } from "@/types/agentAnalytics";
import { AI_TEAMMATES } from "@/types/agentAnalytics";

interface AgentEfficiencyChartProps {
  trends: AgentTrendData[];
}

export const AgentEfficiencyChart = ({ trends }: AgentEfficiencyChartProps) => {
  // Calculate rolling average (7-day) for smoother trends
  const smoothedData = trends.map((point, index) => {
    const windowSize = Math.min(7, index + 1);
    const startIndex = Math.max(0, index - windowSize + 1);
    const window = trends.slice(startIndex, index + 1);

    const smoothed: AgentTrendData = { date: point.date };

    AI_TEAMMATES.forEach((agent) => {
      const sum = window.reduce(
        (acc, p) => acc + (typeof p[agent.name] === "number" ? (p[agent.name] as number) : 0),
        0
      );
      smoothed[agent.name] = Number((sum / window.length).toFixed(2));
    });

    return smoothed;
  });

  // Filter to show fewer data points for readability
  const filteredData = smoothedData.filter((_, i) => i % 7 === 0 || i === smoothedData.length - 1);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">
          Completion Trends (7-day avg)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              {AI_TEAMMATES.map((agent) => (
                <Line
                  key={agent.name}
                  type="monotone"
                  dataKey={agent.name}
                  name={agent.name.split(" - ")[0]}
                  stroke={agent.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
