import type { IdentityReview } from "./committee-reviewed-identities.js"

// The 106th Directory prints "Kent Cochran, of North Dakota" in these two
// children. Its member-by-member index and CREC-1999-02-08, D114, independently
// identify Cochran in both assignments. The parent prints Thad Cochran of MS.
// This is a reviewed name AND state contradiction, not a reusable alias.
const congress106Identities: IdentityReview["identities"] = [
  {
    printedName: "Kent Cochran",
    state: "ND",
    canonicalState: "MS",
    chamber: "upper",
    personId: "person:congress:c000567",
    canonicalName: "Cochran, Thad",
    givenName: "Thad",
    familyName: "Cochran",
    district: null,
    contexts: [
      { name: "Marketing Inspection and Product Promotion", parentName: "Agriculture, Nutrition and Forestry" },
      { name: "Production and Price Competitiveness", parentName: "Agriculture, Nutrition and Forestry" }
    ],
    corroboration: {
      name: "Thad Cochran",
      state: "MS",
      count: 1,
      contexts: [{ name: "Agriculture, Nutrition and Forestry" }]
    }
  }
]

// Offline-reviewed source cells. These are edition-bound decisions, never
// source-provided aliases or a runtime nickname dictionary. Each fingerprint
// covers JSON.stringify of the entire parsed roster in its original order.
const congress108Identities: IdentityReview["identities"] = [
  // Identity evidence: CDIR-2005-07-11-SC-S-1 explicitly prints LINDSEY O. GRAHAM and G000359. Cross-edition identity only; target edition supplies every assignment and target-Congress term supplies chamber.
  {
    printedName: "Lindsey O. Graham",
    state: "SC",
    chamber: "upper",
    personId: "person:congress:g000359",
    canonicalName: "Graham, Lindsey",
    givenName: "Lindsey",
    familyName: "Graham",
    district: null,
    contexts: [
      {
        name: "Armed Services"
      },
      {
        name: "Emerging Threats and Capabilities",
        parentName: "Armed Services"
      },
      {
        name: "Seapower",
        parentName: "Armed Services"
      },
      {
        name: "Strategic Forces",
        parentName: "Armed Services"
      },
      {
        name: "Health, Education, Labor, and Pensions"
      },
      {
        name: "Children and Families",
        parentName: "Health, Education, Labor, and Pensions"
      },
      {
        name: "Veterans’ Affairs"
      }
    ]
  },
  // State correction evidence: target Superfund and Waste Management cell prints MO, while its Environment and Public Works parent identifies John W. Warner of VA. CDIR-2003-07-11-VA-S-1 links JOHN W. WARNER to W000154. Requires the separate exact parent-state guard, not a global state override.
  {
    printedName: "John W. Warner",
    state: "MO",
    chamber: "upper",
    personId: "person:congress:w000154",
    canonicalName: "Warner, John",
    givenName: "JOHN",
    familyName: "WARNER",
    district: null,
    contexts: [
      {
        name: "Superfund and Waste Management",
        parentName: "Environment and Public Works"
      }
    ],
    canonicalState: "VA",
    corroboration: {
      name: "John W. Warner",
      count: 1,
      state: "VA",
      contexts: [
        {
          name: "Environment and Public Works"
        }
      ]
    }
  },
  // Identity evidence: CDIR-2005-07-11-TN-S-1 explicitly prints WILLIAM H. (BILL) FRIST and F000439. Cross-edition identity only; no committee assignment transferred.
  {
    printedName: "Bill Frist",
    state: "TN",
    chamber: "upper",
    personId: "person:congress:f000439",
    canonicalName: "Frist, William H.",
    givenName: "WILLIAM",
    familyName: "FRIST",
    district: null,
    contexts: [
      {
        name: "Finance"
      },
      {
        name: "Health Care",
        parentName: "Finance"
      },
      {
        name: "International Trade",
        parentName: "Finance"
      },
      {
        name: "Social Security and Family Policy",
        parentName: "Finance"
      },
      {
        name: "Health, Education, Labor, and Pensions"
      },
      {
        name: "Rules and Administration"
      }
    ]
  },
  // Reviewed identity inference, not an explicit nickname alias: target IA roster prints Steven King; CDIR-2003-07-11-IA-H-5 identifies STEVE KING / K000362. Unique eligible IA House district 5 catalog identity; Peter King of NY is a different candidate.
  {
    printedName: "Steven King",
    state: "IA",
    chamber: "lower",
    personId: "person:congress:k000362",
    canonicalName: "King, Steve",
    givenName: "Steve",
    familyName: "King",
    district: "5",
    contexts: [
      {
        name: "Agriculture"
      },
      {
        name: "Conservation, Credit, Rural Development, and Research",
        parentName: "Agriculture"
      },
      {
        name: "Department Operations, Oversight, Nutrition, and Forestry",
        parentName: "Agriculture"
      }
    ]
  },
  // Reviewed identity inference: target VA roster prints Ed Schrock; CDIR-2002-10-01-VA-H-2 identifies EDWARD L. SCHROCK / S001151. Unique eligible VA House district 2 identity; no global Ed-to-Edward expansion.
  {
    printedName: "Ed Schrock",
    state: "VA",
    chamber: "lower",
    personId: "person:congress:s001151",
    canonicalName: "Schrock, Edward L.",
    givenName: "EDWARD",
    familyName: "SCHROCK",
    district: "2",
    contexts: [
      {
        name: "Armed Services"
      },
      {
        name: "Projection Forces",
        parentName: "Armed Services"
      },
      {
        name: "Tactical Air and Land Forces",
        parentName: "Armed Services"
      },
      {
        name: "Total Force",
        parentName: "Armed Services"
      }
    ]
  },
  // Reviewed identity inference: target MA roster prints Marty Meehan; CDIR-2002-10-01-MA-H-5 identifies MARTIN T. MEEHAN / M000627. Unique eligible MA House district 5 identity; no runtime nickname rule.
  {
    printedName: "Marty Meehan",
    state: "MA",
    chamber: "lower",
    personId: "person:congress:m000627",
    canonicalName: "Meehan, Martin T.",
    givenName: "MARTIN",
    familyName: "MEEHAN",
    district: "5",
    contexts: [
      {
        name: "Armed Services"
      },
      {
        name: "Terrorism, Unconventional Threats and Capabilities",
        parentName: "Armed Services"
      },
      {
        name: "Total Force",
        parentName: "Armed Services"
      }
    ]
  },
  // Reviewed identity inference: target OK roster prints Thomas Cole; CDIR-2003-07-11-OK-H-4 identifies TOM COLE / C001053. Unique eligible OK House district 4 identity; no runtime Thomas-to-Tom expansion.
  {
    printedName: "Thomas Cole",
    state: "OK",
    chamber: "lower",
    personId: "person:congress:c001053",
    canonicalName: "Cole, Tom",
    givenName: "Tom",
    familyName: "Cole",
    district: "4",
    contexts: [
      {
        name: "Education and the Workforce"
      },
      {
        name: "Employer-Employee Relations",
        parentName: "Education and the Workforce"
      },
      {
        name: "21st Century Competitiveness",
        parentName: "Education and the Workforce"
      }
    ]
  },
  // Reviewed identity inference: target OH roster prints Timothy J. Ryan; CDIR-2003-07-11-OH-H-17 links TIM RYAN and Tim J. Ryan to R000577. Unique eligible OH House district 17 candidate, distinct from Paul Ryan of WI.
  {
    printedName: "Timothy J. Ryan",
    state: "OH",
    chamber: "lower",
    personId: "person:congress:r000577",
    canonicalName: "Ryan, Tim",
    givenName: "TIM",
    familyName: "RYAN",
    district: "17",
    contexts: [
      {
        name: "Education and the Workforce"
      },
      {
        name: "Select Education",
        parentName: "Education and the Workforce"
      },
      {
        name: "21st Century Competitiveness",
        parentName: "Education and the Workforce"
      }
    ]
  },
  // Reviewed identity inference: target NJ roster prints Chris Smith; CDIR-2002-10-01-NJ-H-4 identifies CHRISTOPHER H. SMITH / S000522. Unique eligible NJ House district 4 candidate, distinct from the other Smith identities.
  {
    printedName: "Chris Smith",
    state: "NJ",
    chamber: "lower",
    personId: "person:congress:s000522",
    canonicalName: "Smith, Christopher H.",
    givenName: "Christopher",
    familyName: "Smith",
    district: "4",
    contexts: [
      {
        name: "Veterans’ Affairs"
      }
    ]
  },
  // Reviewed identity inference: target FL roster prints Mike Bilirakis; CDIR-2002-10-01-FL-H-9 identifies MICHAEL BILIRAKIS / B000463. Unique eligible FL House district 9 identity; no global nickname rule.
  {
    printedName: "Mike Bilirakis",
    state: "FL",
    chamber: "lower",
    personId: "person:congress:b000463",
    canonicalName: "Bilirakis, Michael",
    givenName: "MICHAEL",
    familyName: "BILIRAKIS",
    district: "9",
    contexts: [
      {
        name: "Veterans’ Affairs"
      },
      {
        name: "Oversight and Investigations",
        parentName: "Veterans’ Affairs"
      }
    ]
  },
  // Reviewed middle-initial evidence: CDIR-2003-07-11-NC-H-5 links Richard Mauze Burr and RICHARD BURR to B001135. Target NC roster prints Richard M. Burr. Target-Congress House district 5 term required, not the later Senate term.
  {
    printedName: "Richard M. Burr",
    state: "NC",
    chamber: "lower",
    personId: "person:congress:b001135",
    canonicalName: "Burr, Richard",
    givenName: "Richard",
    familyName: "Burr",
    district: "5",
    contexts: [
      {
        name: "Permanent Select Committee on Intelligence"
      },
      {
        name: "Human Intelligence, Analysis and Counterintelligence",
        parentName: "Permanent Select Committee on Intelligence"
      },
      {
        name: "Intelligence Policy and National Security",
        parentName: "Permanent Select Committee on Intelligence"
      },
      {
        name: "Terrorism and Homeland Security",
        parentName: "Permanent Select Committee on Intelligence"
      }
    ]
  }
]

