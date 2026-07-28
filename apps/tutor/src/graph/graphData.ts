import { layoutKnowledgeNodes } from "./graphLayout"
import type { KnowledgeEdge, KnowledgeNode } from "./graphTypes"

const ccssUrl = "https://www.thecorestandards.org/Math/Content/OA/"
const englandUrl =
  "https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study"
const australiaUrl = "https://v9.australiancurriculum.edu.au/f-10-curriculum/learning-f-10/learning-areas/mathematics"
const khanUrl =
  "https://en.khanacademy.org/math/early-math/cc-early-math-add-sub-basics/cc-early-math-together-apart/v/addition-and-subtraction-within-10"

const sourceNodes: KnowledgeNode[] = [
  {
    id: "count-sequence",
    type: "knowledge",
    position: { x: 80, y: 40 },
    data: {
      label: "Produce the counting sequence through 10",
      shortLabel: "Count through 10",
      kind: "atomic",
      definition: "Say the number words from zero through ten in the correct order.",
      whyItMatters: "The stable sequence gives each counted object a unique number word.",
      evidence: ["Recites the sequence without omissions", "Begins from zero or one when prompted"],
      mappings: [],
      resources: [],
      stage: 1,
      confidence: 0.98
    }
  },
  {
    id: "recognize-numerals",
    type: "knowledge",
    position: { x: 360, y: 40 },
    data: {
      label: "Recognize written numerals from 0 through 10",
      shortLabel: "Recognize numerals",
      kind: "atomic",
      definition: "Identify the quantity name represented by each written numeral from 0 through 10.",
      whyItMatters: "Numeral recognition connects spoken quantities to mathematical notation.",
      evidence: ["Names a displayed numeral", "Matches numeral cards to spoken number words"],
      mappings: [],
      resources: [],
      stage: 1,
      confidence: 0.97
    }
  },
  {
    id: "count-objects",
    type: "knowledge",
    position: { x: 140, y: 220 },
    data: {
      label: "Count a collection of up to 10 objects accurately",
      shortLabel: "Count objects",
      kind: "atomic",
      definition: "Assign one number word to each object and state the total number in the collection.",
      whyItMatters: "This combines one-to-one correspondence with the cardinal meaning of the final count.",
      evidence: ["Touches or tracks each object once", "States the final number as the collection size"],
      mappings: [],
      resources: [],
      stage: 2,
      confidence: 0.96
    }
  },
  {
    id: "compose-quantities",
    type: "knowledge",
    position: { x: 420, y: 220 },
    data: {
      label: "Compose a quantity within 10 from two parts",
      shortLabel: "Compose quantities",
      kind: "atomic",
      definition: "Join two visible groups and determine the size of the resulting whole.",
      whyItMatters: "Part-whole composition is the conceptual foundation of addition.",
      evidence: ["Combines two groups without losing objects", "Describes the two parts and resulting whole"],
      mappings: [],
      resources: [],
      stage: 3,
      confidence: 0.94
    }
  },
  {
    id: "represent-addition",
    type: "knowledge",
    position: { x: 255, y: 400 },
    data: {
      label: "Represent joining situations with an addition expression",
      shortLabel: "Represent addition",
      kind: "atomic",
      definition: "Translate a concrete joining situation into an expression using numerals and the plus sign.",
      whyItMatters: "Representation connects an experienced quantity change to symbolic mathematics.",
      evidence: ["Selects the two addends from the situation", "Uses the plus sign to represent joining"],
      mappings: [],
      resources: [],
      stage: 4,
      confidence: 0.93
    }
  },
  {
    id: "derive-sums",
    type: "knowledge",
    position: { x: 540, y: 400 },
    data: {
      label: "Derive sums within 10 using a counting-on strategy",
      shortLabel: "Count on to add",
      kind: "atomic",
      definition: "Start with one addend and count forward by the other addend to determine the sum.",
      whyItMatters: "Counting on is a bridge from counting all objects to efficient addition.",
      evidence: ["Starts from an addend rather than one", "Advances the correct number of counts"],
      mappings: [],
      resources: [],
      stage: 4,
      confidence: 0.91
    }
  },
  {
    id: "add-within-ten",
    type: "knowledge",
    position: { x: 390, y: 610 },
    data: {
      label: "Add two one-digit numbers with a sum from 0 through 10",
      shortLabel: "Add within 10",
      kind: "outcome",
      definition:
        "Determine the sum of two one-digit whole numbers when the result is no greater than 10, using a valid strategy.",
      whyItMatters: "This outcome is a reusable foundation for place value, subtraction, and multidigit arithmetic.",
      evidence: [
        "Produces correct sums across varied addend pairs",
        "Explains or represents a valid strategy",
        "Recognizes zero as an additive identity"
      ],
      mappings: [
        {
          framework: "Common Core Mathematics",
          code: "K.OA.A.1 and K.OA.A.2",
          relation: "Partial coverage",
          url: ccssUrl
        },
        {
          framework: "England National Curriculum",
          code: "Year 1 Number: Addition and subtraction",
          relation: "Narrower than",
          url: englandUrl
        },
        {
          framework: "Australian Curriculum v9",
          code: "AC9MFN05",
          relation: "Contributes to",
          url: australiaUrl
        }
      ],
      resources: [
        {
          provider: "Khan Academy",
          title: "Addition and subtraction within 10",
          format: "Lesson and practice",
          url: khanUrl
        }
      ],
      stage: 5,
      confidence: 0.95
    }
  },
  {
    id: "khan",
    type: "knowledge",
    position: { x: 760, y: 610 },
    data: {
      label: "Addition and subtraction within 10",
      shortLabel: "Addition and subtraction within 10",
      kind: "resource",
      definition: "An external explanation and practice path for early addition.",
      whyItMatters: "Gives a learner a balanced lesson when more explanation is useful.",
      evidence: [],
      mappings: [],
      resources: [
        {
          provider: "Khan Academy",
          title: "Addition and subtraction within 10",
          format: "Lesson and practice",
          url: khanUrl
        }
      ],
      stage: 0,
      confidence: 0.9
    }
  }
]

