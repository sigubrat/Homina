export interface Token {
    // Define token properties as needed
    current: number;
    max: number;
    nextTokenInSeconds?: number;
    regenDelayInSeconds: number;
}
