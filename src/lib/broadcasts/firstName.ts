// Smart first-name extraction for {firstName} personalization in broadcast emails.
//
// Resolution priority (highest confidence first):
//   1. Display-name first word matches the start of the email local-part
//      → "Mark" / mark@markwebster… → "Mark"
//   2. Local-part starts with a known first name (incl. exact match)
//      → andrew@aok… → "Andrew"; louisboyce10@gmail.com → "Louis"
//   3. Local-part has a separator and the first segment is clean
//      → andrew.smith@… → "Andrew"
//   4. Last resort: domain SLD prefix-matches a known first name
//      → info@marklawless.ie → "Mark" (the local-part is a role address, the
//        SLD carries the only name signal)
//
// Returns null when no confident first name is available — caller falls back
// to "there".
//
// IMPORTANT: keep in sync with the duplicate copy in
// `supabase/functions/internal-admin-api/index.ts` — same function is needed
// server-side at send time, and Deno edge functions can't import from `src/`.

const ROLE_LOCAL_PARTS = new Set([
  "info", "admin", "contact", "office", "hello", "sales",
  "enquiries", "enquiry", "reception", "team", "support",
  "noreply", "no-reply", "donotreply",
  "properties", "property", "estates", "estate", "rentals",
  "lettings", "mail", "inbox", "help", "service",
  "accounts", "marketing", "press", "media", "ops",
  "frontdesk", "general", "rentwestcork",
]);

// Compact set of common first names (UK/Irish-leaning) used for prefix
// matching against email local-parts and domain SLDs. Sorted longest-first
// at module load so e.g. "patrick" wins over "pat".
const COMMON_FIRST_NAMES: string[] = [
  "mark", "david", "john", "peter", "paul", "patrick", "pat", "james",
  "michael", "andrew", "andy", "ali", "louis", "eugene", "edward", "rowan",
  "finbarr", "sean", "cyril", "tomas", "thomas", "tom", "nigel", "kevin",
  "anthony", "aidan", "jarlath", "colm", "cathal", "cormac", "liam",
  "kenneth", "ken", "martin", "stephen", "steve", "brian", "bryan",
  "charlie", "charles", "jonathan", "mike", "gerry", "gerald", "gerard",
  "donal", "darragh", "matthew", "matt", "harry", "klara", "joe", "joseph",
  "william", "will", "graham", "gavin", "sunny", "darren", "noel", "barry",
  "kieran", "ciaran", "kenny", "george", "jack", "oliver", "oliver",
  "benjamin", "ben", "alex", "alexander", "robert", "rob", "richard",
  "rich", "christopher", "chris", "nicholas", "nick", "philip", "phil",
  "tony", "frank", "francis", "eamon", "eamonn", "brendan", "seamus",
  "shane", "declan", "damien", "dermot", "fergal", "oisin", "ronan",
  "hugh", "hugo", "daniel", "dan", "simon", "samuel", "sam", "tim",
  "timothy", "graham", "rory", "conor", "connor", "ruairi", "padraig",
  "padraic", "donnacha", "diarmuid", "fintan", "owen", "ross",
  "mary", "sarah", "jane", "caroline", "amanda", "lisa", "julia",
  "anne", "ann", "maria", "catherine", "kate", "katie", "helen",
  "emma", "sophie", "sophia", "sophi", "olivia", "emily", "amy",
  "rachel", "rebecca", "becky", "laura", "jenny", "jennifer", "claire",
  "clare", "andrea", "adeline", "theresa", "therese", "noeleen",
  "valerie", "fiona", "roisin", "michelle", "orla", "aoife", "niamh",
  "sinead", "siobhan", "deirdre", "eimear", "grainne", "caoimhe",
  "ellen", "ella", "alice", "hannah", "lucy", "molly", "ruth", "joan",
  "jacqui", "jacqueline", "louise", "lou",
].sort((a, b) => b.length - a.length);

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

export function deriveFirstName(name: string | null, email: string): string | null {
  const atIdx = email.lastIndexOf("@");
  if (atIdx < 1) return null;
  const localPart = email.slice(0, atIdx).toLowerCase();
  const domainPart = email.slice(atIdx + 1).toLowerCase();
  const isRole = ROLE_LOCAL_PARTS.has(localPart);

  let displayFirst: string | null = null;
  if (name) {
    const word = (name.trim().split(/\s+/)[0] || "").replace(/[^\w'-]/g, "");
    if (word.length >= 2 && word.length <= 15 && !ROLE_LOCAL_PARTS.has(word.toLowerCase())) {
      displayFirst = word;
    }
  }

  const localStripped = localPart.replace(/[._\-\d]+/g, "");

  if (!isRole) {
    // 1. Display name matches start of local-part — high confidence.
    if (displayFirst && localPart.startsWith(displayFirst.toLowerCase())) {
      return capitalize(displayFirst);
    }
    // 2. Local-part starts with a known first name.
    if (localStripped.length >= 2) {
      const match = COMMON_FIRST_NAMES.find((n) => localStripped.startsWith(n));
      if (match) return capitalize(match);
    }
    // 3. Local-part has a separator — first segment is usually the first name.
    const segments = localPart.split(/[._-]+/).filter(Boolean);
    if (segments.length > 1 && segments[0].length >= 2 && !/\d/.test(segments[0])) {
      return capitalize(segments[0]);
    }
  }

  // 4. Domain SLD prefix-matches a known first name (last resort).
  const domainParts = domainPart.split(".");
  const sld =
    domainParts.length >= 3 && /^(co|com|org|net|gov|ac)$/.test(domainParts[domainParts.length - 2])
      ? domainParts[domainParts.length - 3]
      : domainParts[0];
  if (sld && /^[a-z]+$/.test(sld) && sld.length >= 4) {
    const match = COMMON_FIRST_NAMES.find((n) => sld.startsWith(n));
    if (match) return capitalize(match);
  }

  return null;
}

export function firstNameOf(name: string | null, email: string): string {
  return deriveFirstName(name, email) ?? "there";
}
