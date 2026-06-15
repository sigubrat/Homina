import { calculateCurrentSeason } from "../utils/timeUtils";
import { characters } from "./charactersConfig";
import { MachinesOfWar } from "./mowConfig";

export const MINIMUM_SEASON_THRESHOLD = 70;
export const MAXIMUM_GUILD_MEMBERS = 30;
export const MAXIMUM_TOKENS_PER_SEASON = 28;
export const getCurrentSeason = () => calculateCurrentSeason(new Date());
export const META_TEAM_THRESHOLD = 5;
export const MAX_TOKENS_PER_SEASON = 28;

export const STANDARD_FOOTER_TEXT = "Referral code: HUG-44-CAN";

// Season 85 starts on October 8, 2025, at 10:00 AM UTC
export const SEASON_85_SEASON_START = new Date(2025, 9, 8, 10, 0, 0);

/**
 * Notable in-game events that materially affected guild raid performance.
 * Used to annotate seasonal trend charts so players can see when changes
 * occurred. Add new entries here as the game evolves.
 */
export const GAME_EVENTS: { season: number; label: string }[] = [
    { season: 82, label: "Mythic 1 introduced" },
    { season: 97, label: "Mythic 2 introduced" },
];

export const BOSS_EMOJIS: Record<string, string> = {
    Szarekh: "<:Szarekh:1385343132950069278>",
    TyrantLeviathan: "<:TyrantLeviathan:1385342042170851334>",
    TyrantGorgon: "<:TyrantGorgon:1385340907351441619>",
    TyrantKronos: "<:TyrantKronos:1385341128626409522>",
    Ghazghkull: "<:Ghazghkull:1385340195494170664>",
    Avatar: "<:Avatar:1385338950834716802>",
    Magnus: "<:Magnus:1385342412217520379>",
    Mortarion: "<:Mortarion:1385342557969453197>",
    Belisarius: "<:Cawl:1385339595578806312>",
    RogalDornTank: "<:RogalDornTank:1385342727037784174>",
    Screamer: "<:ScreamerKiller:1385342920302788608>",
    Riptide: "<:Riptide:1410163322531217419>",
};
export const UnitIdEmojiMapping: Record<string, string> = {
    // Ultramarines
    [characters.Tigurius.id]: "<:tigurius:1420706517723910265>",
    [characters.Bellator.id]: "<:bellator:1420707580644294828>",
    [characters.Certus.id]: "<:certus:1420707452235546724>",
    [characters.Incisus.id]: "<:incisus:1420707279958970368>",
    [characters.Titus.id]: "<:titus:1420706587995144192>",
    [characters.Calgar.id]: "<:calgar:1420706942971809822>",

    // Sisters of Battle
    [characters.Vindicta.id]: "<:vindicta:1420706507045077063>",
    [characters.Isabella.id]: "<:isabella:1420707248795156500>",
    [characters.Roswitha.id]: "<:roswitha:1420706739828949065>",
    [characters.Celestine.id]: "<:celestine:1420707484422639717>",
    [characters.MorvennVahl.id]: "<:morvenn:1420706836935479297>",

    // Necrons
    [characters.Makhotep.id]: "<:makhotep:1420717281897611364>",
    [characters.Imospekh.id]: "<:imospekh:1420717361324883988>",
    [characters.AlephNull.id]: "<:aleph:1420717562886361099>",
    [characters.Thutmose.id]: "<:thutmose:1420717069007327253>",
    [characters.Anuphet.id]: "<:anuphet:1420717546767781969>",

    // Death guard
    [characters.Maladus.id]: "<:maladus:1420700178528079953>",
    [characters.Corrodius.id]: "<:corrodius:1420700267346792518>",
    [characters.Rotbone.id]: "<:rotbone:1420700144222867487>",
    [characters.Pestillian.id]: "<:pestillian:1420700131719778334>",
    [characters.Typhus.id]: "<:typhus:1420700069358997646>",

    // Aeldari
    [characters.Calandis.id]: "<:calandis:1420717493374292049>",
    [characters.Eldryon.id]: "<:eldryon:1420717437522808872>",
    [characters.Aethana.id]: "<:aethana:1420717581106544641>",
    [characters.MauganRa.id]: "<:mauganra:1420717263753052160>",
    [characters.JainZar.id]: "<:jainzar:1420717321189851217>",

    // Orks
    [characters.Gibbascrapz.id]: "<:gibbascrapz:1420717418912682035>",
    [characters.Snotflogga.id]: "<:snotflogga:1420717142294397018>",
    [characters.Gulgortz.id]: "<:gulgortz:1420717515125821501>",
    [characters.Snappawrecka.id]: "<:snappawrecka:1423621196255072286>",
    [characters.Tanksmasha.id]: "<:tanksmasha:1420717094160564224>",

    // Black Legion
    [characters.Angrax.id]: "<:angrax:1420700348808695818>",
    [characters.Haarken.id]: "<:haarken:1420700253073702932>",
    [characters.Archimatos.id]: "<:archimatos:1420700324859215873>",
    [characters.Volk.id]: "<:volk:1420700055932764181>",
    [characters.Abaddon.id]: "<:abaddon:1420699864651661353>",

    // Tyranids
    [characters.TyrantGuard.id]: "<:tyrantguard:1420717053832335391>",
    [characters.Neurothrope.id]: "<:neurothrope:1420717243968393308>",
    [characters.WingedPrime.id]: "<:wingedprime:1420717041265938523>",
    [characters.Deathleaper.id]: "<:deathleaper:1420717455726350379>",
    [characters.Parasite.id]: "<:parasite:1420717230303346729>",

    // Astra Militarum
    [characters.Yarrick.id]: "<:yarrick:1420707399622328391>",
    [characters.Sibyll.id]: "<:sibyll:1420706704336748605>",
    [characters.Kut.id]: "<:kut:1420707016078393354>",
    [characters.Thaddeus.id]: "<:thaddeus:1420706604361191445>",
    [characters.Creed.id]: "<:creed:1420707509546782730>",
    [characters.Dreir.id]: "<:dreir:1420706704336748605>",

    // Blood angels
    [characters.Nicodemus.id]: "<:nicodemus:1420706813153906688>",
    [characters.Mephiston.id]: "<:mephiston:1420706874105270282>",
    [characters.Dante.id]: "<:dante:1420707370085908542>",
    [characters.Mataneo.id]: "<:mataneo:1420706889351827496>",
    [characters.Lucien.id]: "<:lucien:1420706999615881266>",

    // Space wolves
    [characters.Tjark.id]: "<:tjark:1420706575106048050>",
    [characters.Ragnar.id]: "<:ragnar:1420706754152497244>",
    [characters.Ulf.id]: "<:ulf:1420706531862777866>",
    [characters.Njal.id]: "<:njal:1420706791729270845>",
    [characters.Arjac.id]: "<:arjac:1420707668603179078>",

    // Thousand sons
    [characters.Yazaghor.id]: "<:yazaghor:1420700003286122496>",
    [characters.Ahriman.id]: "<:ahriman:1420700380966293515>",
    [characters.Abraxas.id]: "<:abraxas:1420700424041795704>",
    [characters.Toth.id]: "<:toth:1420700082814062694>",
    [characters.Thaumachus.id]: "<:thaumachus:1420700095053041756>",

    // Adeptus Mechanicus
    [characters.ExitorRho.id]: "<:rho:1420707351165538395>",
    [characters.Actus.id]: "<:actus:1420707727176634389>",
    [characters.TanGida.id]: "<:tangida:1420706618026233878>",
    [characters.Vitruvius.id]: "<:vitruvius:1420706493774434406>",
    [characters.SyGex.id]: "<:sygex:1420706631187955752>",

    // World Eaters
    [characters.Kharn.id]: "<:kharn:1420700235801559100>",
    [characters.Wrask.id]: "<:wrask:1420700016527413288>",
    [characters.Macer.id]: "<:macer:1420700192373604404>",
    [characters.Azkor.id]: "<:azkor:1420700306211209279>",
    [characters.Tarvakh.id]: "<:tarvakh:1420700106545434654>",

    // Black Templars
    [characters.Godswyl.id]: "<:godswyl:1420706646858006579>",
    [characters.Helbrecht.id]: "<:helbrecht:1420707304537460797>",
    [characters.Burchard.id]: "<:burchard:1420707556871114776>",
    [characters.Thoread.id]: "<:thoread:1420707688224133243>",
    [characters.Jaeger.id]: "<:jaeger:1420707533781340201>",

    // Dark Angels
    [characters.Asmodai.id]: "<:asmodai:1420707652618551316>",
    [characters.Forcas.id]: "<:forcas:1420707322065326090>",
    [characters.Baraqiel.id]: "<:baraqiel:1420707597018726441>",
    [characters.Azrael.id]: "<:azrael:1420707617449316393>",
    [characters.Sarquael.id]: "<:sarquael:1420706719050367056>",

    // Custodes
    [characters.Aesoth.id]: "<:aesoth:1420707709468016714>",
    [characters.Atlacoya.id]: "<:atlacoya:1420707634545164419>",
    [characters.Trajann.id]: "<:trajann:1420706545204727850>",
    [characters.Kariyan.id]: "<:kariyan:1420707205518463149>",
    [characters.Tyrith.id]: "<:tyrith:1459088469585297429>",

    // Tau
    [characters.Shosyl.id]: "<:shosyl:1420717168013873222>",
    [characters.Revas.id]: "<:revas:1420717217330368586>",
    [characters.AunShi.id]: "<:aunshi:1420717529659084892>",
    [characters.Darkstrider.id]: "<:darkstrider:1420717470641029211>",
    [characters.Shadowsun.id]: "<:shadowsun:1420717182450536538>",
    [characters.Farsight.id]: "<:farsight:1459088136645771375>",

    // Genestealers
    [characters.Xybia.id]: "<:xybia:1420717029350178888>",
    [characters.Hollan.id]: "<:hollan:1420717383017959529>",
    [characters.Isaak.id]: "<:isaak:1420717340902821971>",
    [characters.Patermine.id]: "<:patermine:1420717080608768040>",
    [characters.Judh.id]: "<:judh:1420717302789312572>",

    // Emperor's Children
    [characters.Shiron.id]: "<:shiron:1420700118327365715>",
    [characters.Lucius.id]: "<:lucius:1420700222241116201>",
    [characters.Adamatar.id]: "<:adamatar:1423622264498290869>",
    [characters.Hascule.id]: "<:hascule:1459086771160748165>",
    [characters.Laviscus.id]: "<:laviscus:1459087285860438163>",

    // Machines of War
    [MachinesOfWar.Malleus.id]: "<:malleus:1420719891626856528>",
    [MachinesOfWar.ForgeFiend.id]: "<:forgefiend:1420719929791086653>",
    [MachinesOfWar.Galatian.id]: "<:galatian:1420719905430569000>",
    [MachinesOfWar.Biovore.id]: "<:biovore:1420719956550615101>",
    [MachinesOfWar.Plagueburst.id]: "<:plagueburst:1420719879262175343>",
    [MachinesOfWar.Exorcist.id]: "<:exorcist:1420719944030486628>",
    [MachinesOfWar.Rukkatrukk.id]: "<:rukkatrukk:1420719867375648839>",
    [MachinesOfWar.Tsonji.id]: "<:tsonji:1459087982299451445>",
    [MachinesOfWar.Zkar.id]: "<:zkar:1459087797708132413>",

    // NPCs
    [characters.Hapthatra.id]: "<:hapthatra:1508899689154482287>",
    [characters.Mesophet.id]: "<:mesophet:1508900611138256969>",
};

