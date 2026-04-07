//**
// ChartJs utils
//  */

export const CHART_COLORS = {
    red: "rgb(255, 99, 132)",
    orange: "rgb(255, 159, 64)",
    yellow: "rgb(255, 205, 86)",
    green: "rgb(75, 192, 192)",
    blue: "rgb(54, 162, 235)",
    purple: "rgb(153, 102, 255)",
    grey: "rgb(201, 203, 207)",
    discordbg: "rgb(57,58,65)",
};

const NAMED_COLORS = [
    CHART_COLORS.red,
    CHART_COLORS.orange,
    CHART_COLORS.yellow,
    CHART_COLORS.green,
    CHART_COLORS.blue,
    CHART_COLORS.purple,
    CHART_COLORS.grey,
    "rgb(255, 0, 0)",
    "rgb(0, 200, 83)",
    "rgb(0, 150, 255)",
    "rgb(255, 87, 34)",
    "rgb(156, 39, 176)",
    "rgb(0, 188, 212)",
    "rgb(255, 235, 59)",
    "rgb(121, 85, 72)",
    "rgb(233, 30, 99)",
    "rgb(63, 81, 181)",
    "rgb(0, 230, 118)",
    "rgb(255, 145, 0)",
    "rgb(103, 58, 183)",
    "rgb(0, 151, 167)",
    "rgb(244, 67, 54)",
    "rgb(139, 195, 74)",
    "rgb(33, 150, 243)",
    "rgb(255, 193, 7)",
    "rgb(96, 125, 139)",
    "rgb(171, 71, 188)",
    "rgb(0, 200, 150)",
    "rgb(255, 112, 67)",
    "rgb(100, 181, 246)",
];

export function namedColor(index: number) {
    return NAMED_COLORS[index % NAMED_COLORS.length];
}
