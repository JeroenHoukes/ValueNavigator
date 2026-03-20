/**
 * Interactive user guide derived from "User Guide 0.2" (Value Navigator).
 * Text structure follows the original PowerPoint deck.
 */

export const USER_GUIDE_META = {
  version: "0.2",
  sourceLabel: "User Guide 0.2"
} as const;

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "note"; text: string };

export type GuideSection = {
  id: string;
  title: string;
  blocks: GuideBlock[];
};

export const userGuideSections: GuideSection[] = [
  {
    id: "welcome",
    title: "Welcome",
    blocks: [
      {
        type: "p",
        text: "This interactive guide is based on the Value Navigator user guide (version 0.2). Use the menu on the left to jump between topics, or Previous / Next at the bottom of each section."
      },
      {
        type: "note",
        text: "Original material is confidential & proprietary. Content reflects the desktop Value Navigator product; some screens in this web app may differ."
      }
    ]
  },
  {
    id: "value-navigator-overview",
    title: "Value Navigator overview",
    blocks: [
      {
        type: "p",
        text: "Value Navigator (VN) is designed to model KPIs for a business – typically these are financial, non-financial or organisational."
      },
      {
        type: "ul",
        items: [
          "VN records forecasts for these KPIs:",
          "Revenue forecasts based on sales & products",
          "Investment forecasts",
          "Changes in organisations and resourcing",
          "VN records ideas, initiatives & plans that change and improve the forecasts:",
          "More revenue",
          "Better productivity",
          "Better outcomes",
          "VN helps you to optimise your plans and decisions."
        ]
      }
    ]
  },
  {
    id: "starting-point",
    title: "Starting point",
    blocks: [
      {
        type: "p",
        text: "Begin from where you are today:"
      },
      {
        type: "ul",
        items: [
          "Where does our income come from?",
          "How happy are our staff, our customers, what is our regulatory compliance?",
          "What is my organisation?",
          "If we do nothing, what will happen?"
        ]
      }
    ]
  },
  {
    id: "improvements",
    title: "Improvements — ideas, initiatives & plans",
    blocks: [
      {
        type: "ul",
        items: [
          "If I do X then I will sell more products.",
          "If I do Y then I will get more revenue and/or reduce my costs.",
          "If I do Z then my staff will be happier or my customers will be happier or my CO₂ emissions will reduce."
        ]
      },
      {
        type: "p",
        text: "But… these improvements take time, cost money, consume resources during implementation, and they have an ongoing impact (for example you may need more staff)."
      }
    ]
  },
  {
    id: "what-good-looks-like",
    title: "What does “good” look like?",
    blocks: [
      {
        type: "ul",
        items: [
          "Define your targets – e.g. I want my staff to be happy.",
          "Define your constraints – e.g. cashflow must be positive at all times.",
          "Define your consequences – e.g. if delivery times exceed 3 months then customers will be less happy.",
          "Decide how to compare one KPI with another – is one target more important than another?",
          "Define your sensitivity tests: What if sales are not as good? What if costs are higher? What if projects overrun?"
        ]
      }
    ]
  },
  {
    id: "timeline",
    title: "Timeline",
    blocks: [
      {
        type: "p",
        text: "You define the start points & growth – the system calculates this over time. You define when improvements happen. The forecast identifies extra improvements due to combinations. You decide how many years the programme covers."
      },
      {
        type: "ul",
        items: [
          "Baseline vs Improvement #1, #2, #3 over Start → extrapolate across years (e.g. Year 1–6).",
          "Improvement on improvement due to combination of initiatives."
        ]
      }
    ]
  },
  {
    id: "forecast-data",
    title: "Forecast data",
    blocks: [
      {
        type: "ul",
        items: [
          "Forecast runs for a number of years – you define how many and the period covered.",
          "Forecast covers many KPIs and you can define more.",
          "Forecasts show how different projects (baseline & improvement ideas) impact the forecast.",
          "The data is richer than simple examples; ValueDashboard is a more sophisticated analysis tool."
        ]
      }
    ]
  },
  {
    id: "value-dashboard",
    title: "ValueDashboard",
    blocks: [
      {
        type: "p",
        text: "ValueDashboard is a business intelligence platform to present and analyse Value Navigator forecast data."
      },
      {
        type: "ul",
        items: [
          "Show forecasts over time",
          "Compare portfolios",
          "Show breakdowns in data",
          "Export & include data & charts in business presentations",
          "Users can use both Navigator & Dashboard or just the system that suits them"
        ]
      }
    ]
  },
  {
    id: "how-to-use-this-guide",
    title: "How to use this guide",
    blocks: [
      {
        type: "ul",
        items: [
          "The guide is interactive – data appears as you view screens in the product.",
          "Click links to go to more information.",
          "Use start of section / back / main menu / previous & next in the product where available."
        ]
      },
      {
        type: "p",
        text: "About the guide: it is divided into sections (see the topic menu in the product). Clicking through is a logical learning sequence, but you can use the guide in any order. At the end of the full guide there are Articles & Explainers for advanced topics."
      }
    ]
  },
  {
    id: "lets-get-started",
    title: "Let’s get started",
    blocks: [
      {
        type: "p",
        text: "The following sections describe common navigation patterns, icons, and workflows in Value Navigator."
      }
    ]
  },
  {
    id: "icons",
    title: "Icons & actions",
    blocks: [
      {
        type: "ul",
        items: [
          "Navigator – used to select a screen.",
          "Save – data is only saved when you press this.",
          "Duplicate – current record is duplicated.",
          "Delete – current record is deleted.",
          "Drill down – edit the master record for the data on the screen.",
          "Back – return to the previous screen.",
          "Refresh – see changes from other users or changes made in other screens.",
          "Expand – see a larger field or more fields."
        ]
      }
    ]
  },
  {
    id: "lists",
    title: "Lists",
    blocks: [
      {
        type: "ul",
        items: [
          "Click to de-select the selected item in the list.",
          "Type in the filter box to filter the list."
        ]
      }
    ]
  },
  {
    id: "topic-menu",
    title: "Topic menu",
    blocks: [
      {
        type: "p",
        text: "The topic menu in Value Navigator lets you open master data and setup areas. Examples include:"
      },
      {
        type: "ul",
        items: [
          "Products, Projects, Sales forecasts, Investments, Portfolios, Organisations",
          "Targets, Consequences, Milestones, Calculations, Improvements",
          "Cost types, Forecast types, KPI definition, Themes, Strategies",
          "Project states, Resource types, Spend categories, Product families",
          "Profile names, Revenue categories, Effort categories",
          "Reference data, Data sharing & privacy, Articles & explainers",
          "Global settings, Profiles & custom profiles, Advanced KPIs, Templates",
          "Data model overview, Value Navigator overview, FAQs, Sensitivity tests"
        ]
      }
    ]
  },
  {
    id: "login",
    title: "Login",
    blocks: [
      {
        type: "p",
        text: "You need a user ID and password registered for Value Navigator. In this web app, sign in with Microsoft (Entra ID) where configured."
      }
    ]
  },
  {
    id: "navigate",
    title: "Navigate",
    blocks: [
      {
        type: "p",
        text: "The Navigate button opens the quick menu so you can move between screens."
      }
    ]
  },
  {
    id: "search",
    title: "Search",
    blocks: [
      {
        type: "ul",
        items: [
          "Search finds data using a text search across name & description fields on records.",
          "Results are smart: e.g. a match on a product name shows the product and where it is used (such as in a volume forecast).",
          "Enter the search criteria, execute the search, browse results by record type, and click to drill down to a matching record."
        ]
      }
    ]
  },
  {
    id: "what-do-you-want",
    title: "What do you want to do?",
    blocks: [
      {
        type: "ul",
        items: [
          "Record your baseline / do nothing",
          "Create an initiative to improve or change things",
          "Define your targets & goals",
          "Create what-if options and comparisons"
        ]
      }
    ]
  },
  {
    id: "record-baseline",
    title: "Record your baseline",
    blocks: [
      {
        type: "ul",
        items: [
          "Record my current revenue and sales forecasts",
          "Record my current operations",
          "Finishing my baseline"
        ]
      }
    ]
  },
  {
    id: "forecasting-revenue",
    title: "Forecasting revenue",
    blocks: [
      {
        type: "ul",
        items: ["Create a product", "Create a sales forecast for a product"]
      }
    ]
  },
  {
    id: "create-product",
    title: "Create a product",
    blocks: [
      {
        type: "ul",
        items: [
          "Products can have costs and/or revenue – one-off, recurring, or both. Combined with sales forecast (volume) this feeds financial forecasts.",
          "Products can have KPIs (e.g. customer happiness or CO₂). With volume, these can roll up to totals or weighted averages.",
          "Products can have effort (sales, installation, support, repair) – one-off or recurring. With volume, this supports utilisation of teams, organisations or other resources."
        ]
      },
      {
        type: "p",
        text: "Practical steps:"
      },
      {
        type: "ul",
        items: [
          "Name the product uniquely – it is shown whenever you select it.",
          "Optional picture – keep image files small.",
          "Create (or copy an existing product – copies charges, costs, resources and KPIs).",
          "Save. You can return later to edit.",
          "Optional: add the product to a family for reporting (see product families in the topic menu)."
        ]
      }
    ]
  },
  {
    id: "one-off-charges",
    title: "One-off charges & costs",
    blocks: [
      {
        type: "ul",
        items: [
          "One-off charges and one-off cost of goods sold can be modelled on the product.",
          "Different customer segments: set a charge per product, then apply discount or uplift in the sales forecast for a segment.",
          "Create or edit charge lines; icons may reflect cost category.",
          "Categorise (e.g. REVENUE, OPEX, cost of goods sold), add source or reason (e.g. cost of hardware), set amount and how it changes over time (e.g. 100 per product increasing 10% per year)."
        ]
      },
      {
        type: "note",
        text: "The full deck continues with more detail on profiles, cost categories, and related topics — extend this page as you add more slides to the source presentation."
      }
    ]
  }
];