export const miscEmojis = {
    bomb: "<:bomb:1509192928877219840>",
    raidToken: "<:raid:1509193658056966346>",
};

export const bombDamageByGuildLevel: Record<
    number,
    { min: number; max: number }
> = {
    1: { min: 80, max: 100 },
    2: { min: 90, max: 120 },
    3: { min: 100, max: 140 },
    4: { min: 120, max: 160 },
    5: { min: 140, max: 180 },
    6: { min: 160, max: 210 },
    7: { min: 180, max: 240 },
    8: { min: 210, max: 280 },
    9: { min: 240, max: 320 },
    10: { min: 280, max: 370 },
    11: { min: 320, max: 430 },
    12: { min: 370, max: 490 },
    13: { min: 430, max: 560 },
    14: { min: 490, max: 640 },
    15: { min: 560, max: 740 },
    16: { min: 640, max: 850 },
    17: { min: 740, max: 980 },
    18: { min: 850, max: 1130 },
    19: { min: 980, max: 1300 },
    20: { min: 1130, max: 1500 },
    21: { min: 1300, max: 1730 },
    22: { min: 1500, max: 1990 },
    23: { min: 1730, max: 2290 },
    24: { min: 1990, max: 2630 },
    25: { min: 2290, max: 3020 },
    26: { min: 2630, max: 3470 },
    27: { min: 3020, max: 3990 },
    28: { min: 3470, max: 4590 },
    29: { min: 3990, max: 5280 },
    30: { min: 4590, max: 6070 },
    31: { min: 5050, max: 6680 },
    32: { min: 5560, max: 7350 },
    33: { min: 6120, max: 8090 },
    34: { min: 6730, max: 6900 },
    35: { min: 7400, max: 9790 },
    36: { min: 8140, max: 10770 },
    37: { min: 8950, max: 11850 },
    38: { min: 9850, max: 13040 },
    39: { min: 10840, max: 14340 },
    40: { min: 11924, max: 15774 },
    41: { min: 12510, max: 16540 },
    42: { min: 13110, max: 17330 },
    43: { min: 13720, max: 18140 },
    44: { min: 14340, max: 18960 },
    45: { min: 14980, max: 19800 },
    46: { min: 15630, max: 20660 },
    47: { min: 16300, max: 21540 },
    48: { min: 16980, max: 22440 },
    49: { min: 17670, max: 23360 },
    50: { min: 18380, max: 24290 },
    51: { min: 19100, max: 25240 },
    52: { min: 19830, max: 26210 },
    53: { min: 20580, max: 27200 },
    54: { min: 21340, max: 28210 },
    55: { min: 22120, max: 29240 },
    56: { min: 22910, max: 30280 },
    57: { min: 23710, max: 31340 },
    58: { min: 24530, max: 32420 },
    59: { min: 25360, max: 33520 },
    60: { min: 26210, max: 34640 },
};
