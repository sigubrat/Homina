import type { GuildRaidResult } from "@/models/types";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { shortenNumber } from "@/lib/utils/utils";
import { numericMedian } from "../utils/mathUtils";
import { standardDeviation } from "../utils/mathUtils";
import type { TeamDistribution } from "@/models/types/TeamDistribution";
import type { Highscore } from "@/models/types/Highscore";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Context } from "chartjs-plugin-datalabels";
import { CHART_COLORS, namedColor } from "../utils/colorUtils";

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
        averageValue: number,
    ) {
        const usernames = data.map((data) => data.username);
        const totalTokens = data.map((data) => data.totalTokens);
        const bombCount = data.map((data) => data.bombCount);

        // Split into boss damage and prime damage for stacked bars
        const primeDamage = data.map((data) => data.primeDamage ?? 0);
        const bossDamage = data.map(
            (data) => data.totalDamage - (data.primeDamage ?? 0),
        );
        const totalDamage = data.map((data) => data.totalDamage);

        // Build datasets array
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
            // Stacked bars: prime damage on top of boss damage
            {
                backgroundColor: CHART_COLORS.purple,
                label: "Prime Damage",
                data: primeDamage,
                borderWidth: 1,
                stack: "damage",
                datalabels: {
                    display: true,
                    color: "white",
                    anchor: function (context: { dataIndex: number }) {
                        // Position above bar if segment is too small (less than 10% of total)
                        const total = totalDamage[context.dataIndex] ?? 1;
                        const value = primeDamage[context.dataIndex] ?? 0;
                        return value / total < 0.1 ? "end" : "center";
                    },
                    align: function (context: { dataIndex: number }) {
                        const total = totalDamage[context.dataIndex] ?? 1;
                        const value = primeDamage[context.dataIndex] ?? 0;
                        return value / total < 0.1 ? "top" : "center";
                    },
                    rotation: -45,
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
                label: "Boss Damage",
                data: bossDamage,
                borderWidth: 1,
                stack: "damage",
                datalabels: {
                    display: true,
                    color: "white",
                    anchor: "center",
                    rotation: -45,
                    font: {
                        size: 11,
                    },
                    formatter: function (value: number) {
                        return value > 0 ? shortenNumber(value) : null;
                    },
                },
            },
            // Transparent stacked bar to display total damage label on top
            {
                backgroundColor: "transparent",
                label: "Total Damage",
                data: totalDamage.map((total, i) => {
                    // Calculate what's left after boss and prime to position label at top
                    const boss = bossDamage[i] ?? 0;
                    const prime = primeDamage[i] ?? 0;
                    return total - boss - prime; // Should be 0, but keeps stack alignment
                }),
                borderWidth: 0,
                stack: "damage",
                // Hide from legend since this is just for labeling
                hidden: false,
                datalabels: {
                    display: true,
                    color: CHART_COLORS.green,
                    anchor: "end",
                    align: "top",
                    font: {
                        size: 11,
                        weight: "bold",
                    },
                    formatter: function (
                        _value: number,
                        context: { dataIndex: number },
                    ) {
                        return shortenNumber(totalDamage[context.dataIndex]!);
                    },
                },
            },
        ];

        // Filter out "Total Damage" from legend
        const legendFilter = (legendItem: { text: string }) =>
            legendItem.text !== "Total Damage";

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
                            filter: legendFilter,
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
                        stacked: true,
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
                        stacked: true,
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
        averageValue: number,
        showMaxDamage: boolean = false,
    ) {
        const usernames: string[] = [];
        const damage: number[] = [];
        const primeDamage: number[] = [];
        const totalTokens: number[] = [];
        const avgDamagePerToken: number[] = [];
        const maxDamage: number[] = [];

        data.forEach((item) => {
            usernames.push(item.username);
            damage.push(item.totalDamage - (item.primeDamage ?? 0));
            primeDamage.push(item.primeDamage ?? 0);
            totalTokens.push(item.totalTokens);
            avgDamagePerToken.push(
                item.totalTokens > 0 ? item.totalDamage / item.totalTokens : 0,
            );
            maxDamage.push(item.maxDmg ?? 0);
        });

        const chart = await canvas.renderToBuffer({
            type: "bar",
            data: {
                labels: usernames,
                datasets: [
                    {
                        type: "line",
                        label: "Avg Damage per Token",
                        data: avgDamagePerToken,
                        borderColor: CHART_COLORS.grey,
                        borderWidth: 3,
                        fill: false,
                        tension: 0,
                        pointRadius: 3,
                        yAxisID: "y3",
                        borderDash: [5, 5],
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
                                      },
                                  )})`
                                : `Guild median damage (${averageValue.toLocaleString(
                                      undefined,
                                      {
                                          maximumFractionDigits: 0,
                                      },
                                  )})`,
                        data: Array(usernames.length).fill(averageValue),
                        borderColor: CHART_COLORS.yellow,
                        borderWidth: 2,
                        fill: false,
                        tension: 0,
                        pointRadius: 0,
                        yAxisID: "y3",
                        borderDash: [5, 5],
                    },
                    ...(showMaxDamage
                        ? [
                              {
                                  type: "line" as const,
                                  label: "Max Damage per Token",
                                  data: maxDamage,
                                  borderColor: CHART_COLORS.red,
                                  borderWidth: 3,
                                  fill: false,
                                  tension: 0,
                                  pointRadius: 3,
                                  yAxisID: "y3",
                                  datalabels: {
                                      display: false,
                                  },
                              },
                          ]
                        : []),
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
                            padding: 20,
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
                            color: CHART_COLORS.orange,
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
                            color: CHART_COLORS.grey,
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
                        bottom: 20,
                        top: 20,
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
        showDamage: boolean = false,
    ) {
        if (showDamage) {
            data.mech = data.mechDamage ?? 0;
            data.multihit = data.multihitDamage ?? 0;
            data.neuro = data.neuroDamage ?? 0;
            data.custodes = data.custodesDamage ?? 0;
            data.battlesuit = data.battlesuitDamage ?? 0;
            data.other = data.otherDamage ?? 0;
        }

        const total =
            data.mech + data.multihit + data.neuro + data.custodes + data.other;
        if (total === 0) {
            throw new Error("No data to display in the chart.");
        }

        const mechPercentage = ((data.mech / total) * 100).toFixed(1);
        const multihitPercentage = ((data.multihit / total) * 100).toFixed(1);
        const psykerPercentage = ((data.neuro / total) * 100).toFixed(1);
        const custodesPercentage = ((data.custodes / total) * 100).toFixed(1);
        const battlesuitPercentage = ((data.battlesuit / total) * 100).toFixed(
            1,
        );
        const otherPercentage = ((data.other / total) * 100).toFixed(1);

        const chart = await canvas.renderToBuffer({
            type: "doughnut",
            data: {
                labels: [
                    `Multi-hit (${multihitPercentage}%)`,
                    `Mech (${mechPercentage}%)`,
                    `Psyker (${psykerPercentage}%)`,
                    `Custodes (${custodesPercentage}%)`,
                    `Battlesuit (${battlesuitPercentage}%)`,
                    `Other (${otherPercentage}%)`,
                ],
                datasets: [
                    {
                        label: title,
                        data: [
                            data.multihit,
                            data.mech,
                            data.neuro,
                            data.custodes,
                            data.battlesuit,
                            data.other,
                        ],
                        backgroundColor: [
                            CHART_COLORS.blue,
                            CHART_COLORS.red,
                            CHART_COLORS.purple,
                            CHART_COLORS.orange,
                            CHART_COLORS.green,
                            CHART_COLORS.grey,
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
        maxValue: number,
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
                            },
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
                                ].split(":")[0],
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
        title: string,
    ) {
        const allUsernames = new Set<string>();

        // Collect all unique usernames across all bosses
        for (const highscores of Object.values(data)) {
            highscores.forEach((highscore) =>
                allUsernames.add(highscore.username),
            );
        }

        const usernames = Array.from(allUsernames);

        const datasets = Object.entries(data).map(
            ([boss, highscores], colorIndex) => {
                const scores = usernames.map((username) => {
                    const userScore = highscores.find(
                        (highscore) => highscore.username === username,
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
            },
        );

        const chart = await canvas.renderToBuffer({
            type: "line",
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

    /**
     * Creates a horizontal bar chart showing relative performance per player.
     * Bars are color-coded by performance tier and a dashed line marks 100% (guild average).
     *
     * @param data Record of player names to their relative performance percentage.
     * @param title The chart title.
     * @returns A Buffer containing the rendered chart PNG.
     */
    async createRelativePerformanceChart(
        data: Record<string, number>,
        title: string,
    ) {
        const sorted = Object.entries(data).sort(([, a], [, b]) => b - a);
        const usernames = sorted.map(([name]) => name);
        const values = sorted.map(([, value]) => value - 100);

        // Padding
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        const padding = 10;
        const axisMax = Math.ceil((maxVal + padding) / 10) * 10;
        const axisMin = Math.floor((minVal - padding) / 10) * 10;

        const backgroundColors = values.map((value) => {
            if (value >= 20) return CHART_COLORS.purple;
            if (value >= 10) return CHART_COLORS.green;
            if (value >= 0) return CHART_COLORS.blue;
            if (value >= -10) return CHART_COLORS.yellow;
            if (value >= -20) return CHART_COLORS.orange;
            return CHART_COLORS.red;
        });

        const chart = await canvas.renderToBuffer({
            type: "bar",
            data: {
                labels: usernames,
                datasets: [
                    {
                        label: "Relative Performance",
                        data: values,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        datalabels: {
                            display: true,
                            color: "white",
                            anchor: function (context: Context) {
                                const rawValue =
                                    context.dataset.data[context.dataIndex];
                                const value =
                                    typeof rawValue === "number" ? rawValue : 0;
                                return value >= 0 ? "end" : "start";
                            },
                            align: function (context: Context) {
                                const rawValue =
                                    context.dataset.data[context.dataIndex];
                                const value =
                                    typeof rawValue === "number" ? rawValue : 0;
                                return value >= 0 ? "right" : "left";
                            },
                            font: {
                                size: 12,
                                weight: "bold",
                            },
                            formatter: function (value: number) {
                                const sign = value >= 0 ? "+" : "";
                                return sign + value.toFixed(1) + "%";
                            },
                        },
                    },
                    {
                        type: "line",
                        label: "Guild Average (0%)",
                        data: Array(usernames.length).fill(0),
                        borderColor: CHART_COLORS.yellow,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        datalabels: {
                            display: false,
                        },
                    },
                ],
            },
            options: {
                indexAxis: "y",
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
                            font: {
                                size: 12,
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        min: axisMin,
                        max: axisMax,
                        ticks: {
                            color: "white",
                            font: {
                                size: 12,
                            },
                            callback: function (value: string | number) {
                                const num =
                                    typeof value === "string"
                                        ? parseFloat(value)
                                        : value;
                                const sign = num >= 0 ? "+" : "";
                                return sign + num + "%";
                            },
                        },
                        grid: {
                            color: "rgba(255, 255, 255, 0.1)",
                        },
                        border: {
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
                        right: 60,
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
