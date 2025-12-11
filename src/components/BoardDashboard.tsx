import { useMemo, useState } from "react";
import { MetricCard } from "./MetricCard";
import { ResponseTimeChart } from "./ResponseTimeChart";
import { TicketTable } from "./TicketTable";
import { NetNewTicketChart } from "./NetNewTicketChart";
import { FirstResponseTrendChart } from "./FirstResponseTrendChart";
import { AutomationSavingsCard } from "./AutomationSavingsCard";
import { OpenTicketTrendChart } from "./OpenTicketTrendChart";
import { CurrentStateTicketsTable } from "./CurrentStateTicketsTable";
import { useTicketAnalytics } from "@/hooks/useTicketAnalytics";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Clock, TrendingDown, Ticket, BarChart3 } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CategoryBreakdownCard } from "./CategoryBreakdownCard";
import { DateRangeSelector, DateRange } from "./DateRangeSelector";
import { StatusDistributionChart } from "./StatusDistributionChart";

interface BoardDashboardProps {
  board: "TIE" | "SFDC";
  boardName: string;
}

export const BoardDashboard = ({ board, boardName }: BoardDashboardProps) => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>(365);

  // Use the custom hook for all data loading and analytics (with archive data)
  const {
    analytics,
    enhancedData,
    tickets,
    loading,
    error,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useTicketAnalytics(board, true, dateRange);

  // Handle refresh with toast notification
  const handleRefresh = async () => {
    await refresh();
    toast({
      title: "Data refreshed",
      description: "Dashboard updated with latest Asana data",
    });
  };

  // Show error toast if there's an error
  if (error) {
    toast({
      title: "Error loading data",
      description: error.message,
      variant: "destructive",
    });
  }

  const formatHours = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(2)}h`;
    return `${(hours / 24).toFixed(2)}d`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Loading {boardName} Dashboard</p>
              <p className="text-sm text-muted-foreground">Fetching tickets from Asana...</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              {boardName} Board Analytics
            </h1>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Recent Avg Response"
            value={formatHours(analytics.recentAvg)}
            icon={<Clock className="w-5 h-5" />}
            change={analytics.improvement}
            changeLabel="improvement"
            trend={analytics.improvement > 0 ? "up" : analytics.improvement < 0 ? "down" : "neutral"}
          />
          <MetricCard
            title="Historical Avg"
            value={formatHours(analytics.previousAvg)}
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <MetricCard
            title="Time Saved"
            value={formatHours(analytics.previousAvg - analytics.recentAvg)}
            icon={<TrendingDown className="w-5 h-5" />}
            trend="up"
          />
          <MetricCard
            title="Recent Tickets"
            value={analytics.recentCount.toString()}
            icon={<Ticket className="w-5 h-5" />}
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Long-Term Trends</TabsTrigger>
            <TabsTrigger value="automation">Automation Savings</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="current">Current State</TabsTrigger>
            <TabsTrigger value="tickets">Recent Tickets</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <ResponseTimeChart
              data={analytics.chartData}
              rolloutDate="Oct 21"
            />
            <StatusDistributionChart tickets={tickets} board={board} />
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <div className="flex justify-end">
              <DateRangeSelector selected={dateRange} onChange={setDateRange} />
            </div>
            {enhancedData && (
              <>
                <OpenTicketTrendChart data={enhancedData.openTrends} />
                <NetNewTicketChart data={enhancedData.netNewTrends} />
                <FirstResponseTrendChart
                  data={enhancedData.dualResponseTrends}
                  rolloutDate="Oct 21"
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            {enhancedData && (
              <AutomationSavingsCard data={enhancedData.automationAnalytics} />
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            {enhancedData && (
              <CategoryBreakdownCard data={enhancedData.categories} />
            )}
          </TabsContent>

          <TabsContent value="current" className="space-y-6">
            <CurrentStateTicketsTable tickets={tickets} board={board} />
          </TabsContent>

          <TabsContent value="tickets" className="space-y-6">
            <TicketTable
              tickets={tickets.filter(t => analytics.recentTickets.some(rt => rt.id === t.id))}
              board={board}
              title="Recent Tickets (Since Last Thursday)"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
