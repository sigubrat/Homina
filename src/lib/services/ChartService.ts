import type { GuildRaidResult } from "@/models/types";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { CHART_COLORS } from "../utils";
import type { TeamDistribution } from "@/models/types/TeamDistribution";

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

    async createSeasonDamageChartAvg(data: GuildRaidResult[], title: string) {
        const canvas = new ChartJSNodeCanvas({
            width: this.width,
            height: this.height,
        });

        const usernames = data.map((data) => data.username);
        const damage = data.map((data) => data.totalDamage);
        const totalTokens = data.map((data) => data.totalTokens);
        const avgDamagePerToken = data.map((data) =>
            data.totalTokens > 0 ? data.totalDamage / data.totalTokens : 0
        );

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
                        borderWidth: 3,
                        fill: false,
                        tension: 0,
                        pointRadius: 3,
                        yAxisID: "y2",
                    },
                    {
                        type: "line",
                        label: "Avg Damage per Token",
                        data: avgDamagePerToken,
                        borderColor: CHART_COLORS.yellow,
                        borderWidth: 3,
                        fill: false,
                        tension: 0,
                        pointRadius: 3,
                        yAxisID: "y",
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
                            size: 20,
                        },
                        color: "white",
                    },
                    legend: {
                        display: true,
                        labels: {
                            color: "white",
                            font: {
                                size: 14,
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: {
                            color: "white",
                            font: {
                                size: 14,
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
                                size: 14,
                            },
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.4)",
                        },
                    },
                    y2: {
                        type: "linear",
                        position: "right",
                        ticks: {
                            color: "white",
                            font: {
                                size: 14,
                            },
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                },
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        return chart;
    }

    async createMetaTeamDistributionChart(
        data: TeamDistribution,
        title: string,
        showDamage: boolean = false
    ) {
        const canvas = new ChartJSNodeCanvas({
            width: this.width,
            height: this.height,
        });

        if (showDamage) {
            data.mech = data.mechDamage ?? 0;
            data.multihit = data.multihitDamage ?? 0;
            data.psyker = data.psykerDamage ?? 0;
            data.other = data.otherDamage ?? 0;
        }

        const total = data.mech + data.multihit + data.psyker + data.other;
        if (total === 0) {
            throw new Error("No data to display in the chart.");
        }

        const mechPercentage = ((data.mech / total) * 100).toFixed(1);
        const multihitPercentage = ((data.multihit / total) * 100).toFixed(1);
        const psykerPercentage = ((data.psyker / total) * 100).toFixed(1);
        const otherPercentage = ((data.other / total) * 100).toFixed(1);

        const chart = await canvas.renderToBuffer({
            type: "doughnut",
            data: {
                labels: [
                    `Multi-hit (${multihitPercentage}%)`,
                    `Mech (${mechPercentage}%)`,
                    `Psyker (${psykerPercentage}%)`,
                    `Other (${otherPercentage}%)`,
                ],
                datasets: [
                    {
                        label: title,
                        data: [
                            data.multihit,
                            data.mech,
                            data.psyker,
                            data.other,
                        ],
                        backgroundColor: [
                            CHART_COLORS.blue,
                            CHART_COLORS.red,
                            CHART_COLORS.purple,
                            CHART_COLORS.yellow,
                        ],
                    },
                ],
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 20,
                        },
                        color: "white",
                    },
                    legend: {
                        display: true,
                        labels: {
                            color: "white",
                            font: {
                                size: 14,
                            },
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
