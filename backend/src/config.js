import "dotenv/config";

// eager = construit au démarrage  |  lazy = construit à la demande (1ère sélection)
export const LEAGUES = [

  // ── Top 5 championnats (eager) ─────────────────────────────────────────────
  { id:"fr",          apiId:61,  flag:"🇫🇷", country:"France",        name:"Ligue 1" },
  { id:"en",          apiId:39,  flag:"🏴",  country:"Angleterre",    name:"Premier League" },
  { id:"it",          apiId:135, flag:"🇮🇹", country:"Italie",        name:"Serie A" },
  { id:"de",          apiId:78,  flag:"🇩🇪", country:"Allemagne",     name:"Bundesliga" },
  { id:"es",          apiId:140, flag:"🇪🇸", country:"Espagne",       name:"La Liga" },
  { id:"pt",          apiId:94,  flag:"🇵🇹", country:"Portugal",      name:"Primeira Liga" },

  // ── Coupes européennes (eager) ─────────────────────────────────────────────
  { id:"ucl",         apiId:2,   flag:"🏆",  country:"Champions League",   name:"UEFA Champions League",   competitionOnly:true },
  { id:"uel",         apiId:3,   flag:"🟠",  country:"Europa League",      name:"UEFA Europa League",      competitionOnly:true },
  { id:"uecl",        apiId:848, flag:"🟢",  country:"Conf. League",       name:"UEFA Conference League",  competitionOnly:true },

  // ── Deuxièmes divisions (lazy) ─────────────────────────────────────────────
  { id:"en_ch",       apiId:40,  flag:"🏴",  country:"Angleterre",    name:"Championship",          lazy:true },
  { id:"fr_l2",       apiId:62,  flag:"🇫🇷", country:"France",        name:"Ligue 2",               lazy:true },
  { id:"de_b2",       apiId:79,  flag:"🇩🇪", country:"Allemagne",     name:"2. Bundesliga",         lazy:true },
  { id:"es_l2",       apiId:141, flag:"🇪🇸", country:"Espagne",       name:"La Liga 2",             lazy:true },
  { id:"it_sb",       apiId:136, flag:"🇮🇹", country:"Italie",        name:"Serie B",               lazy:true },
  { id:"pt_l2",       apiId:95,  flag:"🇵🇹", country:"Portugal",      name:"Liga Portugal 2",       lazy:true },

  // ── Coupes domestiques (lazy) ──────────────────────────────────────────────
  { id:"en_fac",      apiId:45,  flag:"🏴",  country:"Angleterre",    name:"FA Cup",                competitionOnly:true, lazy:true },
  { id:"en_lc",       apiId:48,  flag:"🏴",  country:"Angleterre",    name:"League Cup",            competitionOnly:true, lazy:true },
  { id:"fr_cup",      apiId:65,  flag:"🇫🇷", country:"France",        name:"Coupe de France",       competitionOnly:true, lazy:true },
  { id:"de_cup",      apiId:81,  flag:"🇩🇪", country:"Allemagne",     name:"DFB Pokal",             competitionOnly:true, lazy:true },
  { id:"es_cup",      apiId:143, flag:"🇪🇸", country:"Espagne",       name:"Copa del Rey",          competitionOnly:true, lazy:true },
  { id:"it_cup",      apiId:137, flag:"🇮🇹", country:"Italie",        name:"Coppa Italia",          competitionOnly:true, lazy:true },
  { id:"pt_cup",      apiId:96,  flag:"🇵🇹", country:"Portugal",      name:"Taça de Portugal",      competitionOnly:true, lazy:true },

  // ── Autres ligues européennes (lazy) ──────────────────────────────────────
  { id:"nl_ere",      apiId:88,  flag:"🇳🇱", country:"Pays-Bas",      name:"Eredivisie",            lazy:true },
  { id:"be_pro",      apiId:144, flag:"🇧🇪", country:"Belgique",      name:"Pro League",            lazy:true },
  { id:"tr_sup",      apiId:203, flag:"🇹🇷", country:"Turquie",       name:"Süper Lig",             lazy:true },
  { id:"sc_pre",      apiId:179, flag:"🏴",  country:"Écosse",        name:"Premiership",           lazy:true },
  { id:"gr_sl",       apiId:197, flag:"🇬🇷", country:"Grèce",         name:"Super League",          lazy:true },
  { id:"at_bun",      apiId:218, flag:"🇦🇹", country:"Autriche",      name:"Bundesliga",            lazy:true },
  { id:"ch_sl",       apiId:207, flag:"🇨🇭", country:"Suisse",        name:"Super League",          lazy:true },
  { id:"ru_rpl",      apiId:235, flag:"🇷🇺", country:"Russie",        name:"Premier League",        lazy:true },
  { id:"no_els",      apiId:103, flag:"🇳🇴", country:"Norvège",       name:"Eliteserien",           lazy:true },
  { id:"se_all",      apiId:113, flag:"🇸🇪", country:"Suède",         name:"Allsvenskan",           lazy:true },
  { id:"dk_sl",       apiId:120, flag:"🇩🇰", country:"Danemark",      name:"Superliga",             lazy:true },
  { id:"pl_ekst",     apiId:106, flag:"🇵🇱", country:"Pologne",       name:"Ekstraklasa",           lazy:true },
  { id:"cz_liga",     apiId:345, flag:"🇨🇿", country:"Tchéquie",      name:"Fortuna Liga",          lazy:true },
  { id:"hr_hnl",      apiId:210, flag:"🇭🇷", country:"Croatie",       name:"HNL",                   lazy:true },
  { id:"ro_l1",       apiId:283, flag:"🇷🇴", country:"Roumanie",      name:"Liga 1",                lazy:true },
  { id:"rs_sl",       apiId:286, flag:"🇷🇸", country:"Serbie",        name:"SuperLiga",             lazy:true },
  { id:"ua_pl",       apiId:333, flag:"🇺🇦", country:"Ukraine",       name:"Premier League",        lazy:true },
  { id:"il_pl",       apiId:169, flag:"🇮🇱", country:"Israël",        name:"Premier League",        lazy:true },

  // ── Amicaux clubs (lazy) ──────────────────────────────────────────────────
  { id:"clubfriendly",apiId:667, flag:"🤝",  country:"Amicaux clubs", name:"Club Friendly Games",   competitionOnly:true, lazy:true },

  // ── Équipes nationales — compétitions (lazy, saison figée) ────────────────
  { id:"wc",          apiId:1,   flag:"🌍",  country:"Coupe du Monde",name:"FIFA World Cup",        competitionOnly:true, lazy:true, season:2026 },
  { id:"euro",        apiId:4,   flag:"🇪🇺", country:"Euro",          name:"UEFA Euro",             competitionOnly:true, lazy:true, season:2024 },
  { id:"nl",          apiId:5,   flag:"🏅",  country:"Nations League",name:"UEFA Nations League",   competitionOnly:true, lazy:true, season:2024 },
  { id:"copa",        apiId:9,   flag:"🌎",  country:"Copa América",  name:"Copa América",          competitionOnly:true, lazy:true, season:2024 },
  { id:"afcon",       apiId:6,   flag:"🌍",  country:"CAN",           name:"Africa Cup of Nations", competitionOnly:true, lazy:true, season:2023 },
  { id:"afc",         apiId:7,   flag:"🌏",  country:"AFC",           name:"AFC Asian Cup",         competitionOnly:true, lazy:true, season:2023 },
  { id:"conca",       apiId:26,  flag:"🌎",  country:"CONCACAF",      name:"Gold Cup",              competitionOnly:true, lazy:true, season:2023 },
  { id:"cdc",         apiId:22,  flag:"🌎",  country:"Clubs du Monde",name:"Coupe du Monde Clubs",  competitionOnly:true, lazy:true, season:2025 },

  // ── Amicaux internationaux (lazy) ─────────────────────────────────────────
  { id:"intfriendly", apiId:10,  flag:"🌐",  country:"Amicaux pays",  name:"International Friendlies", competitionOnly:true, lazy:true },

  // ── Amériques (lazy) ──────────────────────────────────────────────────────
  { id:"mx_lig",      apiId:262, flag:"🇲🇽", country:"Mexique",       name:"Liga MX",               lazy:true },
  { id:"br_ser",      apiId:71,  flag:"🇧🇷", country:"Brésil",        name:"Série A",               lazy:true },
  { id:"ar_lig",      apiId:128, flag:"🇦🇷", country:"Argentine",     name:"Primera División",      lazy:true },
  { id:"us_mls",      apiId:253, flag:"🇺🇸", country:"USA",           name:"MLS",                   lazy:true },
  { id:"cl_pdv",      apiId:265, flag:"🇨🇱", country:"Chili",         name:"Primera División",      lazy:true },
  { id:"co_lbp",      apiId:239, flag:"🇨🇴", country:"Colombie",      name:"Liga BetPlay",          lazy:true },
  { id:"pe_l1",       apiId:281, flag:"🇵🇪", country:"Pérou",         name:"Liga 1",                lazy:true },
  { id:"uy_pd",       apiId:278, flag:"🇺🇾", country:"Uruguay",       name:"Primera División",      lazy:true },
  { id:"lib",         apiId:11,  flag:"🌎",  country:"CONMEBOL",      name:"Copa Libertadores",     competitionOnly:true, lazy:true },
  { id:"suda",        apiId:13,  flag:"🌎",  country:"CONMEBOL",      name:"Copa Sudamericana",     competitionOnly:true, lazy:true },

  // ── Asie & Océanie (lazy) ─────────────────────────────────────────────────
  { id:"jp_j1",       apiId:98,  flag:"🇯🇵", country:"Japon",         name:"J1 League",             lazy:true },
  { id:"cn_csl",      apiId:169, flag:"🇨🇳", country:"Chine",         name:"Chinese Super League",  lazy:true },
  { id:"kr_kl",       apiId:292, flag:"🇰🇷", country:"Corée du Sud",  name:"K League 1",            lazy:true },
  { id:"sa_pro",      apiId:307, flag:"🇸🇦", country:"Arabie Saoudite",name:"Pro League",           lazy:true },
  { id:"ae_al",       apiId:435, flag:"🇦🇪", country:"Émirats",       name:"Arabian Gulf League",   lazy:true },
  { id:"au_ale",      apiId:188, flag:"🇦🇺", country:"Australie",     name:"A-League",              lazy:true },
  { id:"in_isl",      apiId:323, flag:"🇮🇳", country:"Inde",          name:"Indian Super League",   lazy:true },

  // ── Afrique (lazy) ────────────────────────────────────────────────────────
  { id:"za_psl",      apiId:288, flag:"🇿🇦", country:"Afrique du Sud",name:"Premier Division",      lazy:true },
  { id:"eg_pl",       apiId:233, flag:"🇪🇬", country:"Égypte",        name:"Premier League",        lazy:true },
  { id:"ma_bdl",      apiId:200, flag:"🇲🇦", country:"Maroc",         name:"Botola Pro",            lazy:true },
  { id:"ng_npl",      apiId:263, flag:"🇳🇬", country:"Nigeria",       name:"Nigeria PL",            lazy:true },
  { id:"sn_l1",       apiId:274, flag:"🇸🇳", country:"Sénégal",       name:"Ligue 1",               lazy:true },
  { id:"cl_caf",      apiId:12,  flag:"🌍",  country:"Afrique",       name:"CAF Champions League",  competitionOnly:true, lazy:true },
];