export const initialEdges: KnowledgeEdge[] = [
  {
    id: "count-sequence-count-objects",
    source: "count-sequence",
    target: "count-objects",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "requires", rationale: "A stable number-word sequence is required to count objects." }
  },
  {
    id: "recognize-count-objects",
    source: "recognize-numerals",
    target: "count-objects",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "supports", rationale: "Numerals support recording the result of a count." }
  },
  {
    id: "count-objects-compose",
    source: "count-objects",
    target: "compose-quantities",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "requires", rationale: "The learner must determine the size of each part and whole." }
  },
  {
    id: "recognize-represent",
    source: "recognize-numerals",
    target: "represent-addition",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "requires", rationale: "Written numerals are required for a symbolic expression." }
  },
  {
    id: "compose-represent",
    source: "compose-quantities",
    target: "represent-addition",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "requires", rationale: "The part-whole relationship gives the expression its meaning." }
  },
  {
    id: "count-sequence-derive",
    source: "count-sequence",
    target: "derive-sums",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "requires", rationale: "Counting on depends on the stable forward counting sequence." }
  },
  {
    id: "compose-derive",
    source: "compose-quantities",
    target: "derive-sums",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "supports", rationale: "Part-whole understanding makes the counting-on strategy meaningful." }
  },
  {
    id: "represent-outcome",
    source: "represent-addition",
    target: "add-within-ten",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "requires", rationale: "The learner must connect the calculation to addition notation." }
  },
  {
    id: "derive-outcome",
    source: "derive-sums",
    target: "add-within-ten",
    sourceHandle: "prerequisite-out",
    targetHandle: "prerequisite-in",
    data: { relationship: "requires", rationale: "Counting on supplies a general strategy for finding each sum." }
  },
  {
    id: "outcome-khan",
    source: "add-within-ten",
    target: "khan",
    sourceHandle: "resource-out",
    targetHandle: "resource-in",
    data: { relationship: "resource", rationale: "The lesson offers explanation and additional practice." }
  }
]

export const initialNodes = layoutKnowledgeNodes(sourceNodes, initialEdges)