const congress109Identities: IdentityReview["identities"] = [
  // Reviewed identity inference, not an explicit nickname alias: target IA roster prints Steven King; CDIR-2003-07-11-IA-H-5 identifies STEVE KING / K000362. Unique eligible IA House district 5 catalog identity; Peter King of NY is a different candidate.
  {
    printedName: "Steven King",
    state: "IA",
    chamber: "lower",
    personId: "person:congress:k000362",
    canonicalName: "King, Steve",
    givenName: "Steve",
    familyName: "King",
    district: "5",
    contexts: [
      {
        name: "Agriculture"
      },
      {
        name: "Conservation, Credit, Rural Development, and Research",
        parentName: "Agriculture"
      },
      {
        name: "General Farm Commodities and Risk Management",
        parentName: "Agriculture"
      },
      {
        name: "Livestock and Horticulture",
        parentName: "Agriculture"
      }
    ]
  },
  // Reviewed compound-name identity inference: CDIR-2005-07-11-WA-H-5 prints CATHY McMORRIS but supplies no Bioguide ID. Existing catalog uniquely identifies McMorris Rodgers, Cathy / M001159 in WA House district 5. Missing metadata ID is not presented as explicit Bioguide evidence.
  {
    printedName: "Cathy McMorris",
    state: "WA",
    chamber: "lower",
    personId: "person:congress:m001159",
    canonicalName: "McMorris Rodgers, Cathy",
    givenName: "Cathy",
    familyName: "Rodgers",
    district: "5",
    contexts: [
      {
        name: "Armed Services"
      },
      {
        name: "Readiness",
        parentName: "Armed Services"
      },
      {
        name: "Strategic Forces",
        parentName: "Armed Services"
      },
      {
        name: "Education and the Workforce"
      },
      {
        name: "Select Education",
        parentName: "Education and the Workforce"
      },
      {
        name: "21st Century Competitiveness",
        parentName: "Education and the Workforce"
      },
      {
        name: "Resources"
      },
      {
        name: "Forests and Forest Health",
        parentName: "Resources"
      },
      {
        name: "Water and Power",
        parentName: "Resources"
      }
    ]
  },
  // Reviewed identity inference: target MA roster prints Marty Meehan; CDIR-2002-10-01-MA-H-5 identifies MARTIN T. MEEHAN / M000627. Unique eligible MA House district 5 identity; no runtime nickname rule.
  {
    printedName: "Marty Meehan",
    state: "MA",
    chamber: "lower",
    personId: "person:congress:m000627",
    canonicalName: "Meehan, Martin T.",
    givenName: "MARTIN",
    familyName: "MEEHAN",
    district: "5",
    contexts: [
      {
        name: "Armed Services"
      },
      {
        name: "Military Personnel",
        parentName: "Armed Services"
      },
      {
        name: "Terrorism, Unconventional Threats and Capabilities",
        parentName: "Armed Services"
      }
    ]
  },
  // Reviewed identity inference: target TX Budget roster prints Mike Conaway; CDIR-2005-07-11-TX-H-11 identifies K. MICHAEL CONAWAY / C001062. Unique eligible TX House district 11 identity; no global Mike-to-Michael expansion.
  {
    printedName: "Mike Conaway",
    state: "TX",
    chamber: "lower",
    personId: "person:congress:c001062",
    canonicalName: "Conaway, K. Michael",
    givenName: "K.",
    familyName: "Conaway",
    district: "11",
    contexts: [
      {
        name: "Budget"
      }
    ]
  },
  // Reviewed identity inference: target OH roster prints Timothy J. Ryan; CDIR-2003-07-11-OH-H-17 links TIM RYAN and Tim J. Ryan to R000577. Unique eligible OH House district 17 candidate, distinct from Paul Ryan of WI.
  {
    printedName: "Timothy J. Ryan",
    state: "OH",
    chamber: "lower",
    personId: "person:congress:r000577",
    canonicalName: "Ryan, Tim",
    givenName: "TIM",
    familyName: "RYAN",
    district: "17",
    contexts: [
      {
        name: "Education and the Workforce"
      },
      {
        name: "Select Education",
        parentName: "Education and the Workforce"
      },
      {
        name: "21st Century Competitiveness",
        parentName: "Education and the Workforce"
      }
    ]
  },
  // Explicit identity evidence: CDIR-2003-07-11-CA-H-45 links MARY BONO and Mary Bono Mack to B001228. Target edition supplies all assignments; its district 45 term is independently required.
  {
    printedName: "Mary Bono",
    state: "CA",
    chamber: "lower",
    personId: "person:congress:b001228",
    canonicalName: "Bono Mack, Mary",
    givenName: "MARY",
    familyName: "BONO MACK",
    district: "45",
    contexts: [
      {
        name: "Energy and Commerce"
      },
      {
        name: "Commerce, Trade, and Consumer Protection",
        parentName: "Energy and Commerce"
      },
      {
        name: "Energy and Air Quality",
        parentName: "Energy and Commerce"
      },
      {
        name: "Environment and Hazardous Materials",
        parentName: "Energy and Commerce"
      },
      {
        name: "Health",
        parentName: "Energy and Commerce"
      }
    ]
  },
  // Reviewed identity inference: target WA roster prints Dave G. Reichert; CDIR-2005-07-11-WA-H-8 identifies DAVID G. REICHERT / R000578. Unique eligible WA House district 8 candidate; no runtime Dave-to-David expansion.
  {
    printedName: "Dave G. Reichert",
    state: "WA",
    chamber: "lower",
    personId: "person:congress:r000578",
    canonicalName: "Reichert, David G.",
    givenName: "David",
    familyName: "Reichert",
    district: "8",
    contexts: [
      {
        name: "Homeland Security"
      },
      {
        name: "Emergency Preparedness, Science, and Technology",
        parentName: "Homeland Security"
      },
      {
        name: "Intelligence, Information Sharing, and Terrorism Risk Assessment",
        parentName: "Homeland Security"
      },
      {
        name: "Management, Integration and Oversight",
        parentName: "Homeland Security"
      },
      {
        name: "Science"
      },
      {
        name: "Energy",
        parentName: "Science"
      },
      {
        name: "Environment, Technology, and Standards",
        parentName: "Science"
      },
      {
        name: "Research",
        parentName: "Science"
      }
    ]
  },
  // Reviewed identity inference: target PA roster prints Charlie Dent; CDIR-2005-07-11-PA-H-15 identifies CHARLES W. DENT / D000604. Unique eligible PA House district 15 identity; no runtime nickname rule.
  {
    printedName: "Charlie Dent",
    state: "PA",
    chamber: "lower",
    personId: "person:congress:d000604",
    canonicalName: "Dent, Charles W.",
    givenName: "Charles",
    familyName: "Dent",
    district: "15",
    contexts: [
      {
        name: "Homeland Security"
      },
      {
        name: "Emergency Preparedness, Science, and Technology",
        parentName: "Homeland Security"
      },
      {
        name: "Intelligence, Information Sharing, and Terrorism Risk Assessment",
        parentName: "Homeland Security"
      },
      {
        name: "Management, Integration and Oversight",
        parentName: "Homeland Security"
      }
    ]
  },
  // Reviewed identity inference: target SC roster prints Robert D. Inglis; CDIR-2005-07-11-SC-H-4 identifies BOB INGLIS / I000023. Unique eligible SC House district 4 identity; source extra initials and nickname do not authorize general normalization.
  {
    printedName: "Robert D. Inglis",
    state: "SC",
    chamber: "lower",
    personId: "person:congress:i000023",
    canonicalName: "Inglis, Bob",
    givenName: "BOB",
    familyName: "INGLIS",
    district: "4",
    contexts: [
      {
        name: "Judiciary"
      },
      {
        name: "Courts, the Internet, and Intellectual Property",
        parentName: "Judiciary"
      },
      {
        name: "Immigration, Border Security, and Claims",
        parentName: "Judiciary"
      }
    ]
  },
  // Reviewed identity inference: target FL roster prints Mike Bilirakis; CDIR-2002-10-01-FL-H-9 identifies MICHAEL BILIRAKIS / B000463. Unique eligible FL House district 9 identity; no global nickname rule.
  {
    printedName: "Mike Bilirakis",
    state: "FL",
    chamber: "lower",
    personId: "person:congress:b000463",
    canonicalName: "Bilirakis, Michael",
    givenName: "MICHAEL",
    familyName: "BILIRAKIS",
    district: "9",
    contexts: [
      {
        name: "Veterans’ Affairs"
      },
      {
        name: "Oversight and Investigations",
        parentName: "Veterans’ Affairs"
      }
    ]
  }
]

