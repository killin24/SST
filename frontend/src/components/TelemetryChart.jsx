import React from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from "recharts";

/**
 * Reusable Telemetry Time-Series Line Chart
 * Features:
 * - Localized tick formatter (HH:MM:SS)
 * - Custom domain auto-scaling
 * - Disabled animations for high-frequency polling performance (prevention of memory lag / CLS)
 * - Dark mode glassmorphism styled tooltips
 */
const TelemetryChart = ({ data, dataKey, color = "var(--accent-cyan)", name, unit = "" }) => {
    // Format timestamp to localized HH:MM:SS string
    const formatXAxis = (tickItem) => {
        if (!tickItem) return "";
        try {
            const date = new Date(tickItem);
            return date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        } catch (error) {
            return String(tickItem);
        }
    };

    return (
        <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {name} Trend Over Time
            </h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                        <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={formatXAxis}
                            stroke="var(--text-secondary)"
                            fontSize={11}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis 
                            stroke="var(--text-secondary)"
                            fontSize={11}
                            tickLine={false}
                            domain={['auto', 'auto']}
                            dx={-5}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                background: 'rgba(15, 23, 42, 0.95)', 
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontFamily: 'inherit',
                                fontSize: '0.875rem'
                            }}
                            labelFormatter={(label) => `Time: ${formatXAxis(label)}`}
                            formatter={(value) => [`${Number(value).toFixed(4)}${unit}`, name]}
                        />
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 2, stroke: color, strokeWidth: 1, fill: '#0f172a' }}
                            activeDot={{ r: 4 }}
                            isAnimationActive={false} // Prevent re-rendering animations on polling updates
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TelemetryChart;