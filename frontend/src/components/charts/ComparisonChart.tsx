import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { MetricSeries } from "../../types";

interface ComparisonChartProps {
  series: MetricSeries[];
}

const SERIES_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED"];

const METRIC_LABELS: Record<string, string> = {
  soil_moisture: "Soil Moisture",
  temperature: "Temperature",
  humidity: "Humidity",
  crop_health: "Crop Health",
  pest_activity: "Pest Activity",
  disease_risk: "Disease Risk",
  water_consumption: "Water Consumption",
};

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ series }) => {
  if (!series || series.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-mutedText bg-surface-secondary/30 rounded-lg">
        No metric data available for the selected parameters.
      </div>
    );
  }

  // Merge series points by timestamp
  const timeMap: Map<string, any> = new Map();

  series.forEach((s) => {
    s.points.forEach((pt) => {
      // Format timestamp for display: e.g. "10:30" or "Sep 22 10:00"
      const date = new Date(pt.timestamp);
      const timeLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const fullLabel = s.period === "24h"
        ? timeLabel
        : `${date.getMonth() + 1}/${date.getDate()} ${timeLabel}`;

      if (!timeMap.has(pt.timestamp)) {
        timeMap.set(pt.timestamp, {
          rawTimestamp: pt.timestamp,
          label: fullLabel,
        });
      }
      const entry = timeMap.get(pt.timestamp);
      entry[s.metric] = pt.value;
      entry[`${s.metric}_unit`] = s.unit;
    });
  });

  const chartData = Array.from(timeMap.values()).sort(
    (a, b) => new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime()
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
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
                <div className="rounded-md border border-borderDefault bg-white p-2.5 shadow-md text-xs">
                  <div className="font-semibold text-primaryText mb-1.5 pb-1 border-b border-borderDefault/60">
                    {label}
                  </div>
                  <div className="space-y-1">
                    {payload.map((item, idx) => {
                      const metricKey = item.dataKey as string;
                      const metricObj = series.find((s) => s.metric === metricKey);
                      const unit = metricObj?.unit || "";
                      const displayName = METRIC_LABELS[metricKey] || metricKey;

                      return (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-secondaryText">{displayName}:</span>
                          </div>
                          <strong className="text-primaryText">
                            {item.value} {unit}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          verticalAlign="top"
          height={32}
          formatter={(value) => (
            <span className="text-xs text-secondaryText font-medium">
              {METRIC_LABELS[value] || value}
            </span>
          )}
        />
        {series.map((s, idx) => (
          <Line
            key={s.metric}
            type="monotone"
            dataKey={s.metric}
            stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 1 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};
