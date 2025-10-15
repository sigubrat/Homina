//**
// Tacticus utils
//  */

import { MetaTeams } from "@/models/enums/MetaTeams";
import type { MetaComps } from "@/models/types/MetaComps";
import { characters } from "../configs/characters";
import { META_TEAM_THRESHOLD } from "../configs/constants";

// PublicHeroDetail ids

export const multiHitTeam = [
    characters.Bellator?.id,
    characters.Aethana?.id,
    characters.Snotflogga?.id,
    characters.Eldryon?.id,
    characters.Gulgortz?.id,
    characters.Kharn?.id,
    characters.Ragnar?.id,
    characters.Helbrecht?.id,
    characters.Dante?.id,
    characters.Calgar?.id,
    characters.AunShi?.id,
    characters.Asmodai?.id,
    characters.Forcas?.id,
    characters.Trajann?.id,
    characters.Isabella?.id,
];

export const mechTeam = [
    characters.AlephNull?.id,
    characters.Actus?.id,
    characters.TanGida?.id,
    characters.ExitorRho?.id,
    characters.Gulgortz?.id,
    characters.Shosyl?.id,
    characters.Revas?.id,
    characters.Vitruvius?.id,
    characters.Helbrecht?.id,
    characters.Trajann?.id,
];

export const neuroTeam = [
    characters.Eldryon?.id,
    characters.Yazaghor?.id,
    characters.Ahriman?.id,
    characters.Neurothrope?.id,
    characters.Abraxas?.id,
    characters.Roswitha?.id,
    characters.Xybia?.id,
    characters.Mephiston?.id,
];

export const custodesTeam = [
    characters.Trajann.id,
    characters.Kariyan.id,
    characters.Ragnar.id,
    characters.Kharn.id,
    characters.Dante.id,
    characters.Mephiston.id,
    characters.Abaddon.id,
    characters.Helbrecht.id,
    characters.Isabella.id,
];

const lynchpinHeroes: Record<string, string[]> = {
    Multihit: [characters.Ragnar.id],
    Admech: [
        characters.ExitorRho.id,
        characters.Actus.id,
        characters.TanGida.id,
    ],
    Neuro: [characters.Neurothrope.id],
    Custodes: [characters.Trajann.id, characters.Kariyan.id],
};

export interface TeamCheck {
    inMulti: boolean;
    inMech: boolean;
    inNeuro: boolean;
    inCustodes: boolean;
}

export function inTeamsCheck(hero: string): TeamCheck {
    const teamCheck: TeamCheck = {
        inMulti: false,
        inMech: false,
        inNeuro: false,
        inCustodes: false,
    };

    teamCheck.inMulti = multiHitTeam.includes(hero);
    teamCheck.inMech = mechTeam.includes(hero);
    teamCheck.inNeuro = neuroTeam.includes(hero);
    teamCheck.inCustodes = custodesTeam.includes(hero);

    return teamCheck;
}

export function hasLynchpinHeroes(heroes: string[], team: string): boolean {
    const requiredHeroes = lynchpinHeroes[team];
    if (!requiredHeroes || requiredHeroes.length === 0) {
        return false;
    }

    return requiredHeroes.every((requiredHero) =>
        heroes.includes(requiredHero)
    );
}

export function getMetaTeam(heroes: string[]): MetaTeams {
    const teamCheck = heroes.map((hero) => inTeamsCheck(hero));
    const distribution = {
        mh: 0,
        admech: 0,
        neuro: 0,
        custodes: 0,
    };

    teamCheck.forEach((check) => {
        if (check.inMulti) distribution.mh++;
        if (check.inMech) distribution.admech++;
        if (check.inNeuro) distribution.neuro++;
        if (check.inCustodes) distribution.custodes++;
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
    }

    return MetaTeams.OTHER;
}

export function getMetaTeams(heroes: string[]): MetaComps {
    const teamCheck = heroes.map((hero) => inTeamsCheck(hero));
    const distribution = {
        multihit: 0,
        admech: 0,
        neuro: 0,
        custodes: 0,
    };

    const retval: MetaComps = {
        multihit: false,
        admech: false,
        neuro: false,
        custodes: false,
    };

    teamCheck.forEach((check) => {
        if (check.inMulti) distribution.multihit++;
        if (check.inMech) distribution.admech++;
        if (check.inNeuro) distribution.neuro++;
        if (check.inCustodes) distribution.custodes++;
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

    return retval;
}