export const historicalIdentityReviews: readonly IdentityReview[] = [
  {
    packageId: "CDIR-1999-06-15",
    congress: 106,
    fingerprint: "49e580bbb11ac221f8a67d4cc70a884e91c32b174b281887805da5cc8d969212",
    organizations: 199,
    entries: 3331,
    identities: congress106Identities
  },
  {
    packageId: "CDIR-2000-02-01",
    congress: 106,
    fingerprint: "54031e31df3d662243a23c2697ff9e7c3a736bed4d04bbe3a676306ba8fb11ae",
    organizations: 199,
    entries: 3331,
    identities: congress106Identities
  },
  {
    packageId: "CDIR-2000-10-01",
    congress: 106,
    fingerprint: "54031e31df3d662243a23c2697ff9e7c3a736bed4d04bbe3a676306ba8fb11ae",
    organizations: 199,
    entries: 3331,
    identities: congress106Identities
  },
  {
    packageId: "CDIR-2003-07-11",
    congress: 108,
    fingerprint: "0b0b5d99cc90453a48ae64a217797c821e7c7a73acaceadebf6c8ea5c9a3b800",
    organizations: 206,
    entries: 3856,
    identities: congress108Identities
  },
  {
    packageId: "CDIR-2003-11-01",
    congress: 108,
    fingerprint: "535fc3cc84856bd3048bfef8ed020be3879f2414e917df6ba6a86c9774aec60e",
    organizations: 206,
    entries: 3856,
    identities: congress108Identities
  },
  {
    packageId: "CDIR-2004-01-01",
    congress: 108,
    fingerprint: "535fc3cc84856bd3048bfef8ed020be3879f2414e917df6ba6a86c9774aec60e",
    organizations: 206,
    entries: 3856,
    identities: congress108Identities
  },
  {
    packageId: "CDIR-2004-08-01",
    congress: 108,
    fingerprint: "535fc3cc84856bd3048bfef8ed020be3879f2414e917df6ba6a86c9774aec60e",
    organizations: 206,
    entries: 3856,
    identities: congress108Identities
  },
  {
    packageId: "CDIR-2005-07-11",
    congress: 109,
    fingerprint: "ef870ba558c4a90bd6b25e3902dbd13bbac90472400eada7e2c0910e1bbc65b2",
    organizations: 209,
    entries: 3781,
    identities: congress109Identities
  },
  {
    packageId: "CDIR-2006-09-01",
    congress: 109,
    fingerprint: "ef870ba558c4a90bd6b25e3902dbd13bbac90472400eada7e2c0910e1bbc65b2",
    organizations: 209,
    entries: 3781,
    identities: congress109Identities
  }
]
