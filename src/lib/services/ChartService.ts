import type { GuildRaidResult } from "@/models/types";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import {
    CHART_COLORS,
    namedColor,
    numericMedian,
    shortenNumber,
    standardDeviation,
} from "@/lib/utils";
import type { TeamDistribution } from "@/models/types/TeamDistribution";
import type { Highscore } from "@/models/types/Highscore";
import { dbController } from "../DatabaseController";
import ChartDataLabels from "chartjs-plugin-datalabels";

const CHART_WIDTH = 1200;
const CHART_HEIGHT = 800;

const canvas = new ChartJSNodeCanvas({
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    backgroundColour: CHART_COLORS.discordbg,
    plugins: {
        modern: [ChartDataLabels],
    },
});

export class ChartService {
    async createSeasonDamageChart(
        data: GuildRaidResult[],
        title: string,
        showBombs: boolean = false,
        average: "mean" | "median" = "median",
        averageValue: number
    ) {
        const usernames = data.map((data) => data.username);
        const damage = data.map((data) => data.totalDamage);
        const totalTokens = data.map((data) => data.totalTokens);
        const bombCount = data.map((data) => data.bombCount);

        // Build datasets array conditionally
        const datasets: any[] = [
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
                type: "line",
                label:
                    average === "mean"
                        ? "Guild average damage"
                        : "Guild median damage",
                data: Array(usernames.length).fill(averageValue),
                borderColor: CHART_COLORS.yellow,
                borderWidth: 2,
                fill: false,
                tension: 0,
                pointRadius: 0,
                yAxisID: "y",
                borderDash: [5, 5],
            },
            {
                backgroundColor: CHART_COLORS.blue,
                label: title,
                data: damage,
                borderWidth: 1,
                datalabels: {
                    display: true,
                    color: CHART_COLORS.blue,
                    anchor: "end",
                    align: "top",
                    font: {
                        size: "11",
                    },
                    formatter: function (value: number) {
                        return shortenNumber(value);
                    },
                },
            },
        ];

        if (showBombs) {
            datasets.splice(1, 0, {
                type: "line",
                label: "Bomb Count",
                data: bombCount,
                borderColor: CHART_COLORS.red,
                borderWidth: 2,
                fill: false,
                tension: 0,
                pointRadius: 1.5,
                yAxisID: "y2",
            });
        }

