export interface DbTestResult {
    isSuccess: boolean;
    message?: string;
}

export function validateEnvVars(requiredVars: string[]): void {
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error(
            `Missing environment variables: ${missingVars.join(
                ", "
            )}. Please ensure all required variables are set.`
        );
        process.exit(1);
    }
}
