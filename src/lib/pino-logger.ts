import { pino } from "pino";

const fileTransport = pino.transport({
    targets: [
        {
            target: "pino/file",
            options: { destination: "./logs/app.log" },
            level: "info",
        },
        {
            target: "pino/file",
            options: { destination: ".logs/error.log" },
            level: "error",
        },
    ],
});

export const logger = pino(fileTransport);
