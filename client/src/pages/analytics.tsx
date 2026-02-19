import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Map, Users, TrendingUp, DollarSign, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { format } from "date-fns";
import type { Profile } from "@shared/schema";

type DateRange = "30d" | "3m" | "12m" | "all";

const rangeLabels: Record<DateRange, string> = {
  "30d": "Last 30 days",
  "3m": "Last 3 months",
  "12m": "Last 12 months",
  "all": "All time",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(var(--muted-foreground) / 0.4)",
  planning: "hsl(24 70% 45%)",
  confirmed: "hsl(142 60% 40%)",
  in_progress: "hsl(210 70% 50%)",
  completed: "hsl(142 50% 35%)",
  cancelled: "hsl(0 50% 50%)",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  planning: "Planning",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatMonth(month: string) {
  const [y, m] = month.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return format(d, "MMM ''yy");
}

function formatCurrency(value: number, currency: string = "USD") {
  if (value >= 1000000) return `${currency} ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${currency} ${(value / 1000).toFixed(0)}K`;
  return `${currency} ${value.toLocaleString()}`;
}

function StatCard({ label, value, subtitle, icon: Icon, delay = 0 }: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Map;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/60 font-medium">{label}</p>
            <div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
          </div>
          <p className="font-serif text-3xl tracking-tight" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/50 mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyChart({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-6">
      <BarChart3 className="w-8 h-8 text-muted-foreground/20 mb-3" strokeWidth={1} />
      <p className="text-sm text-muted-foreground/40">
        {message || "Not enough data yet — this will populate as you create trips."}
      </p>
    </div>
  );
}

function ChartTooltipContent({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border/50 rounded-md shadow-lg px-3 py-2 text-sm">
      <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="font-medium text-foreground">
          {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>("12m");
  const [, navigate] = useLocation();

  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics", range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?range=${range}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const isOwner = profile?.role === "owner";

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto" data-testid="analytics-page">
        <div className="max-w-6xl mx-auto p-6 md:p-8 lg:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-9 w-48" />
            </div>
            <Skeleton className="h-9 w-64" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-72 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const tripsOverTime = data?.tripsOverTime || [];
  const topDestinations = data?.topDestinations || [];
  const tripsByStatus = data?.tripsByStatus || [];
  const topClients = data?.topClients || [];
  const advisorActivity = data?.advisorActivity || [];

  const chartColor = "hsl(24 70% 45%)";
  const chartColorLight = "hsl(24 70% 45% / 0.15)";

  return (
    <div className="flex-1 overflow-y-auto" data-testid="analytics-page">
      <div className="max-w-6xl mx-auto p-6 md:p-8 lg:p-10">

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-end justify-between gap-4 mb-10"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">Business Intelligence</p>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight" data-testid="text-analytics-title">Analytics</h1>
          </div>
          <div className="flex items-center gap-1 bg-muted/30 rounded-md p-0.5" data-testid="date-range-selector">
            {(Object.entries(rangeLabels) as [DateRange, string][]).map(([key, label]) => (
              <Button
                key={key}
                variant={range === key ? "default" : "ghost"}
                size="sm"
                onClick={() => setRange(key)}
                className="text-xs"
                data-testid={`range-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Total Trips"
            value={summary.totalTrips || 0}
            subtitle={`Created in ${rangeLabels[range].toLowerCase()}`}
            icon={Map}
            delay={0.05}
          />
          <StatCard
            label="Active Trips"
            value={summary.activeTrips || 0}
            subtitle="Planning, confirmed, or in progress"
            icon={TrendingUp}
            delay={0.1}
          />
          <StatCard
            label="Total Clients"
            value={summary.totalClients || 0}
            icon={Users}
            delay={0.15}
          />
          <StatCard
            label="Total Trip Value"
            value={formatCurrency(summary.portfolioValue || 0, summary.currency || "USD")}
            subtitle="Trips with budget set"
            icon={DollarSign}
            delay={0.2}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Trip Activity</p>
              <h3 className="font-serif text-lg tracking-tight mb-6" data-testid="text-trips-over-time">Trips Over Time</h3>
              {tripsOverTime.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={tripsOverTime} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tripGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border) / 0.3)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonth}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground) / 0.5)" }}
                      axisLine={false}
                      tickLine={false}
                      dy={8}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground) / 0.4)" }}
                      axisLine={false}
                      tickLine={false}
                      dx={-4}
                    />
                    <Tooltip
                      content={<ChartTooltipContent formatter={(v: number) => `${v} trips`} />}
                      labelFormatter={formatMonth}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={chartColor}
                      strokeWidth={2}
                      fill="url(#tripGradient)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="h-full">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Destinations</p>
                <h3 className="font-serif text-lg tracking-tight mb-6" data-testid="text-top-destinations">Top Destinations</h3>
                {topDestinations.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topDestinations}
                      layout="vertical"
                      margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border) / 0.3)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground) / 0.4)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="destination"
                        width={120}
                        tick={{ fontSize: 12, fill: "hsl(var(--foreground) / 0.7)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltipContent formatter={(v: number) => `${v} trips`} />} />
                      <Bar
                        dataKey="count"
                        fill={chartColor}
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        fillOpacity={0.8}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <Card className="h-full">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Breakdown</p>
                <h3 className="font-serif text-lg tracking-tight mb-6" data-testid="text-trips-by-status">Trips by Status</h3>
                {tripsByStatus.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={tripsByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="status"
                            stroke="none"
                          >
                            {tripsByStatus.map((entry: any, idx: number) => (
                              <Cell
                                key={idx}
                                fill={STATUS_COLORS[entry.status] || "hsl(var(--muted-foreground) / 0.3)"}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-popover border border-border/50 rounded-md shadow-lg px-3 py-2 text-sm">
                                  <p className="font-medium">{STATUS_LABELS[d.status] || d.status}</p>
                                  <p className="text-muted-foreground">{d.count} trips</p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2.5 shrink-0">
                      {tripsByStatus.map((s: any) => (
                        <div key={s.status} className="flex items-center gap-2.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: STATUS_COLORS[s.status] || "hsl(var(--muted-foreground) / 0.3)" }}
                          />
                          <span className="text-sm text-foreground/80">{STATUS_LABELS[s.status] || s.status}</span>
                          <span className="text-sm text-muted-foreground/50 ml-auto tabular-nums">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card>
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Clients</p>
                <h3 className="font-serif text-lg tracking-tight mb-4" data-testid="text-most-active-clients">Most Active Clients</h3>
                {topClients.length === 0 || topClients.every((c: any) => c.totalTrips === 0) ? (
                  <EmptyChart message="No client activity in this period." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-top-clients">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left pb-3 text-xs uppercase tracking-[0.1em] text-muted-foreground/50 font-medium">Client</th>
                          <th className="text-right pb-3 text-xs uppercase tracking-[0.1em] text-muted-foreground/50 font-medium">Trips</th>
                          <th className="text-right pb-3 text-xs uppercase tracking-[0.1em] text-muted-foreground/50 font-medium hidden sm:table-cell">Last Trip</th>
                          <th className="text-right pb-3 text-xs uppercase tracking-[0.1em] text-muted-foreground/50 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topClients.filter((c: any) => c.totalTrips > 0).map((client: any, idx: number) => (
                          <tr
                            key={client.id}
                            className="border-b border-border/10 last:border-0 cursor-pointer hover-elevate"
                            onClick={() => navigate(`/clients/${client.id}`)}
                            data-testid={`row-client-${client.id}`}
                          >
                            <td className="py-3 text-foreground/80">{client.name}</td>
                            <td className="py-3 text-right tabular-nums text-foreground/60">{client.totalTrips}</td>
                            <td className="py-3 text-right text-foreground/40 text-xs hidden sm:table-cell">
                              {client.mostRecentTrip
                                ? format(new Date(client.mostRecentTrip), "MMM d, yyyy")
                                : "—"
                              }
                            </td>
                            <td className="py-3 text-right tabular-nums text-foreground/60">
                              {client.totalValue > 0
                                ? formatCurrency(client.totalValue, summary.currency || "USD")
                                : "—"
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {isOwner && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
            >
              <Card>
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/50 font-medium mb-1">Team</p>
                  <h3 className="font-serif text-lg tracking-tight mb-4" data-testid="text-advisor-activity">Advisor Activity</h3>
                  {advisorActivity.length === 0 ? (
                    <EmptyChart message="No advisor data available." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-advisor-activity">
                        <thead>
                          <tr className="border-b border-border/30">
                            <th className="text-left pb-3 text-xs uppercase tracking-[0.1em] text-muted-foreground/50 font-medium">Advisor</th>
                            <th className="text-right pb-3 text-xs uppercase tracking-[0.1em] text-muted-foreground/50 font-medium">Trips</th>
                            <th className="text-right pb-3 text-xs uppercase tracking-[0.1em] text-muted-foreground/50 font-medium">Clients</th>
                          </tr>
                        </thead>
                        <tbody>
                          {advisorActivity.map((advisor: any) => (
                            <tr
                              key={advisor.id}
                              className="border-b border-border/10 last:border-0"
                              data-testid={`row-advisor-${advisor.id}`}
                            >
                              <td className="py-3 text-foreground/80">{advisor.name}</td>
                              <td className="py-3 text-right tabular-nums text-foreground/60">{advisor.tripsCreated}</td>
                              <td className="py-3 text-right tabular-nums text-foreground/60">{advisor.clientsManaged}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}
