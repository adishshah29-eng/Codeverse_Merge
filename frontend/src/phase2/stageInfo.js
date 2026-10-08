// What a team has to do in each Phase 2 stage, in plain words. Shown on the dashboard ("Your next move") and at the top
// of every stage page, so nobody has to guess what a stage wants.
export const STAGE_INFO = {
  1: {
    short: "Money Trail",
    title: "Erase the Money Trail",
    kind: "Data forensics · SQL",
    goal: "Someone broke into the server room and sent a corrupt wire transfer. Find out who, and erase their trail.",
    steps: [
      "Open the forensic tables: transactions, badge logs, terminal sessions and security events.",
      "Write SQL queries that cross-reference them. Some records are decoys; discard them.",
      "Put your findings together into the Deletion Key and submit it.",
    ],
    reward: "Deletion Key",
  },
  2: {
    short: "Control Server",
    title: "Find the Control Server",
    kind: "Web & API forensics",
    goal: "Break into the IronVault banking system through its three security layers and capture the control server's token.",
    steps: [
      "Sector 1, Teller Login: get past the login by exploiting how its query is built.",
      "Sector 2, Transfers: a frozen overlay blocks the page. Inspect the page itself to get through it.",
      "Sector 3, Vault Balance: the answer is hidden in the response headers of the balance request.",
      "Each sector gives you a code. Submit all three to capture the token.",
    ],
    reward: "Control Token",
  },
  3: {
    short: "Outrun Police",
    title: "Outrun the Police",
    kind: "Graph algorithms · optimization",
    goal: "Plan the crew's escape across 60 city checkpoints, from the Hideout (N00) to the Extraction Point (N59).",
    steps: [
      "Build a route on the map. Roads close as the clock advances, and compromised nodes break a route.",
      "Stay within the limits: at most 120 minutes and 100 credits.",
      "Among valid routes, pick the one with the lowest total risk, then submit it.",
    ],
    reward: "Escape Route Code",
  },
  4: {
    short: "Extraction",
    title: "Final Extraction",
    kind: "Systems integration",
    goal: "Bring everything together and get the crew out.",
    steps: [
      "Enter the four credentials you collected: Deletion Key, Control Token, Escape Route Code and the Shutdown Code.",
      "Run the five-step override sequence in the right order before the five-minute countdown ends.",
      "Pilot the getaway crew through the tunnels to finish.",
    ],
    reward: "Your final heist score",
    note: "The Shutdown Code is not earned in a stage. Look for it in the Black Market and in announcements from the organizers.",
  },
};

export const ARTIFACTS = [
  { key: "deletion_key", name: "Deletion Key", stage: 1 },
  { key: "control_token", name: "Control Token", stage: 2 },
  { key: "route_code", name: "Escape Route Code", stage: 3 },
  { key: "shutdown_code", name: "Shutdown Code", stage: null },
];

export const RULES = [
  "Each stage is worth up to 10 points.",
  "Stuck? Intel gives a hint, but it costs points. The Black Market sells buffs for your funds.",
  "Skipping a stage costs 3 points and you can't go back.",
  "Risk adds up as you play. A higher risk lowers your Final Extraction score.",
];
