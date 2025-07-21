export interface TimeUsed {
    time: number; // Time taken to defeat the boss in a human-readable format
    tokens: number; // Number of tokens used
    bombs: number;
    sideboss: [boolean, string];
}
