import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

function isValidDateFormat(dateStr: string): boolean {
    const regex = /^\d{2}-\d{2}-\d{4}$/;
    return regex.test(dateStr);
}

async function promptLogType(): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (query: string): Promise<string> =>
        new Promise((resolve) => rl.question(query, resolve));

    let typeStr = "";
    do {
        typeStr = (await question("Enter log type (app or error): "))
            .trim()
            .toLowerCase();
        if (typeStr !== "app" && typeStr !== "error") {
            console.log("Invalid log type. Please enter 'app' or 'error'.");
        }
    } while (typeStr !== "app" && typeStr !== "error");

    rl.close();
    return typeStr;
}

async function promptDate(): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (query: string): Promise<string> =>
        new Promise((resolve) => rl.question(query, resolve));

    let dateStr = "";
    do {
        dateStr = await question("Enter the date (dd-MM-yyyy): ");
        if (!isValidDateFormat(dateStr)) {
            console.log("Invalid date format. Please use dd-MM-yyyy.");
        }
    } while (!isValidDateFormat(dateStr));

    rl.close();
    return dateStr;
}

function formatLogLine(line: string): string {
    if (!line.trim()) return "";
    try {
        const logObj = JSON.parse(line);
        const logTime = new Date(logObj.time).toLocaleString();
        return `Time: ${logTime} | Level: ${logObj.level} | PID: ${logObj.pid} | Hostname: ${logObj.hostname} | Message: ${logObj.msg}`;
    } catch (error) {
        console.error("Error parsing log line:", error);
        return line;
    }
}

async function processLogFile() {
    try {
        const logType = await promptLogType();
        const dateStr = await promptDate();

        const filename = `${logType}.${dateStr}.log`;
        let logPath = path.join(`logs/${logType}/`, filename);

        if (!fs.existsSync(logPath)) {
            // try again with an appended number
            let i = 1;
            const attempts = 3;
            logPath = logPath.replace(/\.log$/, `.${i}.log`);
            for (; i <= 3; i++) {
                if (fs.existsSync(logPath)) {
                    break;
                }
                if (i === attempts) {
                    console.error(
                        `File "${filename}" does not exist at path: ${logPath}`
                    );
                    return;
                }
            }
        }

        const logContent = fs.readFileSync(logPath, "utf8");
        const lines = logContent.split(/\r?\n/);

        const prefix = logType.toUpperCase();

        const outputLines = lines
            .map((line) => {
                const formatted = formatLogLine(line);
                return formatted ? `${prefix} ${formatted}` : "";
            })
            .filter((line) => line.trim() !== "");

        const outputContent = outputLines.join("\n");

        const outputFilename = `${logType}.${dateStr}.formatted.log`;
        const outputPath = `logs/${outputFilename}`;
        fs.writeFileSync(outputPath, outputContent, "utf8");

        console.log(`Formatted logs written to ${outputPath}`);
    } catch (error) {
        console.error("Error processing log file:", error);
    }
}

processLogFile();
