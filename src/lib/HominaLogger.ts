import { pino } from "pino";

const fileTransport = pino.transport({
    targets: [
        {
            target: "pino-roll",
            options: {
                file: "./logs/app/app",
                frequency: "daily",
                extension: ".log",
                dateFormat: "dd-MM-yyyy",
                limit: { count: 30, removeOtherLogFiles: true },
            },
            level: "info",
        },
        {
            target: "pino-roll",
            options: {
                file: "./logs/error/error",
                frequency: "daily",
                extension: ".log",
                dateFormat: "dd-MM-yyyy",
                limit: { count: 30, removeOtherLogFiles: true },
            },
            level: "error",
        },
    ],
});

export const logger = pino(fileTransport);
