import { characters } from "@/lib/configs/charactersConfig";
import {
    inTeamsCheck,
    hasLynchpinHeroes,
    getMetaTeam,
    getMetaTeams,
} from "@/lib/utils/metaTeamUtils";
import { MetaTeams } from "@/models/enums/MetaTeams";
import { describe, expect, test } from "bun:test";

describe("metaTeamUtils - Algebra", () => {
    test("inTeamsCheck - Should return a correct check", () => {
        const heroes = [
            characters.Bellator.id,
            characters.Gulgortz.id,
            characters.Eldryon.id,
            characters.Kariyan.id,
            characters.Farsight.id,
        ];

        const result = {
            multi: 0,
            mech: 0,
            neuro: 0,
            custodes: 0,
            battlesuit: 0,
        };
        heroes.forEach((hero) => {
            const res = inTeamsCheck(hero);
            result.multi += res.inMulti ? 1 : 0;
            result.mech += res.inMech ? 1 : 0;
            result.neuro += res.inNeuro ? 1 : 0;
            result.custodes += res.inCustodes ? 1 : 0;
            result.battlesuit += res.inBattlesuit ? 1 : 0;
        });
        expect(result).toEqual({
            multi: 3,
            mech: 1,
            neuro: 1,
            custodes: 1,
            battlesuit: 2,
        });
    });

    test("hasLynchpinHero - Should provide true/false if lynchpins in team or not ", () => {
        const teams: string[][] = [
            [
                characters.Bellator.id,
                characters.Gulgortz.id,
                characters.Eldryon.id,
            ],
            [
                characters.Snotflogga.id,
                characters.Aethana.id,
                characters.Bellator.id,
            ],
            [
                characters.Ragnar.id,
                characters.Snotflogga.id,
                characters.Eldryon.id,
            ],
            [
                characters.Neurothrope.id,
                characters.Snotflogga.id,
                characters.Aethana.id,
            ],
            [
                characters.ExitorRho.id,
                characters.TanGida.id,
                characters.Actus.id,
            ],
            [
                characters.TyrantGuard.id,
                characters.Snotflogga.id,
                characters.Aethana.id,
            ],
            [
                characters.Kariyan.id,
                characters.Trajann.id,
                characters.Dante.id,
                characters.Kharn.id,
            ],
            [
                characters.Farsight.id,
                characters.Actus.id,
                characters.Darkstrider.id,
                characters.Revas.id,
                characters.Eldryon.id,
            ],
        ];

        const neuroTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.NEURO)),
            0
        );

        const multiTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.MULTIHIT)),
            0
        );

        const mechTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.ADMECH)),
            0
        );

        const custodesTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.CUSTODES)),
            0
        );

        const battlesuitTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.BATTLESUIT)),
            0
        );

        expect(neuroTeam).toBe(1);
        expect(multiTeam).toBe(1);
        expect(mechTeam).toBe(1);
        expect(custodesTeam).toBe(1);
        expect(battlesuitTeam).toBe(1);
    });

    test("getMetaTeam - Should return the correct meta team", () => {
        const multihitTeam = [
            characters.Bellator.id,
            characters.Gulgortz.id,
            characters.Eldryon.id,
            characters.Helbrecht.id,
            characters.Ragnar.id,
        ];
        const metaTeam = getMetaTeam(multihitTeam);
        expect(metaTeam).toEqual(MetaTeams.MULTIHIT);

        const admechTeam = [
            "necroSpyder",
            characters.ExitorRho.id,
            "tauCrisis",
            "admecMarshall",
            "admecDominus",
            "admecManipulus",
        ];

        expect(getMetaTeam(admechTeam)).toEqual(MetaTeams.ADMECH);
        const neuroTeam = [
            characters.Eldryon.id,
            characters.Neurothrope.id,
            "genesMagus",
            "adeptCanoness",
            "bloodMephiston",
        ];
        expect(getMetaTeam(neuroTeam)).toEqual(MetaTeams.NEURO);

        const custodesTeam = [
            characters.Trajann.id,
            characters.Kariyan.id,
            characters.Ragnar.id,
            characters.Kharn.id,
            characters.Dante.id,
        ];
        expect(getMetaTeam(custodesTeam)).toEqual(MetaTeams.CUSTODES);

        const battlesuitTeam = [
            characters.Farsight.id,
            characters.Actus.id,
            characters.Darkstrider.id,
            characters.Revas.id,
            characters.Eldryon.id,
        ];
        expect(getMetaTeam(battlesuitTeam)).toEqual(MetaTeams.BATTLESUIT);
    });

    test("getMetaTeam - Should return OTHER for teams not matching any meta", () => {
        const otherTeam = [
            "thousAhriman",
            "tauCrisis",
            characters.Eldryon.id,
            characters.ExitorRho.id,
            characters.Ragnar.id,
            "thousInfernalMaster",
        ];
        expect(getMetaTeam(otherTeam)).toEqual(MetaTeams.OTHER);
    });

    test("getMetaTeam - Should return Battlesuit for battlesuit meta team", () => {
        const battlesuitTeam = [
            characters.Farsight.id,
            characters.Actus.id,
            characters.Darkstrider.id,
            characters.Revas.id,
            characters.Eldryon.id,
        ];
        expect(getMetaTeam(battlesuitTeam)).toEqual(MetaTeams.BATTLESUIT);
    });

    test("getMetaTeams - Should return correct meta teams present in hero list", () => {
        const admechTeam = [
            characters.ExitorRho.id,
            characters.Gulgortz.id,
            characters.Actus.id,
            characters.TanGida.id,
            characters.Shosyl.id,
        ];

        const custodesTeam = [
            characters.Trajann.id,
            characters.Kariyan.id,
            characters.Ragnar.id,
            characters.Kharn.id,
            characters.Dante.id,
        ];

        const multihitTeam = [
            characters.Bellator.id,
            characters.Asmodai.id,
            characters.Eldryon.id,
            characters.Helbrecht.id,
            characters.Ragnar.id,
        ];

        const battleSuitTeam = [
            characters.Farsight.id,
            characters.Actus.id,
            characters.Darkstrider.id,
            characters.Revas.id,
            characters.Eldryon.id,
        ];

        const nonsenseTeam = [
            characters.Ahriman.id,
            characters.Tjark.id,
            characters.Gulgortz.id,
            characters.Kariyan.id,
            characters.TanGida.id,
        ];

        expect(getMetaTeams(admechTeam)).toEqual({
            multihit: false,
            admech: true,
            neuro: false,
            custodes: false,
            battlesuit: false,
        });

        expect(getMetaTeams(custodesTeam)).toEqual({
            multihit: false,
            admech: false,
            neuro: false,
            custodes: true,
            battlesuit: false,
        });

        expect(getMetaTeams(multihitTeam)).toEqual({
            multihit: true,
            admech: false,
            neuro: false,
            custodes: false,
            battlesuit: false,
        });

        expect(getMetaTeams(battleSuitTeam)).toEqual({
            multihit: false,
            admech: false,
            neuro: false,
            custodes: false,
            battlesuit: true,
        });

        expect(getMetaTeams(nonsenseTeam)).toEqual({
            multihit: false,
            admech: false,
            neuro: false,
            custodes: false,
            battlesuit: false,
        });
    });
});
