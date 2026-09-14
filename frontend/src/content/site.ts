export const site = {
  footerWordmark: "LAKINDU",
  firstName: "Lakindu",
  fullName: "Lakindu Jayathilaka",
  roles: [
    "Backend Developer",
    "Frontend Developer",
    "Web Developer",
    "ICT Tutor",
    "Computer Science Undergraduate",
  ],
  nav: [
    { label: "Home", href: "/#home" },
    { label: "About", href: "/#about" },
    { label: "Stack", href: "/#stack" },
    { label: "Approach", href: "/#services" },
    { label: "Projects", href: "/#projects" },
    { label: "Contact", href: "/#get-in-touch" },
  ],
} as const;

export const about = {
  headingLineOne: "My development",
  headingLineTwo: "journey so far.",
  intro:
    "I am a Computer Science undergraduate with 4+ years of hands-on web development experience. My journey spans front-end and back-end development, ICT tutoring, event planning, and collaborative software projects.",
  experience: [
    {
      role: "Software Developer", company: "Bambinoo (SDGP)", period: "2025–2026",
      description:
        "Developed an AI-powered web system for storing, retrieving, analyzing, and monitoring child health records in real time.",
    },
    {
      role: "Web Developer", company: "Rooster Web Development", period: "2025–Present",
      description:
        "Developed and customized responsive WordPress websites using premium themes, plugins, and purpose-built code for client needs.",
    },
    {
      role: "Web Developer", company: "Self-Employed (Online)", period: "2021–Present",
      description:
        "Built and maintained 5+ responsive websites for schools and businesses, including updates, bug fixes, and performance optimization.",
    },
    {
      role: "Event Planner", company: "Self-Employed", period: "2021–Present",
      description: "Organized 15+ events for school societies and clubs, coordinating logistics and adapting plans for smooth execution.",
    },
    {
      role: "ICT Tutor", company: "Self-Employed", period: "2020–Present",
      description: "Teach 45+ O/L and A/L ICT students through personalized lessons, practical exercises, and hands-on programming sessions.",
    },
  ],
  cta: { label: "Read My CV", href: "/lakindu-jayathilaka-cv.pdf" },
} as const;

