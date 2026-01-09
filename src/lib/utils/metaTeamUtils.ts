//**
// Tacticus utils
//  */

import { MetaTeams } from "@/models/enums/MetaTeams";
import type { MetaComps } from "@/models/types/MetaComps";
import { META_TEAM_THRESHOLD } from "../configs/constants";
import {
    battlesuitTeam,
    custodesTeam,
    lynchpinHeroes,
    mechTeam,
    multiHitTeam,
    neuroTeam,
} from "../configs/metaTeamConfig";

export interface TeamCheck {
    inBattlesuit: boolean;
    inMulti: boolean;
    inMech: boolean;
    inNeuro: boolean;
    inCustodes: boolean;
}

/**
 * Checks if a given hero belongs to any of the predefined teams and returns an object indicating membership.
 *
 * @param hero - The name of the hero to check for team membership.
 * @returns An object of type `TeamCheck` with boolean flags for each team indicating if the hero is a member.
 */
export function inTeamsCheck(hero: string): TeamCheck {
    const teamCheck: TeamCheck = {
        inMulti: false,
        inMech: false,
        inNeuro: false,
        inCustodes: false,
        inBattlesuit: false,
    };

    teamCheck.inMulti = multiHitTeam.includes(hero);
    teamCheck.inMech = mechTeam.includes(hero);
    teamCheck.inNeuro = neuroTeam.includes(hero);
    teamCheck.inCustodes = custodesTeam.includes(hero);
    teamCheck.inBattlesuit = battlesuitTeam.includes(hero);

    return teamCheck;
}

/**
 * Determines whether the provided list of heroes contains all lynchpin heroes required for a given team.
 *
 * @param heroes - An array of hero names to check.
 * @param team - The name of the team whose lynchpin heroes are required.
 * @returns `true` if all lynchpin heroes for the specified team are present in the heroes array; otherwise, `false`.
 */
export function hasLynchpinHeroes(heroes: string[], team: string): boolean {
    const requiredHeroes = lynchpinHeroes[team];
    if (!requiredHeroes || requiredHeroes.length === 0) {
        return false;
    }

    return requiredHeroes.every((requiredHero) =>
        heroes.includes(requiredHero)
    );
}

/**
 * Determines the meta team classification for a given list of hero names.
 *
 * The function analyzes the provided heroes to check their inclusion in various meta teams
 * (MULTIHIT, ADMECH, NEURO, CUSTODES) based on predefined thresholds and the presence of lynchpin heroes.
 * Returns the corresponding `MetaTeams` enum value representing the identified meta team,
 * or `MetaTeams.OTHER` if no meta team criteria are met.
 *
 * @param heroes - An array of hero names to evaluate for meta team classification.
 * @returns The `MetaTeams` enum value representing the meta team classification.
 */
export function getMetaTeam(heroes: string[]): MetaTeams {
    const teamCheck = heroes.map((hero) => inTeamsCheck(hero));
    const distribution = {
        mh: 0,
        admech: 0,
        neuro: 0,
        custodes: 0,
        battlesuit: 0,
    };

    teamCheck.forEach((check) => {
        if (check.inMulti) distribution.mh++;
        if (check.inMech) distribution.admech++;
        if (check.inNeuro) distribution.neuro++;
        if (check.inCustodes) distribution.custodes++;
        if (check.inBattlesuit) distribution.battlesuit++;
    });

    if (
        distribution.mh >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.MULTIHIT)
    ) {
        return MetaTeams.MULTIHIT;
    } else if (
        distribution.admech >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.ADMECH)
    ) {
        return MetaTeams.ADMECH;
    } else if (
        distribution.neuro >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.NEURO)
    ) {
        return MetaTeams.NEURO;
    } else if (
        distribution.custodes >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.CUSTODES)
    ) {
        return MetaTeams.CUSTODES;
    } else if (
        distribution.battlesuit >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.BATTLESUIT)
    ) {
        return MetaTeams.BATTLESUIT;
    }

    return MetaTeams.OTHER;
}

/**
 * Determines which meta teams are present in a given list of heroes.
 *
 * For each meta team (multihit, admech, neuro, custodes), the function checks if the number of heroes
 * associated with that team meets or exceeds the `META_TEAM_THRESHOLD` and if the required lynchpin heroes
 * for that team are present. If both conditions are met, the corresponding meta team flag is set to `true`.
 *
 * @param heroes - An array of hero names to evaluate for meta team composition.
 * @returns An object indicating which meta teams are present in the provided hero list.
 */
export function getMetaTeams(heroes: string[]): MetaComps {
    const teamCheck = heroes.map((hero) => inTeamsCheck(hero));
    const distribution = {
        multihit: 0,
        admech: 0,
        neuro: 0,
        custodes: 0,
        battlesuit: 0,
    };

    const retval: MetaComps = {
        multihit: false,
        admech: false,
        neuro: false,
        custodes: false,
        battlesuit: false,
    };

    teamCheck.forEach((check) => {
        if (check.inMulti) distribution.multihit++;
        if (check.inMech) distribution.admech++;
        if (check.inNeuro) distribution.neuro++;
        if (check.inCustodes) distribution.custodes++;
        if (check.inBattlesuit) distribution.battlesuit++;
    });

    if (
        distribution.multihit >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.MULTIHIT)
    ) {
        retval.multihit = true;
    }
    if (
        distribution.admech >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.ADMECH)
    ) {
        retval.admech = true;
    }
    if (
        distribution.neuro >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.NEURO)
    ) {
        retval.neuro = true;
    }
    if (
        distribution.custodes >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.CUSTODES)
    ) {
        retval.custodes = true;
    }
    if (
        distribution.battlesuit >= META_TEAM_THRESHOLD &&
        hasLynchpinHeroes(heroes, MetaTeams.BATTLESUIT)
    ) {
        retval.battlesuit = true;
    }

    return retval;
}
