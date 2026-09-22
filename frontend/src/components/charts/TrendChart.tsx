import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MetricPoint } from "../../types";

interface TrendChartProps {
  data: MetricPoint[];
  metricLabel: string;
  unit: string;
  color?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  metricLabel,
  unit,
  color = "#2563EB",
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-mutedText bg-surface-secondary/30 rounded-lg">
        No trend data available.
      </div>
    );
  }

  const formattedData = data.map((pt) => {
    const d = new Date(pt.timestamp);
    return {
      label: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: pt.value,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${metricLabel}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#87918C" }}
          tickLine={false}
          axisLine={{ stroke: "#DCE1DD" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#87918C" }}
          tickLine={false}
          axisLine={{ stroke: "#DCE1DD" }}
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-md border border-borderDefault bg-white p-2 shadow-md text-xs">
                  <div className="text-secondaryText">{label}</div>
                  <div className="font-semibold text-primaryText mt-0.5">
                    {metricLabel}: {payload[0].value} {unit}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#gradient-${metricLabel})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