export const stack = {
  heading: {
    before: "The",
    accent: "stack",
    after: "behind meaningful work.",
  },
  description:
    "Every project, from digital products to visual identities, is crafted with thoughtful systems, refined aesthetics, and a focus on usability and emotion.",
  technicalSkills: [
    "Python",
    "React",
    "HTML",
    "Node.js",
    "CSS",
    "PHP",
    "Java",
    "MySQL",
    "OOP",
  ],
  services: [
    {
      title: "Web Development",
      description:
        "Responsive websites built with clean code and reliable performance.",
    },
    {
      title: "Backend Development",
      description:
        "Secure server solutions using PHP, Node.js, and MySQL.",
    },
    {
      title: "WordPress Solutions",
      description:
        "Flexible WordPress websites customized around each client's goals.",
    },
    {
      title: "ICT Tutoring",
      description:
        "Clear and practical ICT lessons for O/L and A/L students.",
    },
    {
      title: "Software Development",
      description:
        "Useful web and desktop applications built with modern technologies.",
    },
    {
      title: "Creative Media",
      description:
        "Engaging design, content, and production through L.S. Studio.",
    },
  ],
  items: [
    {
      name: "Framer",
      logo: "framer",
      blurb:
        "Framer revolutionizes my web design workflow. It goes beyond a simple website builder, offering a visual playground where I can craft stunning and interactive websites without getting bogged down in complex code.",
    },
    {
      name: "Figma",
      logo: "figma",
      blurb:
        "Figma is my collaborative design platform of choice. I utilize it to work seamlessly with team members and clients, facilitating real-time feedback and design iterations. Its cloud-based approach streamlines the design process.",
    },
    {
      name: "Notion",
      logo: "notion",
      blurb:
        "Notion helps me keep my projects organized. I use it for project management, task tracking, and as a central hub for documentation, ensuring that everything from design notes to project timelines is in one place.",
    },
    {
      name: "Airtable",
      logo: "airtable",
      blurb:
        "Airtable is my go-to solution for robust data organization. I harness its power to create structured databases, making information easily accessible and ensuring a systematic approach to handling complex datasets.",
    },
    {
      name: "Zapier",
      logo: "zapier",
      blurb:
        "Framer serves as my go-to tool for creating interactive prototypes. I use it to bring designs to life, allowing stakeholders to experience the user flow and interactions before development begins. It's invaluable for refining the user experience.",
    },
    {
      name: "Lemon Squeezy",
      logo: "lemonsqueezy",
      blurb:
        "LemonSqueezy stands as my comprehensive solution for managing every aspect of my SaaS business. From seamless payment processing and subscription management to global tax compliance and fraud prevention, this all-in-one platform simplifies the complexities of running a SaaS operation.",
    },
    {
      name: "Mailchimp",
      logo: "mailchimp",
      blurb:
        "Mailchimp is my go-to for elevating outreach strategies. I utilize its features to craft engaging email campaigns, manage subscriber lists, and analyze performance data, ensuring effective and targeted communication.",
    },
    {
      name: "Slack",
      logo: "slack",
      blurb:
        "Slack is the cornerstone of my collaborative workflow. It fosters a dynamic environment where teams can seamlessly exchange ideas, share files, and provide real-time feedback.",
    },
    {
      name: "Creative Cloud",
      logo: "creativecloud",
      blurb:
        "Adobe Creative Cloud is my comprehensive toolkit for unleashing creative potential. It offers a powerful suite of applications like Photoshop, Illustrator, and After Effects, each designed to excel in specific design tasks.",
    },
    {
      name: "Chat GPT",
      logo: "chatgpt",
      blurb:
        "ChatGPT is my content generation and assistance tool. I leverage it for content ideas, copywriting, and problem-solving. It provides invaluable insights and suggestions that enhance the quality of my projects.",
    },
    {
      name: "HTML",
      logo: "html",
      blurb:
        "HTML5 is the backbone of my web design work. I use it to structure content, ensuring that websites are semantically meaningful and accessible. It forms the foundation upon which the visual elements of a site are built.",
    },
    {
      name: "CSS",
      logo: "css",
      blurb:
        "CSS3 is my styling and layout powerhouse. It's instrumental in creating visually appealing websites by controlling everything from fonts and colors to the responsive design that adapts to various screen sizes.",
    },
  ],
} as const;

export const services = {
  heading: "How I shape every design project.",
  intro:
    "A clear path from the first conversation to a product that’s ready to ship.",
  items: [
    {
      title: "Research",
      headline: "Understand the problem before solutions.",
      body: "We dig into user needs, competitor patterns, and stakeholder goals to uncover what matters most before any design work begins.",
      image: "/images/process-research.png",
      imageAlt: "Portrait with a warm beam of light across the eye",
      icon: "research",
    },
    {
      title: "Design",
      headline: "Shape clear, considered product experiences.",
      body: "Concepts turn into flows, wireframes, and polished interfaces that balance usability with brand expression across every key journey.",
      image: "/images/process-design.png",
      imageAlt: "Atmospheric sky and landscape composition",
      icon: "design",
    },
    {
      title: "Develop",
      headline: "Build with craft, clarity, and precision.",
      body: "Designs move into working product through close collaboration with engineering, ensuring interactions feel smooth and intentional.",
      image: "/images/process-develop.png",
      imageAlt: "Editorial abstract development visual",
      icon: "develop",
    },
    {
      title: "Handoff",
      headline: "Deliver ready for confident next steps.",
      body: "Specs, assets, and documentation are packaged so teams can ship faster, stay aligned, and maintain quality long after launch.",
      image: "/images/process-handoff.png",
      imageAlt: "Editorial abstract handoff visual",
      icon: "handoff",
    },
  ],
} as const;

