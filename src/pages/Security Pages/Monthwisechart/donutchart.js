import React, { useEffect, useRef, useState } from "react";
import Chart from "react-apexcharts";

const DonutChart = ({ labels, series, colors, onSegmentClick }) => {
  const chartRef = useRef(null);
  const [isChartInitialized, setIsChartInitialized] = useState(false);

  useEffect(() => {
    console.log("DonutChart mounted, initializing chart...");
    setIsChartInitialized(true);

    return () => {
      console.log("DonutChart unmounting, destroying chart...");
      if (chartRef.current && chartRef.current.chart) {
        try {
          chartRef.current.chart.destroy();
          setIsChartInitialized(false);
          console.log("Chart destroyed successfully.");
        } catch (err) {
          console.warn("Error destroying chart:", err);
        }
      }
    };
  }, []);

  if (!labels || !Array.isArray(labels) || labels.length === 0) {
    console.error("Invalid labels prop:", labels);
    return <div className="text-center py-4 text-muted">Invalid chart labels.</div>;
  }

  if (!series || !Array.isArray(series) || series.length !== labels.length || !series.every(val => typeof val === "number")) {
    console.error("Invalid series prop:", series);
    return <div className="text-center py-4 text-muted">Invalid chart data.</div>;
  }

  const options = {
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (event, chartContext, config) => {
          console.log("dataPointSelection triggered:", { event, chartContext, config });
          if (!isChartInitialized || !chartContext || !config || typeof config.dataPointIndex !== "number") {
            console.warn("Chart not initialized or invalid selection data, ignoring click:", { isChartInitialized, chartContext, config });
            return;
          }
          const category = labels[config.dataPointIndex];
          if (category && onSegmentClick) {
            console.log("Calling onSegmentClick with category:", category);
            onSegmentClick(category);
          } else {
            console.warn("No category found for index:", config.dataPointIndex);
          }
        },
      },
    },
    labels: labels,
    colors: colors,
    legend: {
      position: "bottom",
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: { width: 200 },
          legend: { position: "bottom" },
        },
      },
    ],
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              formatter: () => series.reduce((a, b) => a + b, 0),
            },
          },
        },
      },
    },
  };

  return (
    <div className="donut-chart">
      <Chart
        ref={chartRef}
        options={options}
        series={series}
        type="donut"
        height={350}
      />
    </div>
  );
};

export default DonutChart;