// ID → objet ligue
export const LEAGUE_MAP = Object.fromEntries(LEAGUES.map(l => [l.id, l]));

export function currentSeason(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return m >= 6 ? y : y - 1;
}

export function allowedSeasons(date = new Date()) {
  const n = currentSeason(date);
  return [n, n - 1];
}

const H = 60 * 60 * 1000;
export const TTL = {
  nextFixture:  6  * H,
  teamFixtures: 12 * H,
  topScorers:   12 * H,
  headToHead:   24 * H,
  teamStats:    12 * H,
  payload:      6  * H,
};

export const API = {
  key:        (process.env.API_FOOTBALL_KEY  || "").trim(),
  host:       (process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io").trim(),
  dailyLimit: Number(process.env.DAILY_REQUEST_LIMIT || 700),
};

export const PORT          = Number(process.env.PORT || 3001);
export const SITE_PASSWORD = (process.env.SITE_PASSWORD || "edgestat").trim();

// ── Tournois tennis (IDs API-Tennis, saison = année du tournoi) ───────────
export const TENNIS_TOURNAMENTS = [
  { id: "4463", name: "Australian Open", surface: "hard",  flag: "🇦🇺", season: 2024 },
  { id: "4484", name: "Roland Garros",   surface: "clay",  flag: "🇫🇷", season: 2024 },
  { id: "4485", name: "Wimbledon",       surface: "grass", flag: "🏴",  season: 2024 },
  { id: "4486", name: "US Open",         surface: "hard",  flag: "🇺🇸", season: 2024 },
  { id: "4480", name: "ATP Tour",        surface: "hard",  flag: "🎾",  season: 2024 },
];