export const statistics = [
  {
    value: "4+",
    label: "Years in web development",
    accessibleLabel: "years in web development",
  },
  {
    value: "5+",
    label: "Websites developed",
    accessibleLabel: "websites developed",
  },
  {
    value: "45+",
    label: "Students taught",
    accessibleLabel: "students taught",
  },
  {
    value: "15+",
    label: "Events organised",
    accessibleLabel: "events organised",
  },
] as const;

export const projects = {
  heading: "Selected projects.",
  description: "A closer look at the products I've designed and the teams behind them.",
  viewAllHref: "#projects",
  /**
   * Project entries now live in the database and are read through the
   * repository layer (see `src/lib/data`). The original six are preserved in
   * `src/content/portfolio-seed.ts`, which seeds Supabase and doubles as the
   * fallback when Supabase is not configured.
   */
} as const;

export const contact = {
  email: "lakindujaythilaka24404@gmail.com",
} as const;

/**
 * "Get in touch" section, measured from the Folira template's contact block
 * (https://folira.framer.media). Field set and labels are functional; the copy
 * is ours.
 */
export const getInTouch = {
  heading: "Get in touch.",
  blurb:
    "Tell me what you're building and where it's stuck. Everything that lands here gets read, and you'll hear back within a couple of days.",
  submit: "Send inquiry",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      placeholder: "Your name",
      required: true,
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      placeholder: "you@company.com",
      required: true,
    },
    {
      name: "company",
      label: "Company / Website",
      type: "text",
      placeholder: "Company, product, or URL",
    },
    {
      name: "stage",
      label: "Project stage",
      type: "select",
      options: [
        "Idea / discovery",
        "MVP / early product",
        "Live product",
        "Rebuild / redesign",
      ],
    },
    {
      name: "service",
      label: "Service needed",
      type: "select",
      options: [
        "Website Design & Development",
        "Landing Page Design",
        "E-commerce Design",
        "Website Prototyping",
      ],
    },
    {
      name: "budget",
      label: "Budget range",
      type: "select",
      options: ["Under $5k", "$5k–$10k", "$10k–$25k", "$25k+"],
    },
    {
      name: "timeline",
      label: "Timeline",
      type: "select",
      options: ["ASAP", "This month", "Next 1–3 months", "Flexible"],
    },
    {
      name: "notes",
      label: "Project notes",
      type: "textarea",
      placeholder:
        "What are you building, who is it for, and what would a good outcome look like?",
    },
  ],
} as const;

/**
 * Footer, measured from the Folira template (https://folira.framer.media).
 * Geometry at 1280px: 80px top padding, three rows on a 64px column gap,
 * 64px side gutters, a 500px newsletter column against two 80px-apart link
 * columns, then the clipped wordmark. Copy and destinations are ours.
 */
export const footer = {
  newsletter: {
    heading: "Keep you in the loop.",
    blurb: "New work and process notes, delivered straight to your inbox.",
    placeholder: "name@email.com",
    submit: "Subscribe",
  },
  columns: [
    {
      label: "Main",
      links: [
        { label: "Home", href: "/#home" },
        { label: "About", href: "/#about" },
        { label: "Stack", href: "/#stack" },
        { label: "Approach", href: "/#services" },
      ],
    },
    {
      label: "Links",
      links: [
        { label: "Projects", href: "/#projects" },
        { label: "Contact", href: "/#get-in-touch" },
      ],
    },
  ],
  emailLabel: "Email",
  socials: [
    { label: "LinkedIn", icon: "linkedin", href: "https://www.linkedin.com/in/lakindu-jayathilaka/" },
    { label: "Instagram", icon: "instagram", href: "https://www.instagram.com/__laki_2.0__/" },
    { label: "GitHub", icon: "github", href: "https://github.com/Lakindu24404" },
  ],
} as const;
