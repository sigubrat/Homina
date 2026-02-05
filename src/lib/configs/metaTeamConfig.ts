import { characters } from "./charactersConfig";

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
    characters.Vitruvius.id,
    characters.Laviscus.id,
    characters.Aesoth.id,
];

export const battlesuitTeam = [
    characters.Farsight.id,
    characters.Actus.id,
    characters.Darkstrider.id,
    characters.Revas.id,
    characters.Eldryon.id,
    characters.Adamatar.id,
    characters.Calgar.id,
];

export const lynchpinHeroes: Record<string, string[]> = {
    Multihit: [characters.Ragnar.id],
    Admech: [
        characters.ExitorRho.id,
        characters.Actus.id,
        characters.TanGida.id,
    ],
    Battlesuit: [
        characters.Farsight.id,
        characters.Actus.id,
        characters.Revas.id,
    ],
    Neuro: [characters.Neurothrope.id],
    Custodes: [characters.Trajann.id, characters.Kariyan.id],
};
