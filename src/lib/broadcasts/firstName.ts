// Smart first-name extraction for {firstName} personalization in broadcast emails.
//
// Resolution priority (highest confidence first):
//   1. Display-name first word matches the start of the email local-part
//      → "Mark" / mark@markwebster… → "Mark"
//   2. Display-name first word is itself a known first name — trust the
//      sender's stated identity even when the local-part is unrelated
//      → "Michael" <murphy@sereno.com> → "Michael"
//      → "Tomas Cunningham" <cunauct1@…> → "Tomas"
//      → "Mary Jones" <info@somewhere> → "Mary" (fires even for role local-parts)
//   3. Local-part starts with a known first name (incl. exact match)
//      → andrew@aok… → "Andrew"; linda@dngcyrilburk.ie → "Linda"
//   4. Local-part has a separator and the first segment is clean
//      → andrew.smith@… → "Andrew"
//   5. Last resort: domain SLD prefix-matches a known first name
//      → info@marklawless.ie → "Mark"
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
  // Male — UK/Irish-leaning
  "aaron", "adam", "adrian", "aidan", "alan", "alex", "alexander", "ali",
  "andrew", "andy", "anthony", "archie", "arthur", "austin", "barry", "ben",
  "benjamin", "bernard", "bobby", "brendan", "brian", "bryan", "callum",
  "cameron", "carl", "cathal", "charles", "charlie", "chris", "christopher",
  "christy", "ciaran", "clive", "colin", "colm", "conn", "connor", "conor",
  "cormac", "craig", "cyril", "damian", "damien", "dan", "daniel", "darragh",
  "darren", "david", "declan", "dermot", "diarmuid", "dominic", "donal",
  "donnacha", "douglas", "duncan", "dylan", "eamon", "eamonn", "ed", "eddie",
  "edward", "eoghan", "eoin", "ethan", "eugene", "evan", "fergal", "fergus",
  "finbarr", "finn", "fintan", "francis", "frank", "fred", "gareth", "garrett",
  "garry", "gary", "gavin", "geoff", "geoffrey", "george", "gerald", "gerard",
  "gerry", "glenn", "gordon", "graham", "grant", "greg", "gregory", "harry",
  "henry", "howard", "hugh", "hugo", "iain", "ian", "isaac", "ivan", "jack",
  "jacob", "jake", "james", "jamie", "jarlath", "jason", "jay", "jeff",
  "jeffrey", "jeremy", "jim", "jimmy", "joe", "joel", "john", "johnny",
  "jonathan", "jonathon", "jordan", "joseph", "josh", "joshua", "julian",
  "justin", "karl", "keith", "ken", "kenneth", "kenny", "kevin", "kieran",
  "killian", "klara", "kyle", "lance", "lawrence", "leo", "leon", "leslie",
  "lewis", "liam", "lloyd", "logan", "louis", "luke", "malcolm", "marcus",
  "mark", "martin", "mason", "matt", "matthew", "max", "maxwell", "michael",
  "mike", "miles", "milo", "mitch", "morgan", "murray", "nathan", "neal",
  "neil", "niall", "nicholas", "nick", "nigel", "noel", "oisin", "oliver",
  "oran", "oscar", "owen", "paddy", "pat", "patrick", "paul", "pearse",
  "peter", "phil", "philip", "pierce", "quinn", "ray", "raymond", "reece",
  "reuben", "rich", "richard", "rob", "robert", "robin", "roger", "ronan",
  "rory", "ross", "roy", "ruairi", "russell", "ryan", "sam", "samuel", "scott",
  "sean", "seamus", "sebastian", "shane", "shaun", "shay", "simon", "stan",
  "stephen", "steve", "stewart", "stuart", "sullivan", "sunny", "ted", "terry",
  "theo", "thomas", "tim", "timothy", "tom", "tomas", "tony", "trevor", "troy",
  "tyler", "victor", "vincent", "wade", "walter", "warren", "wayne", "wesley",
  "william", "will", "yvan", "zach", "zachary",
  // Female — UK/Irish-leaning
  "abigail", "adeline", "agnes", "aileen", "aine", "alice", "alison", "amanda",
  "amy", "anastasia", "andrea", "ann", "anna", "anne", "annie", "aoife",
  "april", "ashley", "audrey", "barbara", "becky", "beth", "bethany",
  "beverly", "bridget", "bronagh", "caitlin", "cara", "caroline", "carol",
  "catherine", "cathy", "cecilia", "celine", "charlotte", "chloe", "christina",
  "christine", "ciara", "claire", "clare", "constance", "courtney", "danielle",
  "deborah", "debbie", "debra", "deirdre", "denise", "diana", "diane", "donna",
  "dora", "dorothy", "eileen", "eimear", "elaine", "eleanor", "elinor",
  "elise", "eliza", "elizabeth", "ella", "ellen", "ellie", "emer", "emily",
  "emma", "erin", "eva", "evelyn", "faye", "fiona", "florence", "frances",
  "francesca", "freya", "gemma", "georgina", "geraldine", "gillian", "gloria",
  "grace", "grainne", "hannah", "harriet", "hayley", "hazel", "heather",
  "helen", "helena", "holly", "ida", "imelda", "iris", "isabel", "isabella",
  "isobel", "jacinta", "jacqueline", "jacqui", "jane", "janet", "janice",
  "jean", "jen", "jenny", "jennifer", "jess", "jessica", "jill", "joan",
  "joanna", "joanne", "jocelyn", "jodie", "judith", "julia", "julie", "june",
  "karen", "karina", "kate", "kathleen", "kathryn", "kathy", "katie",
  "kayleigh", "keira", "kelly", "kerry", "kim", "kimberly", "kirsty", "klara",
  "kristina", "lara", "laura", "lauren", "lea", "leah", "leigh", "leona",
  "linda", "lindsey", "lisa", "lorna", "lottie", "lou", "louise", "lucia",
  "lucy", "lydia", "lynn", "mabel", "madeline", "mairead", "marcella",
  "marcia", "margaret", "margot", "maria", "marian", "marie", "marilyn",
  "marion", "martha", "mary", "maureen", "megan", "melanie", "melissa",
  "michelle", "millie", "miriam", "molly", "monica", "muriel", "nadia",
  "naomi", "natalie", "natasha", "niamh", "nicola", "nicole", "noeleen",
  "nora", "norah", "nuala", "olivia", "olwen", "orla", "pamela", "patricia",
  "paula", "pauline", "phoebe", "phyllis", "polly", "rachel", "rebecca",
  "regina", "rhonda", "rita", "roisin", "rosalind", "rose", "rosemary", "ruth",
  "samantha", "sandra", "sara", "sarah", "shannon", "sharon", "sherry",
  "shirley", "sinead", "siobhan", "sonia", "sophi", "sophia", "sophie",
  "stephanie", "susan", "suzanne", "sylvia", "tamara", "tammy", "tara",
  "teresa", "therese", "theresa", "tina", "tracey", "tracy", "trudy", "una",
  "ursula", "valerie", "vera", "vicki", "victoria", "vivienne", "wendy",
  "yvonne", "zoe",
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

  const displayLower = displayFirst ? displayFirst.toLowerCase() : null;
  const displayInDict = displayLower ? COMMON_FIRST_NAMES.includes(displayLower) : false;

  // 1. Display matches start of local-part — high confidence.
  if (!isRole && displayLower && localPart.startsWith(displayLower)) {
    return capitalize(displayFirst!);
  }

  // 2. Display first word is itself a known first name — trust it even when
  //    the local-part is unrelated, and even for role local-parts.
  if (displayInDict) {
    return capitalize(displayFirst!);
  }

  const localStripped = localPart.replace(/[._\-\d]+/g, "");

  if (!isRole) {
    // 3. Local-part starts with a known first name.
    if (localStripped.length >= 2) {
      const match = COMMON_FIRST_NAMES.find((n) => localStripped.startsWith(n));
      if (match) return capitalize(match);
    }
    // 4. Separator-split — first segment is usually the first name.
    const segments = localPart.split(/[._-]+/).filter(Boolean);
    if (segments.length > 1 && segments[0].length >= 2 && !/\d/.test(segments[0])) {
      return capitalize(segments[0]);
    }
  }

  // 5. Domain SLD prefix-matches a known first name (last resort).
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
