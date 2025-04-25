import type { GuildRaidResult } from "@/models/types";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { CHART_COLORS } from "../utils";

export class ChartService {
    private width: number;
    private height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    async createSeasonDamageChart(data: GuildRaidResult[], title: string) {
        const canvas = new ChartJSNodeCanvas({
            width: this.width,
            height: this.height,
        });

        const usernames = data.map((data) => data.username); // Extract labels
        const damage = data.map((data) => data.totalDamage); // Extract values
        const totalTokens = data.map((data) => data.totalTokens); // Extract total tokens

        const chart = await canvas.renderToBuffer({
            type: "bar",
            data: {
                labels: usernames,
                datasets: [
                    {
                        type: "line",
                        label: "Total Tokens",
                        data: totalTokens,
                        borderColor: CHART_COLORS.orange,
                        borderWidth: 2,
                        fill: false,
                        tension: 0,
                        pointRadius: 1.5,
                        yAxisID: "y2",
                    },
                    {
                        backgroundColor: CHART_COLORS.blue,
                        label: title,
                        data: damage,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 18,
                        },
                        color: "white",
                    },
                    legend: {
                        display: true,
                        labels: {
                            color: "white",
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: {
                            color: "white",
                            font: {
                                size: 12,
                            },
                        },
                        grid: {
                            display: false,
                        },
                    },
                    y: {
                        ticks: {
                            color: "white",
                            font: {
                                size: 12,
                            },
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.2)",
                        },
                    },
                    y2: {
                        type: "linear",
                        position: "right",
                        ticks: {
                            color: "white",
                            font: {
                                size: 12,
                            },
                        },
                        grid: {
                            drawOnChartArea: false, // Prevent grid lines from overlapping
                        },
                    },
                },
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        return chart;
    }
}
