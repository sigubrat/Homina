export interface TimeUsedRow {
    kind: "boss" | "prime" | "total";
    displayName: string;
    emoji: string;
    unitId?: string;
    time: number;
    tokens: number;
    bombs: number;
    firstStartedOn: number;
}

export interface TimeUsedLoop {
    tier: number;
    loopIndex: number;
    rarityLabel: string;
    bossRow: TimeUsedRow | null;
    primeRows: TimeUsedRow[];
    totalRow: TimeUsedRow;
}

export interface TimeUsedTypeGroup {
    type: string;
    displayName: string;
    emoji: string;
    firstStartedOn: number;
    loops: TimeUsedLoop[];
}

export interface TimeUsedResult {
    groups: TimeUsedTypeGroup[];
    totalTime: string;
}
