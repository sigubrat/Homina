import { characters } from "./characters";

export const MINIMUM_SEASON_THRESHOLD = 70;
export const MAXIMUM_GUILD_MEMBERS = 30;
export const MAXIMUM_TOKENS_PER_SEASON = 29;
export const CURRENT_SEASON = 84;
export const META_TEAM_THRESHOLD = 5;

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
    [characters.Tigurius.id]: "<:tigerius:1420706517723910265>",
    [characters.Bellator.id]: "<:bellator:1420707580644294828>",
    [characters.Certus.id]: "<:certus:1420707452235546724>",
    [characters.Incisus.id]: "<:incisus:1420707279958970368>",
    [characters.Titus.id]: "<:titus:1420706587995144192>",
    [characters.Calgar.id]: "<:calgar:1420706942971809822>",

    // Sisters of Battle
    adeptRetributor: "<:vindicta:1420706507045077063>",
    adeptHospitaller: "<:isabella:1420707248795156500>",
    adeptCanoness: "<:roswitha:1420706739828949065>",
    adeptCelestine: "<:celestine:1420707484422639717>",
    adeptMorvenn: "<:morvenn:1420706836935479297>",

    // Necrons
    necroWarden: "<:makhotep:1420717281897611364>",
    necroDestroyer: "<:imospekh:1420717361324883988>",
    necroSpyder: "<:aleph:1420717562886361099>",
    necroPlasmancer: "<:thutmose:1420717069007327253>",
    necroOverlord: "<:anuphet:1420717546767781969>",

    // Death guard
    deathBlightlord: "<:maladus:1420700178528079953>",
    deathBlightbringer: "<:corrodius:1420700267346792518>",
    deathRotbone: "<:rotbone:1420700144222867487>",
    deathPutrifier: "<:pestillian:1420700131719778334>",
    deathTyphus: "<:typhon:1420700069358997646>",

    // Aeldari
    eldarRanger: "<:calandis:1420717493374292049>",
    eldarFarseer: "<:eldryon:1420717437522808872>",
    eldarAutarch: "<:aethana:1420717581106544641>",
    eldarMauganRa: "<:mauganra:1420717263753052160>",
    eldarJainZar: "<:jainzar:1420717321189851217>",

    // Orks
    orksBigMek: "<:gibbascrapz:1420717418912682035>",
    orksRuntherd: "<:snotflogga:1420717142294397018>",
    orksWarboss: "<:gulgortz:1420717515125821501>",
    orksKillaKan: "Snappawrecka",
    orksNob: "<:tanksmasha:1420717094160564224>",

    // Black Legion
    blackTerminator: "<:angrax:1420700348808695818>",
    blackHaarken: "<:haarken:1420700253073702932>",
    blackPossession: "<:archimatos:1420700324859215873>",
    blackObliterator: "<:volk:1420700055932764181>",
    blackAbaddon: "<:abaddon:1420699864651661353>",

    // Tyranids
    tyranTyrantGuard: "<:tyrantguard:1420717053832335391>",
    tyranNeurothrope: "<:neurothrope:1420717243968393308>",
    tyranWingedPrime: "<:wingedprime:1420717041265938523>",
    tyranDeathleaper: "<:deathleaper:1420717455726350379>",
    tyranParasite: "<:parasite:1420717230303346729>",

    // Astra Militarum
    astraYarrick: "<:yarrick:1420707399622328391>",
    astraPrimarisPsy: "<:sibyll:1420706704336748605>",
    astraBullgryn: "<:kut:1420707016078393354>",
    astraOrdnance: "<:thaddeus:1420706604361191445>",
    astraCreed: "<:creed:1420707509546782730>",

    // Blood angels
    bloodSanguinaryPriest: "<:nicodemus:1420706813153906688>",
    bloodMephiston: "<:mephiston:1420706874105270282>",
    bloodDante: "<:dante:1420707370085908542>",
    bloodIntercessor: "<:mataneo:1420706889351827496>",
    bloodDeathCompany: "<:lucien:1420706999615881266>",

    // Space wolves
    spaceHound: "<:tjark:1420706575106048050>",
    spaceBlackmane: "<:ragnar:1420706754152497244>",
    spaceWulfen: "<:ulf:1420706531862777866>",
    spaceStormcaller: "<:njal:1420706791729270845>",
    spaceRockfist: "<:arjac:1420707668603179078>",

    // Thousand sons
    thousTzaangor: "<:yazaghor:1420700003286122496>",
    thousAhriman: "<:ahriman:1420700380966293515>",
    thousInfernalMaster: "<:abraxas:1420700424041795704>",
    thousTerminator: "<:toth:1420700082814062694>",
    thousSorcerer: "<:thaumachus:1420700095053041756>",

    // Adeptus Mechanicus
    admecRuststalker: "<:rho:1420707351165538395>",
    admecManipulus: "<:actus:1420707727176634389>",
    admecMarshall: "<:tangida:1420706618026233878>",
    admecDominus: "<:vitruvius:1420706493774434406>",
    admecDestroyer: "<:sygex:1420706631187955752>",

    // World Eaters
    worldKharn: "<:kharn:1420700235801559100>",
    worldTerminator: "<:wrask:1420700016527413288>",
    worldJakhal: "<:macer:1420700192373604404>",
    worldEightbound: "<:azkor:1420700306211209279>",
    worldExecutions: "<:tarvakh:1420700106545434654>",

    // Black Templars
    templSwordBrother: "<:godswyl:1420706646858006579>",
    templHelbrecht: "<:helbrecht:1420707304537460797>",
    templAggressor: "<:burchard:1420707556871114776>",
    templAncient: "<:thoread:1420707688224133243>",
    templChampion: "<:jaeger:1420707533781340201>",

    // Dark Angels
    darkaAsmodai: "<:asmodai:1420707652618551316>",
    darkaCompanion: "<:forcas:1420707322065326090>",
    darkaTerminator: "<:baraqiel:1420707597018726441>",
    darkaAzrael: "<:azrael:1420707617449316393>",
    darkaHellblaster: "<:sarquael:1420706719050367056>",

    // Custodes
    custoVexilusPraetor: "<:aesoth:1420707709468016714>",
    custoAtlacoya: "<:atlacoya:1420707634545164419>",
    custoTrajann: "<:trajann:1420706545204727850>",
    custoBladeChampion: "<:kariyan:1420707205518463149>",
    custoAllarus: "Allarus",

    // Tau
    tauMarksman: "<:shosyl:1420717168013873222>",
    tauCrisis: "<:revas:1420717217330368586>",
    tauAunshi: "<:aunshi:1420717529659084892>",
    tauDarkstrider: "<:darkstrider:1420717470641029211>",
    tauShadowsun: "<:shadowsun:1420717182450536538>",

    // Genestealers
    genesMagus: "<:xybia:1420717029350178888>",
    genesBiophagus: "<:hollan:1420717383017959529>",
    genesPrimus: "<:isaak:1420717340902821971>",
    genesPatriarch: "<:patermine:1420717080608768040>",
    genesKelermorph: "<:judh:1420717302789312572>",

    // Machines of War
    astraOrdnanceBattery: "<:malleus:1420719891626856528>",
    blackForgefiend: "<:forgefiend:1420719929791086653>",
    ultraDreadnought: "<:galatian:1420719905430569000>",
    tyranBiovore: "<:biovore:1420719956550615101>",
    deathCrawler: "<:plagueburst:1420719879262175343>",
    adeptExorcist: "<:exorcist:1420719944030486628>",

    // Emperor's Children
    emperNoiseMarine: "<:shiron:1420700118327365715>",
    emperLucius: "<:lucius:1420700222241116201>",
};
