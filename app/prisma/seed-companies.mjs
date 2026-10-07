// Seed des sociétés industrielles belges + leurs sites.
// Idempotent via upsert sur vatNumber (quand présent) ou name (fallback).
// À lancer depuis le container app : node prisma/seed-companies.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DATA = [
  {
    "name": "Spa Monopole SA",
    "vatNumber": "BE0420834005",
    "nomFourni": "Spa Monopole",
    "sites": [
      {
        "name": "Spa",
        "siteType": "Usine / siège",
        "street": "Rue Auguste Laporte 34",
        "postalCode": "4900",
        "city": "Spa",
        "country": "Belgique",
        "phone": "+32 87 79 41 11",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.spadel.com/fr/contact",
        "notes": "Source juridique: https://www.pappers.be/fr/company/spa-monopole-compagnie-fermiere-de-spa-0420.834.005",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "NLMK La Louvière SA",
    "vatNumber": "BE0417374172",
    "nomFourni": "NLMK La Louvière",
    "sites": [
      {
        "name": "La Louvière",
        "siteType": "Usine / siège",
        "street": "Rue des Rivaux 2",
        "postalCode": "7100",
        "city": "La Louvière",
        "country": "Belgique",
        "phone": "+32 64 27 27 11",
        "email": "strip@eu.nlmk.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://eu.nlmk.com/fr/contacts/?from=dk",
        "notes": "Source juridique: https://www.pappers.be/fr/company/nlmk-la-louviere-0417374172",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Nexans Benelux SA",
    "vatNumber": "BE0401782512",
    "nomFourni": "Nexans",
    "sites": [
      {
        "name": "Charleroi",
        "siteType": "Usine / siège",
        "street": "Rue Vital Françoisse 218",
        "postalCode": "6001",
        "city": "Marcinelle (Charleroi)",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://ecosystem.rewan.be/annuaire/nexans-belgium/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/nexans-benelux-0401.782.512 · Téléphones divergents selon les annuaires ; standard non retenu.",
        "isPrimary": true
      },
      {
        "name": "Hal / Buizingen",
        "siteType": "Usine",
        "street": "Alsembergsesteenweg 2 b1",
        "postalCode": "1501",
        "city": "Buizingen (Hal)",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "À confirmer",
        "sourceUrl": "https://www.nexans.be/fr/company/Nexans-in-Belgium.html",
        "notes": "Source juridique: https://www.pappers.be/fr/company/nexans-benelux-0401.782.512 · Adresse issue de documentation officielle ancienne ; à reconfirmer.",
        "isPrimary": false
      }
    ]
  },
  {
    "name": "Vandemoortele NV",
    "vatNumber": "BE0429977343",
    "nomFourni": "Vandemoortele",
    "sites": [
      {
        "name": "Gand",
        "siteType": "Siège",
        "street": "Ottergemsesteenweg-Zuid 816",
        "postalCode": "9000",
        "city": "Gent",
        "country": "Belgique",
        "phone": "+32 9 240 18 00",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.vandemoortele.com/fr-fr/informations-legales",
        "notes": "Source juridique: https://www.pappers.be/fr/company/vandemoortele-0429977343 · Contact de l'entité NV ; Europe NV a un autre numéro BCE.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Flaurea Chemicals SA",
    "vatNumber": "BE0536756626",
    "nomFourni": "Flaurea Chemicals",
    "sites": [
      {
        "name": "Ath",
        "siteType": "Usine / siège",
        "street": "Quai des Usines 12",
        "postalCode": "7800",
        "city": "Ath",
        "country": "Belgique",
        "phone": "+32 68 28 19 12",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.flaureachemicals.com/",
        "notes": "Source juridique: https://www.companyweb.be/fr/0536756626/flaurea-chemicals",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Solarec SA",
    "vatNumber": "BE0442442140",
    "nomFourni": "Solarec",
    "sites": [
      {
        "name": "Recogne",
        "siteType": "Production",
        "street": "Rue de Saint-Hubert 75",
        "postalCode": "6800",
        "city": "Libramont-Chevigny",
        "country": "Belgique",
        "phone": "+32 61 22 98 11",
        "email": "info@solarec.be",
        "establishmentUnit": null,
        "verificationStatus": "À confirmer",
        "sourceUrl": "https://solarec.be/contact/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/solarec-0442442140 · Le site officiel indique siège Recogne ; source juridique indique Baudour. Adresse siège à arbitrer.",
        "isPrimary": true
      },
      {
        "name": "Baudour",
        "siteType": "Production",
        "street": "Rue des Azalées 3B",
        "postalCode": "7331",
        "city": "Baudour (Saint-Ghislain)",
        "country": "Belgique",
        "phone": "+32 61 24 13 35",
        "email": "info@solarec.be",
        "establishmentUnit": null,
        "verificationStatus": "À confirmer",
        "sourceUrl": "https://solarec.be/contact/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/solarec-0442442140 · Contradiction entre siège publié sur site officiel et adresse juridique.",
        "isPrimary": false
      }
    ]
  },
  {
    "name": "Vibrantz Minerals SRL",
    "vatNumber": "BE0403045985",
    "nomFourni": "Vibrantz",
    "sites": [
      {
        "name": "Villerot",
        "siteType": "Usine",
        "street": "Rue du Bois s/n",
        "postalCode": "7334",
        "city": "Villerot (Saint-Ghislain)",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://vibrantz.com/our-company/global-locations/",
        "notes": "Source juridique: https://www.companyweb.be/fr/0403045985/vibrantz-minerals · Téléphone général non confirmé.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Vibrantz Performance Pigments Belgium SA",
    "vatNumber": "BE0405467720",
    "nomFourni": "Vibrantz",
    "sites": [
      {
        "name": "Menen",
        "siteType": "Usine",
        "street": "Kortrijkstraat 153",
        "postalCode": "8930",
        "city": "Menen",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://vibrantz.com/our-company/global-locations/",
        "notes": "Source juridique: https://www.companyweb.be/fr/0405467720/vibrantz-performance-pigments-belgium · Téléphone général non confirmé.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Manufacture Belge de Chocolats",
    "vatNumber": "BE0722764519",
    "nomFourni": "MBC",
    "sites": [
      {
        "name": "Koekelberg",
        "siteType": "Usine",
        "street": "Rue Gemba 5",
        "postalCode": "1081",
        "city": "Koekelberg (Bruxelles)",
        "country": "Belgique",
        "phone": "+32 2 422 17 11",
        "email": "info@mbcchocolates.be",
        "establishmentUnit": null,
        "verificationStatus": "À confirmer",
        "sourceUrl": "https://www.mbcchocolates.be/en/privacy-policy",
        "notes": "Interprétation probable de MBC ; acronyme à confirmer par l'utilisateur.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Lotus Bakeries NV",
    "vatNumber": "BE0401030860",
    "nomFourni": "Lotus",
    "sites": [
      {
        "name": "Lembeke",
        "siteType": "Siège",
        "street": "Gentstraat 1",
        "postalCode": "9971",
        "city": "Lembeke (Kaprijke)",
        "country": "Belgique",
        "phone": "+32 9 376 26 00",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.lotusbakeries.com/nl/node/5",
        "notes": "Source juridique: https://www.companyweb.be/fr/0401030860/lotus-bakeries · Siège du groupe ; Lotus Bakeries België est une entité distincte.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Lotus Bakeries België NV",
    "vatNumber": "BE0421694038",
    "nomFourni": "Lotus",
    "sites": [
      {
        "name": "Lembeke",
        "siteType": "Contact Belgique",
        "street": "Gentstraat 52",
        "postalCode": "9971",
        "city": "Lembeke (Kaprijke)",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.lotusbakeries.be/nl/contact",
        "notes": "Source juridique: https://www.pappers.be/fr/company/lotus-bakeries-belgie-0421694038 · Standard propre à l'entité non confirmé.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Fuchs Lubricants Benelux NV/SA",
    "vatNumber": "BE0421493902",
    "nomFourni": "Fuchs",
    "sites": [
      {
        "name": "Huizingen",
        "siteType": "Siège / contact",
        "street": "Heideveld 54",
        "postalCode": "1654",
        "city": "Huizingen (Beersel)",
        "country": "Belgique",
        "phone": "+32 2 363 19 27",
        "email": "info-fbnl@fuchs.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.fuchs.com/be/fr/entreprise/a-propos-de-fuchs/contact/",
        "notes": "Source juridique: https://www.companyweb.be/fr/0421493902/fuchs-lubricants-benelux-n-v-s-a-",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Isomatex SA",
    "vatNumber": "BE0429395145",
    "nomFourni": "Isomatex",
    "sites": [
      {
        "name": "Les Isnes",
        "siteType": "Usine / siège",
        "street": "Rue Camille Hubert 29",
        "postalCode": "5032",
        "city": "Les Isnes (Gembloux)",
        "country": "Belgique",
        "phone": "+32 81 72 86 86",
        "email": "info@isomatex.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.isomatex.com/contact/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/isomatex-0429395145",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Minakem High Potent SA",
    "vatNumber": "BE0630942834",
    "nomFourni": "Minakem",
    "sites": [
      {
        "name": "Mont-Saint-Guibert",
        "siteType": "Usine / siège",
        "street": "Rue Fonds Jean Pâques 8",
        "postalCode": "1435",
        "city": "Mont-Saint-Guibert",
        "country": "Belgique",
        "phone": "+32 10 23 81 80",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://minakem.com/fr/nous-contacter/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/minakem-high-potent-0630942834",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "BI Belgium (ENG) SRL",
    "vatNumber": "BE0825917386",
    "nomFourni": "Biscuit International",
    "sites": [
      {
        "name": "Enghien",
        "siteType": "Usine",
        "street": "Avenue du Commerce 27",
        "postalCode": "7850",
        "city": "Enghien",
        "country": "Belgique",
        "phone": null,
        "email": "info_BE@biscuitinternational.com",
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.biscuitinternational.com/company/international-market/belgium/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/biscuit-international-belgium-eng-0825917386 · Le téléphone publié pour le contact Benelux est néerlandais, pas un standard belge.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "BI Belgium (GHI) SRL",
    "vatNumber": "BE0435235238",
    "nomFourni": "Biscuit International",
    "sites": [
      {
        "name": "Ghislenghien",
        "siteType": "Usine",
        "street": "Rue des Journaliers 6 boîte B",
        "postalCode": "7822",
        "city": "Ghislenghien (Ath)",
        "country": "Belgique",
        "phone": null,
        "email": "info_BE@biscuitinternational.com",
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://trendstop.levif.be/fr/detail/435235238/biscuit-international-belgium-ghi.aspx",
        "notes": "Source juridique: https://www.pappers.be/fr/company/biscuit-international-belgium-ghi-0435235238 · Standard propre au site non confirmé.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Hydria",
    "vatNumber": "BE0884649502",
    "nomFourni": "SBGE",
    "sites": [
      {
        "name": "Bruxelles",
        "siteType": "Siège",
        "street": "Boulevard de l'Impératrice 17",
        "postalCode": "1000",
        "city": "Bruxelles",
        "country": "Belgique",
        "phone": "+32 2 505 47 10",
        "email": "info@hydria.be",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://hydria.be/fr/nous-contacter/",
        "notes": "Ancienne SBGE ; dénomination Hydria depuis 2021.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Mondelez Belgium SRL",
    "vatNumber": "BE0821674726",
    "nomFourni": "Mondelez",
    "sites": [
      {
        "name": "Malines",
        "siteType": "Siège / contact",
        "street": "Stationsstraat 100",
        "postalCode": "2800",
        "city": "Mechelen",
        "country": "Belgique",
        "phone": "+32 15 74 35 00",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.mondelezinternational.com/europe/contact-us/",
        "notes": "Source juridique: https://www.companyweb.be/fr/0821674726/mondelez-belgium · Contact Belgique ; usines du groupe non inventoriées intégralement.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Materne-Confilux SA",
    "vatNumber": "BE0401408863",
    "nomFourni": "Materne",
    "sites": [
      {
        "name": "Floreffe",
        "siteType": "Usine / siège",
        "street": "Allée des Cerisiers 1",
        "postalCode": "5150",
        "city": "Floreffe",
        "country": "Belgique",
        "phone": "+32 81 44 74 74",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.materne.be/policies/legal-notice",
        "notes": "Source juridique: https://www.pappers.be/fr/company/materne-confilux-0401408863 · Téléphone du service client publié sur la page contact.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Krones SA/NV",
    "vatNumber": "BE0428305775",
    "nomFourni": "Krones",
    "sites": [
      {
        "name": "Louvain-la-Neuve Sud",
        "siteType": "Service / formation",
        "street": "Rue du Bosquet 17",
        "postalCode": "1348",
        "city": "Louvain-la-Neuve",
        "country": "Belgique",
        "phone": "+32 10 48 07 00",
        "email": "krones@krones.be",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.krones.com/en/belgium.php",
        "notes": "Source juridique: https://www.pappers.be/fr/company/krones-0428305775",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Vital Materials Belgium SA",
    "vatNumber": "BE0400355226",
    "nomFourni": "5N+",
    "sites": [
      {
        "name": "Tilly",
        "siteType": "Usine",
        "street": "Rue de la Station 67",
        "postalCode": "1495",
        "city": "Tilly (Villers-la-Ville)",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.pappers.be/fr/company/vital-materials-belgium-0400355226",
        "notes": "Ancien 5N Plus Belgium, cédé à Vital Materials en décembre 2022. Anciennes coordonnées 5N+ non reprises.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Lasea SA",
    "vatNumber": "BE0465268616",
    "nomFourni": "Lasea",
    "sites": [
      {
        "name": "Seraing",
        "siteType": "Siège / production",
        "street": "Rue Louis Plescia 31",
        "postalCode": "4102",
        "city": "Seraing",
        "country": "Belgique",
        "phone": "+32 4 365 02 43",
        "email": "info@lasea.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://lasea.com/privacy-policy/",
        "notes": "Source juridique: https://www.companyweb.be/fr/0465268616/laser-engineering-applications",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "NGK Ceramics Europe SA",
    "vatNumber": "BE0401115388",
    "nomFourni": "NGK",
    "sites": [
      {
        "name": "Baudour",
        "siteType": "Usine / siège",
        "street": "Rue des Azalées 1",
        "postalCode": "7331",
        "city": "Baudour (Saint-Ghislain)",
        "country": "Belgique",
        "phone": "+32 65 76 02 10",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.ngkceramicseurope.be/fr/nous-contacter",
        "notes": null,
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Holcim (Belgique) SA",
    "vatNumber": "BE0437977764",
    "nomFourni": "Holcim",
    "sites": [
      {
        "name": "Nivelles",
        "siteType": "Siège",
        "street": "Avenue Robert Schuman 71",
        "postalCode": "1401",
        "city": "Nivelles",
        "country": "Belgique",
        "phone": "+32 67 87 66 01",
        "email": "marketing-be@holcim.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.holcim.be/fr/mentions-legales",
        "notes": null,
        "isPrimary": true
      },
      {
        "name": "Obourg",
        "siteType": "Cimenterie",
        "street": "Rue des Fabriques 2",
        "postalCode": "7034",
        "city": "Obourg (Mons)",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.holcim.be/sites/belgium/files/docs/n_86_66-2025_02_03-certificat-nf-obourg.pdf",
        "notes": "Standard local non confirmé.",
        "isPrimary": false
      }
    ]
  },
  {
    "name": "Pharma Technology SA",
    "vatNumber": "BE0443803803",
    "nomFourni": "Pharma Technology",
    "sites": [
      {
        "name": "Thines",
        "siteType": "Siège / production",
        "street": "Rue Graham Bell 8",
        "postalCode": "1402",
        "city": "Thines (Nivelles)",
        "country": "Belgique",
        "phone": "+32 67 70 13 00",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.pharmatec.be/contactus",
        "notes": "Source juridique: https://www.pappers.be/fr/company/pharma-technology-0443803803",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Westinghouse Electric Belgium SA",
    "vatNumber": "BE0449543728",
    "nomFourni": "Westinghouse",
    "sites": [
      {
        "name": "Nivelles",
        "siteType": "Siège / services",
        "street": "Rue de l'Industrie 43",
        "postalCode": "1400",
        "city": "Nivelles",
        "country": "Belgique",
        "phone": "+32 67 28 81 11",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://westinghousenuclear.com/about/locations",
        "notes": "Source juridique: https://www.pappers.be/fr/company/westinghouse-electric-belgium-0449543728",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "PolyPeptide SA",
    "vatNumber": "BE0879346768",
    "nomFourni": "Polypeptide",
    "sites": [
      {
        "name": "Braine-l'Alleud",
        "siteType": "Usine / siège",
        "street": "Chaussée de Tubize 297",
        "postalCode": "1420",
        "city": "Braine-l'Alleud",
        "country": "Belgique",
        "phone": "+32 2 386 29 09",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.polypeptide.com/contacts/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/polypeptide-0879346768",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Cenexi - Laboratoires Thissen SA",
    "vatNumber": "BE0843115684",
    "nomFourni": "Cenexi",
    "sites": [
      {
        "name": "Braine-l'Alleud",
        "siteType": "Usine / siège",
        "street": "Rue de la Papyrée 2-4-6",
        "postalCode": "1420",
        "city": "Braine-l'Alleud",
        "country": "Belgique",
        "phone": "+32 2 386 13 01",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.cenexi.com/mentions-legales/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/cenexi-laboratoires-thissen-0843115684",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Catalent Belgium SA/NV",
    "vatNumber": "BE0465935738",
    "nomFourni": "Catalent",
    "sites": [
      {
        "name": "Bruxelles",
        "siteType": "Site publié",
        "street": "Boulevard Emile Bockstael 88",
        "postalCode": "1020",
        "city": "Bruxelles",
        "country": "Belgique",
        "phone": "+32 2 426 73 94",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "À confirmer",
        "sourceUrl": "https://www.essenscia.be/fr/chimie-sciences-de-la-vie/nos-membres/catalent-belgium-3/",
        "notes": "Fiche sectorielle ; activité et exploitant actuels à confirmer avant prospection.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "BePharBel Manufacturing SA",
    "vatNumber": "BE0844689955",
    "nomFourni": "Bepharbel",
    "sites": [
      {
        "name": "Courcelles",
        "siteType": "Usine / siège",
        "street": "Rue du Luxembourg 13",
        "postalCode": "6180",
        "city": "Courcelles",
        "country": "Belgique",
        "phone": "+32 71 46 60 60",
        "email": "info@bepharbel.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.bepharbel.com/cgu/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/bepharbel-manufacturing-0844689955 · Entité Manufacturing ; BePharBel SA porte un autre numéro BCE.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Unilin BV",
    "vatNumber": "BE0405414072",
    "nomFourni": "Unilin",
    "sites": [
      {
        "name": "Wielsbeke",
        "siteType": "Siège",
        "street": "Ooigemstraat 3",
        "postalCode": "8710",
        "city": "Wielsbeke",
        "country": "Belgique",
        "phone": "+32 56 67 52 14",
        "email": "info@unilin.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.wvi.be/ondernemer/terreinbeheer/zoek-een-bedrijf/unilin",
        "notes": "Source juridique: https://www.companyweb.be/fr/0405414072/unilin · Téléphone annuaire WVI ; sites industriels non exhaustifs.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Carmeuse SA",
    "vatNumber": "BE0431473519",
    "nomFourni": "Carmeuse",
    "sites": [
      {
        "name": "Seilles",
        "siteType": "Usine / contact",
        "street": "Rue du Château 13A",
        "postalCode": "5300",
        "city": "Seilles (Andenne)",
        "country": "Belgique",
        "phone": "+32 85 83 01 11",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.carmeuse.com/eu-fr/contactez-nous",
        "notes": "Source juridique: https://www.companyweb.be/fr/0431473519/carmeuse · Plusieurs sites du groupe ; ligne ciblée Seilles.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "AGC Glass Europe SA",
    "vatNumber": "BE0413638187",
    "nomFourni": "AGC",
    "sites": [
      {
        "name": "Louvain-la-Neuve",
        "siteType": "Siège",
        "street": "Avenue Jean Monnet 4",
        "postalCode": "1348",
        "city": "Louvain-la-Neuve",
        "country": "Belgique",
        "phone": "+32 2 409 30 00",
        "email": "Glass.Communications@agc.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.agc-glass.eu/fr/mentions-legales",
        "notes": "Adresse mail institutionnelle / communication.",
        "isPrimary": true
      },
      {
        "name": "Moustier",
        "siteType": "Usine",
        "street": "Rue de la Glacerie 167",
        "postalCode": "5190",
        "city": "Moustier-sur-Sambre",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.agc-glass.eu/sites/default/files/2026-01/Directory-invoicing-email-addresses_1.pdf",
        "notes": "Adresse de facturation du site ; standard local non confirmé.",
        "isPrimary": false
      },
      {
        "name": "Mol",
        "siteType": "Usine",
        "street": "Voortstraat 27",
        "postalCode": "2400",
        "city": "Mol",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.agc-glass.eu/sites/default/files/2026-01/Directory-invoicing-email-addresses_1.pdf",
        "notes": "Adresse de facturation du site ; standard local non confirmé.",
        "isPrimary": false
      }
    ]
  },
  {
    "name": "Besins Healthcare SA",
    "vatNumber": "BE0473343667",
    "nomFourni": "Besins",
    "sites": [
      {
        "name": "Ixelles",
        "siteType": "Contact Belgique",
        "street": "Rue Washington 80",
        "postalCode": "1050",
        "city": "Ixelles (Bruxelles)",
        "country": "Belgique",
        "phone": "+32 52 25 75 84",
        "email": "info@besins-healthcare.be",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.besins-healthcare.be/fr/contacter/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/besins-healthcare-0473343667 · Entité commerciale ; site de production à préciser si nécessaire.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Prothya Biosolutions Belgium SRL",
    "vatNumber": "BE0462229645",
    "nomFourni": "Prothya",
    "sites": [
      {
        "name": "Neder-over-Heembeek",
        "siteType": "Usine / siège",
        "street": "Avenue de Tyras 109",
        "postalCode": "1120",
        "city": "Bruxelles",
        "country": "Belgique",
        "phone": "+32 2 264 64 11",
        "email": "info@prothya.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://prothya.com/contact/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/prothya-biosolutions-belgium-0462229645",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Société Nationale de Construction Aérospatiale SA",
    "vatNumber": "BE0418217577",
    "nomFourni": "Sonaca",
    "sites": [
      {
        "name": "Gosselies",
        "siteType": "Usine / siège",
        "street": "Route Nationale 5 s/n",
        "postalCode": "6041",
        "city": "Gosselies (Charleroi)",
        "country": "Belgique",
        "phone": null,
        "email": "communication@sonaca.com",
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.sonaca.com/fr/a-propos-de-sonaca/",
        "notes": "Source juridique: https://www.companyweb.be/fr/0418217577/societe-nationale-de-construction-aerospatiale · Standard général non confirmé ; numéro d'un service non substitué.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "TotalEnergies Petrochemicals Feluy SA",
    "vatNumber": "BE0416670824",
    "nomFourni": "Total Energy",
    "sites": [
      {
        "name": "Feluy",
        "siteType": "Usine",
        "street": "Parc Industriel de Feluy s/n",
        "postalCode": "7181",
        "city": "Feluy (Seneffe)",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "À confirmer",
        "sourceUrl": "https://www.pappers.be/fr/company/totalenergies-petrochemicals-feluy-0416670824",
        "notes": "Source juridique: https://www.pappers.be/fr/company/totalenergies-petrochemicals-feluy-0416670824 · Choix industriel probable ; groupe comporte plusieurs entités sur le site. Standard non confirmé.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Lhoist SA",
    "vatNumber": "BE0459399522",
    "nomFourni": "Lhoist",
    "sites": [
      {
        "name": "Limelette",
        "siteType": "Contact groupe",
        "street": "Rue Charles Dubois 28",
        "postalCode": "1342",
        "city": "Limelette (Ottignies)",
        "country": "Belgique",
        "phone": "+32 10 23 07 11",
        "email": "info@lhoist.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.lhoist.com/fr-BX/mentions-legales-belgique",
        "notes": "Source juridique: https://www.pappers.be/fr/company/lhoist-0459.399.522 · Source juridique consultée indique Rue de l'Industrie 31, 1400 Nivelles ; adresse officielle de contact distincte.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Puratos NV",
    "vatNumber": "BE0438632416",
    "nomFourni": "Puratos",
    "sites": [
      {
        "name": "Grand-Bigard",
        "siteType": "Siège / contact",
        "street": "Industrialaan 25",
        "postalCode": "1702",
        "city": "Grand-Bigard (Dilbeek)",
        "country": "Belgique",
        "phone": "+32 2 481 44 44",
        "email": "info@puratos.be",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.puratos.be/fr/contactez_nous",
        "notes": "Source juridique: https://www.pappers.be/fr/company/puratos-0438632416",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Coca-Cola Europacific Partners Belgium SRL",
    "vatNumber": "BE0425071420",
    "nomFourni": "Coca Cola",
    "sites": [
      {
        "name": "Anderlecht",
        "siteType": "Siège",
        "street": "Chaussée de Mons 1424",
        "postalCode": "1070",
        "city": "Anderlecht",
        "country": "Belgique",
        "phone": "+32 2 559 20 00",
        "email": "hello@ccep.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.coca-cola.com/be/fr/about-us/contact-us",
        "notes": "hello@ccep.com est un contact client.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Anheuser-Busch InBev",
    "vatNumber": "BE0417497106",
    "nomFourni": "AB Inbev",
    "sites": [
      {
        "name": "Louvain",
        "siteType": "Contact groupe",
        "street": "Brouwerijplein 1",
        "postalCode": "3000",
        "city": "Leuven",
        "country": "Belgique",
        "phone": "0800 58 316",
        "email": "cx.horeca@ab-inbev.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.ab-inbev.be/fr/contact",
        "notes": "Source juridique: https://www.pappers.be/fr/company/anheuser-busch-inbev-nv-0417497106 · Numéro de contact publié, gratuit et non fixe géographique. Plusieurs entités juridiques ; siège à confirmer dans BCE.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Thales Belgium SA",
    "vatNumber": "BE0434342145",
    "nomFourni": "Thales",
    "sites": [
      {
        "name": "Herstal",
        "siteType": "Usine / siège",
        "street": "Rue En Bois 63",
        "postalCode": "4040",
        "city": "Herstal",
        "country": "Belgique",
        "phone": "+32 2 391 22 11",
        "email": "info@be.thalesgroup.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://clusters.wallonie.be/sites/infopole/home/membres/memberList/thales-belgium.html",
        "notes": "Source juridique: https://www.pappers.be/fr/company/thales-belgium-0434342145 · Téléphone central publié dans fiche sectorielle ; ne pas confondre avec thales.be (cabinet juridique).",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Veolia NV/SA",
    "vatNumber": "BE0406129003",
    "nomFourni": "Veolia",
    "sites": [
      {
        "name": "Bruxelles",
        "siteType": "Siège / contact",
        "street": "Boulevard Poincaré 78-79",
        "postalCode": "1060",
        "city": "Saint-Gilles (Bruxelles)",
        "country": "Belgique",
        "phone": "+32 2 789 70 30",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.veolia.be/fr/numero-dentreprise",
        "notes": "Autres activités Veolia portées par des sociétés distinctes.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Société wallonne des eaux",
    "vatNumber": null,
    "nomFourni": "SWDE",
    "sites": [
      {
        "name": "Verviers",
        "siteType": "Siège",
        "street": "Rue de la Concorde 41",
        "postalCode": "4800",
        "city": "Verviers",
        "country": "Belgique",
        "phone": "+32 87 87 87 87",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.swde.be/fr/politique-de-protection-de-la-vie-privee",
        "notes": "Téléphone service client ; source https://www.swde.be/fr/autres-demandes. Activation TVA non vérifiée.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "in BW Association Intercommunale",
    "vatNumber": "BE0200362210",
    "nomFourni": "in BW",
    "sites": [
      {
        "name": "Nivelles",
        "siteType": "Siège",
        "street": "Rue de la Religion 10",
        "postalCode": "1400",
        "city": "Nivelles",
        "country": "Belgique",
        "phone": "+32 67 21 71 11",
        "email": "direction@inbw.be",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.inbw.be/sites/default/files/2025-12/Déclaration%20environnementale%2025.pdf",
        "notes": "Numéro TVA publié dans procès-verbaux du groupe.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Dow Silicones Belgium SRL",
    "vatNumber": "BE0406117818",
    "nomFourni": "Dow Silicone",
    "sites": [
      {
        "name": "Seneffe",
        "siteType": "Usine / siège",
        "street": "Rue Jules Bordet C",
        "postalCode": "7180",
        "city": "Seneffe",
        "country": "Belgique",
        "phone": "+32 64 88 80 00",
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://be.dow.com/fr-be/locations.html",
        "notes": "Source juridique: https://www.pappers.be/fr/company/dow-silicones-belgium-0406117818",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Desimone",
    "vatNumber": "BE0441135610",
    "nomFourni": "Desimone",
    "sites": [
      {
        "name": "Farciennes",
        "siteType": "Siège / atelier",
        "street": "Rue Fontenelle 18",
        "postalCode": "6240",
        "city": "Farciennes",
        "country": "Belgique",
        "phone": "+32 71 81 18 59",
        "email": "info@desimone.be",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.desimone.be/contact-desimone/",
        "notes": null,
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Eutomation & Scansys SRL",
    "vatNumber": "BE0896948706",
    "nomFourni": "Eutomation",
    "sites": [
      {
        "name": "Eupen",
        "siteType": "Siège / atelier",
        "street": "Industriestraße 28B",
        "postalCode": "4700",
        "city": "Eupen",
        "country": "Belgique",
        "phone": "+32 87 56 10 08",
        "email": "info@eutomation.be",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://www.eutomation.be/fr/contact",
        "notes": null,
        "isPrimary": true
      }
    ]
  },
  {
    "name": "AgiNtech SRL",
    "vatNumber": "BE0770511481",
    "nomFourni": "Agintech",
    "sites": [
      {
        "name": "Ham-sur-Sambre",
        "siteType": "Siège / contact",
        "street": "Rue Emile Vandervelde 56C",
        "postalCode": "5190",
        "city": "Ham-sur-Sambre",
        "country": "Belgique",
        "phone": "+32 71 25 62 80",
        "email": "contact@agintech.eu",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://agintech.eu/mentions-legales/",
        "notes": "Source juridique: https://www.pappers.be/fr/company/agintech-0770511481",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "BAIPS SA",
    "vatNumber": "BE0765934566",
    "nomFourni": "BAIPS",
    "sites": [
      {
        "name": "Nivelles",
        "siteType": "Siège",
        "street": "Avenue Robert Schuman 42",
        "postalCode": "1401",
        "city": "Nivelles",
        "country": "Belgique",
        "phone": null,
        "email": null,
        "establishmentUnit": null,
        "verificationStatus": "Partiel",
        "sourceUrl": "https://www.pappers.be/fr/company/baips-0765934566",
        "notes": "Source juridique: https://www.pappers.be/fr/company/baips-0765934566 · Aucun standard confirmé. Ne pas reprendre celui d'IPS Belgium sans preuve.",
        "isPrimary": true
      }
    ]
  },
  {
    "name": "Endexia SRL",
    "vatNumber": "BE1011049311",
    "nomFourni": "Endexia",
    "sites": [
      {
        "name": "Rixensart",
        "siteType": "Siège",
        "street": "Avenue John Kennedy 29",
        "postalCode": "1330",
        "city": "Rixensart",
        "country": "Belgique",
        "phone": "+32 2 466 61 69",
        "email": "info@endexia.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://endexia.com/contact-us/",
        "notes": "Source juridique: https://www.companyweb.be/fr/1011049311/endexia",
        "isPrimary": true
      },
      {
        "name": "Wavre",
        "siteType": "Bureau",
        "street": "Avenue Pasteur 2",
        "postalCode": "1300",
        "city": "Wavre",
        "country": "Belgique",
        "phone": "+32 2 466 61 69",
        "email": "info@endexia.com",
        "establishmentUnit": null,
        "verificationStatus": "Documenté",
        "sourceUrl": "https://endexia.com/contact-us/",
        "notes": "Source juridique: https://www.companyweb.be/fr/1011049311/endexia · Téléphone central partagé.",
        "isPrimary": false
      }
    ]
  }
];

async function main() {
  console.log(`[seed-companies] ${DATA.length} sociétés à importer…`);
  let createdCompanies = 0, updatedCompanies = 0, createdSites = 0, skippedSites = 0;

  for (const c of DATA) {
    // Upsert Company
    const existing = c.vatNumber
      ? await prisma.company.findUnique({ where: { vatNumber: c.vatNumber } })
      : await prisma.company.findFirst({ where: { name: c.name, vatNumber: null } });

    let company;
    if (existing) {
      company = existing;
      updatedCompanies++;
    } else {
      company = await prisma.company.create({
        data: {
          name: c.name,
          vatNumber: c.vatNumber ?? null,
          sector: "Industrie",
          status: "PROSPECT",
          source: "Import Excel 2026-10-07",
          country: "Belgique",
          notes: c.nomFourni && c.nomFourni !== c.name ? `Nom fourni : ${c.nomFourni}` : null,
        },
      });
      createdCompanies++;
    }

    // Sites : upsert via (companyId, name) comme clé logique
    for (const s of c.sites) {
      const existingSite = await prisma.companySite.findFirst({
        where: { companyId: company.id, name: s.name },
      });
      if (existingSite) {
        skippedSites++;
        continue;
      }
      await prisma.companySite.create({ data: { ...s, companyId: company.id } });
      createdSites++;
    }
  }

  console.log(`[seed-companies] Sociétés : ${createdCompanies} créées, ${updatedCompanies} déjà présentes`);
  console.log(`[seed-companies] Sites    : ${createdSites} créés, ${skippedSites} déjà présents`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