        const chart = await canvas.renderToBuffer({
            type: "bar",
            data: {
                labels: usernames,
                datasets,
            },
            options: {
                plugins: {
                    datalabels: { display: false },
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
                        border: {
                            display: false,
                        },
                    },
                    y: {
                        ticks: {
                            color: CHART_COLORS.blue,
                            font: {
                                size: 12,
                            },
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.2)",
                        },
                        border: {
                            display: false,
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
                            drawOnChartArea: false,
                        },
                        border: {
                            display: false,
                        },
                    },
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        bottom: 10,
                        top: 10,
                    },
                },
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        return chart;
    }

    async createSeasonDamageChartAvg(
        data: GuildRaidResult[],
        title: string,
        average: "Mean" | "Median" = "Median",
        averageValue: number
    ) {
        const usernames: string[] = [];
        const damage: number[] = [];
        const primeDamage: number[] = [];
        const totalTokens: number[] = [];
        const avgDamagePerToken: number[] = [];

        data.forEach((item) => {
            usernames.push(item.username);
            damage.push(item.totalDamage - (item.primeDamage ?? 0));
            primeDamage.push(item.primeDamage ?? 0);
            totalTokens.push(item.totalTokens);
            avgDamagePerToken.push(
                item.totalTokens > 0 ? item.totalDamage / item.totalTokens : 0
            );
        });

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
                        label:
                            average === "Mean"
                                ? `Guild mean damage (${averageValue.toLocaleString(
                                      undefined,
                                      {
                                          maximumFractionDigits: 0,
                                      }
                                  )})`
                                : `Guild median damage (${averageValue.toLocaleString(
                                      undefined,
                                      {
                                          maximumFractionDigits: 0,
                                      }
                                  )})`,
                        data: Array(usernames.length).fill(averageValue),
                        borderColor: CHART_COLORS.yellow,
                        borderWidth: 2,
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                        yAxisID: "y",
                        borderDash: [5, 5],
                    },
                    {
                        type: "line",
                        label: "Avg Damage per Token",
                        data: avgDamagePerToken,
                        borderColor: CHART_COLORS.red,
                        borderWidth: 3,
                        fill: false,
                        tension: 0,
                        pointRadius: 3,
                        yAxisID: "y3",
                        datalabels: {
                            display: true,
                            color: "white",
                            anchor: "end",
                            align: 300,
                            font: {
                                size: 11,
                            },
                            formatter: function (value: number) {
                                return value > 0 ? shortenNumber(value) : null;
                            },
                        },
                    },
                    {
                        backgroundColor: CHART_COLORS.purple,
                        label: "Prime damage",
                        data: primeDamage,
                        borderWidth: 1,
                        datalabels: {
                            display: true,
                            color: "white",
                            anchor: "center",
                            font: {
                                size: 11,
                            },
                            formatter: function (value: number) {
                                return value > 0 ? shortenNumber(value) : null;
                            },
                        },
                    },
                    {
                        backgroundColor: CHART_COLORS.blue,
                        label: "Total damage",
                        data: damage,
                        borderWidth: 1,
                        datalabels: {
                            display: true,
                            color: CHART_COLORS.blue,
                            anchor: "end",
                            align: "top",
                            offset: 2,
                            font: {
                                size: 11,
                            },
                            formatter: function (value: number) {
                                return value > 0 ? shortenNumber(value) : null;
                            },
                        },
                    },
                ],
            },
            options: {
                plugins: {
                    datalabels: { display: false },
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
                            padding: 10,
                        },
                        grid: {
                            display: false,
                        },
                        stacked: true,
                    },
                    y: {
                        ticks: {
                            color: CHART_COLORS.blue,
                            font: {
                                size: 14,
                            },
                        },
                        grid: {
                            display: false,
                        },
                        border: {
                            display: false,
                        },
                        stacked: true,
                    },
                    y2: {
                        type: "linear",
                        position: "right",
                        ticks: {
                            color: "white",
                            font: {
                                size: 14,
                            },
                            stepSize: 1,
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.4)",
                        },
                        border: {
                            display: false,
                        },
                    },
                    y3: {
                        type: "linear",
                        position: "left",
                        ticks: {
                            color: CHART_COLORS.red,
                            font: {
                                size: 12,
                            },
                        },
                        grid: {
                            display: false,
                        },
                        border: {
                            display: false,
                        },
                    },
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        bottom: 10,
                        top: 10,
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
                    datalabels: { display: false },
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
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        bottom: 10,
                        top: 10,
                    },
                },
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        return chart;
    }

    async createNumberUsedChart(
        data: Record<string, number>,
        title: string,
        guildAvg: number,
        avgLabel: string,
        maxValue: number
    ) {
        const entries = Object.entries(data);
        entries.sort((a, b) => b[1] - a[1]);

        const usernames = entries.map(([username]) => username);
        const uses = entries.map(([, n]) => n);
        const stdev = standardDeviation(uses);

        if (usernames.length === 0) {
            throw new Error("No data to display in the chart.");
        }

        const chart = await canvas.renderToBuffer({
            type: "bar",
            data: {
                labels: usernames,
                datasets: [
                    {
                        type: "line",
                        label: `${avgLabel} (${guildAvg.toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits: 1,
                            }
                        )})`,
                        data: Array(usernames.length).fill(guildAvg),
                        borderColor: CHART_COLORS.yellow,
                        borderWidth: 2,
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                        yAxisID: "y",
                        borderDash: [5, 5],
                    },
                    {
                        label: title,
                        data: uses,
                        backgroundColor: (context: any) => {
                            const value =
                                context.dataset.data[context.dataIndex];
                            if (value > guildAvg + stdev) {
                                return CHART_COLORS.purple;
                            } else if (value > guildAvg - stdev) {
                                // This covers (guildAvg - stdev, guildAvg + stdev]
                                return CHART_COLORS.blue;
                            } else if (value > guildAvg - 2 * stdev) {
                                // This covers (guildAvg - 2*stdev, guildAvg - stdev]
                                return CHART_COLORS.yellow;
                            } else {
                                // value <= guildAvg - 2*stdev
                                return CHART_COLORS.red;
                            }
                        },
                        borderWidth: 1,
                        datalabels: {
                            display: true,
                            color: "white",
                            anchor: "end",
                            align: "top",
                            font: {
                                size: 11,
                            },
                            formatter: function (value: number) {
                                return shortenNumber(value);
                            },
                        },
                    },
                ],
            },
            options: {
                plugins: {
                    datalabels: { display: false },
                    title: {
                        display: true,
                        text: [
                            title,
                            "Green: >1σ above avg   |   Blue: ±1σ of avg   |   Yellow: -1σ to -2σ   |   Red: ≤-2σ",
                        ],
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
                                size: 14,
                            },
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.4)",
                        },
                        max: maxValue,
                        min: 0,
                    },
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        bottom: 10,
                        top: 10,
                    },
                },
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        return chart;
    }

    async createTimelineChart(data: Record<number, number>, title: string) {
        const hours = Object.keys(data).map((key) => parseInt(key));
        const values = Object.values(data);
        if (hours.length === 0 || values.length === 0) {
            throw new Error("No data to display in the chart.");
        }
        const median = numericMedian(values);
        const stdev = standardDeviation(values);
        const now = new Date().getUTCHours();

        const chart = await canvas.renderToBuffer({
            type: "bar",
            data: {
                labels: hours.map((hour) => `${hour}:00-${hour}:59`),
                datasets: [
                    {
                        label: "Total activity per hour",
                        data: values,
                        backgroundColor: (context: any) => {
                            const value =
                                context.dataset.data[context.dataIndex];
                            if (value > median + stdev) {
                                return CHART_COLORS.green;
                            } else if (value > median - stdev) {
                                return CHART_COLORS.blue;
                            } else if (value > median - 1.5 * stdev) {
                                return CHART_COLORS.yellow;
                            } else {
                                return CHART_COLORS.red;
                            }
                        },
                        // yellow border if the hour is the current hour
                        borderColor: (context: any) => {
                            const hour = parseInt(
                                context.chart.data.labels[
                                    context.dataIndex
                                ].split(":")[0]
                            );
                            if (hour === now) {
                                return CHART_COLORS.yellow;
                            }
                            return "rgba(255, 255, 255, 0.0)";
                        },
                        borderWidth: 2,
                        tension: 1,
                        pointRadius: 1.5,
                    },
                ],
            },
            options: {
                plugins: {
                    datalabels: { display: false },
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
                            color: (context: any) => {
                                const hour = context.tick.label;
                                if (parseInt(hour.split(":")[0]) === now) {
                                    return CHART_COLORS.yellow; // Highlight current hour
                                }
                                return "white";
                            },
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
                            callback: function (value: number | string) {
                                return value + "%";
                            },
                            color: "white",
                            font: {
                                size: 14,
                            },
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.4)",
                        },
                    },
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        bottom: 10,
                        top: 10,
                    },
                },
            },
        });

        return chart;
    }

    async createHighscoreChart(
        data: Record<string, Highscore[]>,
        title: string
    ) {
        const allUsernames = new Set<string>();

        // Collect all unique usernames across all bosses
        for (const highscores of Object.values(data)) {
            highscores.forEach((highscore) =>
                allUsernames.add(highscore.username)
            );
        }

        const userIds = Array.from(allUsernames);

        const usernames = await dbController.getPlayerNames(userIds);
        const labels = userIds.map((id) => usernames[id] || "Unknown");
        const datasets = Object.entries(data).map(
            ([boss, highscores], colorIndex) => {
                const scores = userIds.map((username) => {
                    const userScore = highscores.find(
                        (highscore) => highscore.username === username
                    );
                    return userScore ? userScore.value : 0;
                });
                return {
                    type: "line" as const,
                    label: boss,
                    data: scores,
                    borderColor: namedColor(colorIndex),
                    borderWidth: 2,
                    fill: false,
                    tension: 0,
                    pointRadius: 1.5,
                };
            }
        );

        const chart = await canvas.renderToBuffer({
            type: "line",
            data: {
                labels: labels,
                datasets,
            },
            options: {
                plugins: {
                    datalabels: { display: false },
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
                },
                layout: {
                    padding: {
                        left: 20,
                        right: 20,
                        bottom: 10,
                        top: 10,
                    },
                },
                responsive: true,
                maintainAspectRatio: false,
            },
        });

        return chart;
    }
}
