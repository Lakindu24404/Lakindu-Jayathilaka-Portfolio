// This module is imported directly by Node-based seed/audit scripts as well as
// by Next.js, so its runtime dependency must be a real relative ESM path rather
// than the app-only `@/` alias.
import { LOGO_FIT_DEFAULT } from "../lib/data/logo-fit.ts";
import type { ProjectRecord, StackTechRecord } from "@/lib/data/types";

/** The default framing, in the record's own field names. */
const LOGO_FIT_DEFAULT_RECORD = {
  logoScale: LOGO_FIT_DEFAULT.scale,
  logoOffsetX: LOGO_FIT_DEFAULT.offsetX,
  logoOffsetY: LOGO_FIT_DEFAULT.offsetY,
} as const;

/**
 * The portfolio content as it shipped before the dashboard existed.
 *
 * This module has two jobs:
 *   1. It is the input to `npm run seed`, which imports it into Supabase.
 *   2. It is the read-only fallback the public site renders when Supabase is
 *      not configured, so the portfolio looks identical with or without a
 *      database behind it.
 *
 * Nothing here should be edited by hand once the dashboard is live — edit in
 * `/dashboard` instead.
 */

/**
 * The twenty-one orbit nodes previously hard-coded in `Stack.tsx`, in ring order.
 *
 * The outer and middle rings were already spaced evenly from 0deg, so they use
 * automatic distribution. The inner pair sat at 45deg / 225deg rather than
 * 0deg / 180deg, so those two keep a manual angle and render identically.
 *
 * ChatGPT and Adobe carry a white icon mode: their logos were previously
 * inverted by a `[data-brand]` rule in `Stack.module.css`, and the icon mode
 * now owns that decision so the dashboard control actually has an effect.
 */
export const stackSeed: StackTechRecord[] = (
  [
    // Twenty-one across four rings: the wider rings carry more nodes so the
    // angular spacing stays even-looking from the outside in (60 / 72 / 120
    // degrees), and the inner pair keeps its hand-placed angles.
    { name: "HTML", brandKey: "html", logoPath: "/images/stack-html5.svg", ring: "farOuter" },
    { name: "CSS", brandKey: "css", logoPath: "/images/stack-css3.svg", ring: "farOuter" },
    { name: "JavaScript", brandKey: "javascript", logoPath: "/images/stack-javascript.svg", ring: "farOuter" },
    { name: "PHP", brandKey: "php", logoPath: "/images/stack-php.svg", ring: "farOuter" },
    { name: "XAMPP", brandKey: "xampp", logoPath: "/images/stack-xampp.svg", ring: "farOuter" },
    { name: "C++", brandKey: "cplusplus", logoPath: "/images/stack-cplusplus.svg", ring: "farOuter" },
    { name: "VS Code", brandKey: "vscode", logoPath: "/images/stack-vscode.svg", ring: "farOuter", iconMode: "white" },
    { name: "Claude", brandKey: "claude", logoPath: "/images/stack-claude.svg", ring: "farOuter" },
    { name: "C#", brandKey: "csharp", logoPath: "/images/stack-csharp.svg", ring: "outer" },
    { name: "MySQL", brandKey: "mysql", logoPath: "/images/stack-mysql.svg", ring: "outer" },
    { name: "Java", brandKey: "java", logoPath: "/images/stack-java.svg", ring: "outer" },
    { name: "Python", brandKey: "python", logoPath: "/images/stack-python.svg", ring: "outer" },
    { name: "React", brandKey: "react", logoPath: "/images/stack-react.svg", ring: "outer" },
    { name: "Gemini", brandKey: "gemini", logoPath: "/images/stack-gemini.svg", ring: "outer", iconMode: "white" },
    { name: "ClickUp", brandKey: "clickup", logoPath: "/images/stack-clickup-mark.svg", ring: "outer" },
    { name: "WordPress", brandKey: "wordpress", logoPath: "/images/stack-wordpress.svg", ring: "middle" },
    { name: "ChatGPT", brandKey: "chatgpt", logoPath: "/images/stack-chatgpt.svg", ring: "middle", iconMode: "white" },
    { name: "GitHub", brandKey: "github", logoPath: "/images/stack-github.svg", ring: "middle", iconMode: "white" },
    { name: "Canva", brandKey: "canva", logoPath: "/images/stack-canva-mark.svg", ring: "middle" },
    { name: "IntelliJ IDEA", brandKey: "intellij", logoPath: "/images/stack-intellij.svg", ring: "inner", angle: 45 },
    { name: "Adobe", brandKey: "adobe", logoPath: "/images/stack-adobe.svg", ring: "inner", angle: 225, iconMode: "white" },
  ] satisfies ReadonlyArray<{
    name: string;
    brandKey: string;
    logoPath: string;
    ring: StackTechRecord["ring"];
    angle?: number;
    iconMode?: StackTechRecord["iconMode"];
  }>
).map((item, index) => ({
  id: `seed-stack-${item.brandKey}`,
  name: item.name,
  brandKey: item.brandKey,
  logoPath: item.logoPath,
  ring: item.ring,
  displayOrder: index,
  enabled: true,
  nodeBackground: null,
  iconMode: item.iconMode ?? "original",
  manualAngle: item.angle !== undefined,
  angle: item.angle ?? null,
  // The centred, unzoomed default. Every seeded logo is already drawn to fit
  // its node, so the framing editor starts from "leave it alone".
  ...LOGO_FIT_DEFAULT_RECORD,
  updatedAt: null,
}));

/**
 * The portfolio projects bundled as the public site's database fallback.
 */
const rawProjects = [
    {
      slug: "cafs",
      tag: "Full-Stack Website & Custom CMS",
      title: "CAFS — Mental Health Website & Custom CMS",
      href: "/cafs",
      image: "/images/project-cafs.png",
      gallery: [
        "/images/project-cafs-detail-login.png",
        "/images/project-cafs-detail-mission.png",
        "/images/project-cafs-detail-dashboard.png",
      ],
      client: "CAFS Lanka",
      duration: "",
      preview: "",
      templateLabel: "",
      templateHref: "",
      intro:
        "CAFS is a full-stack website and custom content management system created for CAFS Lanka. The public experience helps people learn about mental health, explore counselling, psychotherapy, interventions and psychometric assessment services, meet the team, discover the CAFS Home, review community work and resources, and find a clear path to support. Behind it, a role-based CMS lets staff manage the organisation’s changing content and day-to-day digital operations without editing source files.",
      approach:
        "The project was designed as two connected products: a calm, human public website and a focused operational workspace for CAFS staff. PHP pages render responsive HTML, CSS and JavaScript interfaces from MySQL content, while shared application modules handle authentication, validation, media, mail and domain-specific workflows. The web server exposes only the public directory; configuration, application code, migrations, private documents and tests remain outside the document root.",
      sections: [
        {
          heading: "A Complete Public Support Journey",
          body: "The public site connects the CAFS story, values, model and team with service education, therapist profiles and appointment pathways. Dedicated areas present the CAFS Home, projects, workshops, impact stories, partners, photo galleries, blog posts and downloadable resources. Careers, clinical and research internships, volunteer roles and events sit inside a unified Join Our Mission experience, while the contact flow sends structured support requests and confirmations through PHPMailer.",
        },
        {
          heading: "Content Operations Without Code",
          body: "The custom CMS manages projects, workshop schedules, gallery photos, therapists, blog resources, home statistics, contact-form service options and the full volunteering hub. Staff can also edit impact cards with nested detail panels, partner and supporter records, and two CAFS Home image carousels with non-destructive focal-point controls. Draft, published, archived, active and inactive states keep public visibility separate from work in progress.",
        },
        {
          heading: "Role-Based Administration and Accountability",
          body: "Admin and editor accounts use a centralized, deny-by-default permission model. Editors can manage public content and their own profile, while user accounts, therapists, maintenance controls and the activity log remain admin-only. Every privileged request revalidates the account and current role against the database, every CMS write is protected by a CSRF token, and the activity log records operational changes for traceability.",
        },
        {
          heading: "Secure Applications and Media Workflows",
          body: "Career, internship and volunteer-role applications use a two-stage workflow: a public submission enters a private pending queue and becomes a permanent record only when an authorized staff member adds it to the shortlist. PDF bytes and metadata are verified, duplicate applications are prevented per email and opportunity, staged packages and indexes are signed, and promotion is transactional. Image uploads use byte-level type checks, strict size and dimension limits, generated filenames and guarded non-executable directories.",
        },
      ],
      features:
        "Public features include the homepage, organisation story and team, mental-health education, service and therapist directories, appointment and contact pathways, the CAFS Home, projects and workshops, an event calendar, impact content, partners and supporters, a photo gallery, blog and downloadable resources, careers, internships, volunteer roles, events and PDF CV applications. The CMS adds dashboards and quick actions, project and workshop CRUD, publishing controls, gallery and image cropping tools, therapist management, blog/resource uploads, configurable statistics and services, volunteer opportunity and application management, CV preview and shortlisting, space-carousel focal points, impact and supporter editors, staff accounts, profile settings, activity auditing and maintenance tools.",
      a11y:
        "The responsive public pages and Bootstrap-based CMS use semantic headings, labelled controls, modal focus handling and a shared skip link for keyboard users. Security and resilience are treated as part of usability: prepared database queries, context-aware escaping and HTML sanitization, CSP nonces and browser security headers, secure sessions, CSRF checks, contact-form honeypot, signed timing tokens and rate limits, fail-closed production configuration, private CV storage and restricted document delivery. PHP security tests and HTTP smoke tests cover permissions, write branches, routes, uploads, XSS boundaries, database guards and the CV lifecycle.",
      conclusion:
        "CAFS is more than a public-facing redesign: it is a maintainable digital platform for communicating care and running the content workflows behind it. The result combines a welcoming mental-health experience with a substantial PHP and MySQL CMS, granular administration, secure application handling, migration tooling and regression coverage built around the organisation’s real operational needs.",
    },
    {
      slug: "bambinoo",
      tag: "Full-Stack AI Application",
      title: "Bambinoo — Digital Child Health Record",
      href: "/bambinoo",
      image: "/images/project-bambinoo.png",
      gallery: [
        "/images/project-bambinoo-detail-left.png",
        "/images/project-bambinoo-detail-center.png",
        "/images/project-bambinoo-detail-right.png",
      ],
      client: "IIT / University of Westminster",
      duration: "2025–2026",
      preview: "",
      templateLabel: "",
      templateHref: "",
      intro:
        "Bambinoo is a cloud-based, AI-assisted Digital Child Health and Development Record system created to modernize Sri Lanka's paper-based CHDR. It brings growth measurements, vaccinations, developmental milestones, appointments, clinical notes, and communication into one connected record, giving parents and healthcare professionals a clearer view of each child's health journey.",
      approach:
        "The project began by translating real CHDR workflows into focused experiences for four user groups: parents, doctors, nurses or midwives, and administrators. A responsive React interface communicates with a Flask REST API and relational data layer, while JWT authentication and role-based access keep each user inside the tools and records relevant to their responsibilities.",
      sections: [
        {
          heading: "From Paper Records to Continuous Care",
          body: "The core challenge was turning information normally spread across a physical record into a reliable digital history. Bambinoo connects measurements, vaccine schedules, milestones, medical observations, prescriptions, appointments, and report requests so important context remains available across visits and between different care providers.",
        },
        {
          heading: "Role-Based Full-Stack Architecture",
          body: "Parents can follow progress and recommendations, doctors can review records and add clinical insights, nurses can update growth and immunization data, and administrators can manage users, registrations, events, and system health. React, Vite, Axios, Bootstrap, Plotly, and Recharts power the interface; Flask, SQLAlchemy, JWT, and a relational database support the API and protected workflows.",
        },
        {
          heading: "AI-Assisted Growth Intelligence",
          body: "The growth prediction engine combines an LSTM model with WHO reference standards to estimate future height and weight checkpoints from a child's visit history. Visual analytics, trend charts, risk indicators, and health alerts turn those calculations into information that caregivers can review and discuss rather than raw data they must interpret alone.",
        },
        {
          heading: "Secure Collaboration and Delivery",
          body: "JWT-protected endpoints, role checks, password hashing, and controlled access to sensitive records form the security foundation. Real-time Socket.IO messaging connects parents with healthcare staff, while automated backend tests, frontend component tests, build checks, and a GitHub Actions pipeline support safer team delivery.",
        },
      ],
      features:
        "The parent experience includes a health overview, growth analytics, milestone and vaccine tracking, appointments, education, AI-assisted insights, nutrition planning, report requests, and direct messaging. Doctor and nurse workspaces add patient search, CHDR review, growth and immunization updates, medical history, notes, prescriptions, and professional profiles. An administration area covers user management, registration approvals, event management, operational statistics, and system health monitoring.",
      a11y:
        "Responsive layouts and role-specific navigation keep complex medical workflows easier to scan across desktop and mobile screens. Forms, charts, and status panels pair color with written labels, while test coverage checks authentication, growth records, vaccinations, milestones, messaging, administration, security, and end-to-end role workflows. Planned enhancements include complete Sinhala and Tamil localization, offline synchronization, and integration with national eHealth services.",
      conclusion:
        "Bambinoo demonstrates how a familiar national health record can become a connected digital service without losing the structure healthcare teams already understand. The result is a substantial full-stack group project that combines product design, healthcare workflows, secure data management, real-time communication, analytics, and machine learning in one system.",
    },
    {
      slug: "lms",
      tag: "Full-Stack Learning Management System",
      title: "ICTwithLS — Student, Staff & Admin LMS",
      href: "/lms",
      image: "/images/project-lms.png",
      gallery: [
        "/images/project-lms-detail-mobile.png",
        "/images/project-lms-detail-admin.png",
        "/images/project-lms-detail-registration.png",
      ],
      client: "ICTwithLS",
      duration: "",
      preview: "",
      templateLabel: "",
      templateHref: "",
      intro:
        "ICTwithLS is a full-stack learning management system that connects the complete student journey—from public course registration and account onboarding to classes, exams, internal marks, enrollments, payments, receipts, and notifications. Separate Student, Staff, and Admin workspaces turn what would otherwise be scattered forms and records into one structured operating system for the institute.",
      approach:
        "The platform is built as a server-rendered PHP and MySQL application with JavaScript-driven interfaces and responsive HTML/CSS. The work went beyond the visible dashboards: the data model, migrations, session boundaries, role authorization, audit histories, background delivery queues, and transactional review flows were designed together so each portal could share the same records without sharing authority.",
      sections: [
        {
          heading: "Registration to Active Student Account",
          body: "A seven-step public application captures course selection, student and guardian details, eligibility information, consent, discovery source, and a final review. Applications enter a pending Admin queue; approval atomically allocates the next LSyyNNN student number, creates the account and first enrollment, and issues a one-time temporary password that must be replaced at first login. Additional class requests follow their own pending, approved, or rejected review lifecycle.",
        },
        {
          heading: "Three Portals, One Learning Workflow",
          body: "Students receive grade-, subject-, course-, enrollment-, and payment-aware access to classes and exams, alongside mark analysis, enrollment requests, payment history and submissions, receipts, notifications, and profile tools. Staff manage only the classes, exams, marks, students, and payment views granted by their teaching assignments. Administrators oversee registrations, student and staff accounts, subjects and courses, enrollments, billing, payment proofs, account setup, and operational status from a central console.",
        },
        {
          heading: "Scoped Teaching and Assessment Records",
          body: "Staff authority is resolved from explicit subject, grade, and optional course assignments with validity dates and per-assignment capabilities for classes, exams, marks, and payment visibility. Unmapped or expired scopes fail closed. Assessment records support absent students, score validation, draft review, publishing, voiding with a required reason, and append-only revisions, while students can see only published results that belong to their active enrollment scope.",
        },
        {
          heading: "Auditable Payments and Secure Operations",
          body: "The payment domain covers monthly fee schedules, student proof uploads, Admin approval or rejection, server-generated receipt numbers, printable receipts, payment summaries, and protected proof storage. Database constraints prevent duplicate live submissions and duplicate student–subject/course–month payments; corrections void a ledger entry instead of erasing history. Prepared statements, bcrypt password hashing, HttpOnly same-site sessions, CSRF protection, one-time hashed setup/reset tokens, rate-limited recovery, and queued notification workers protect the surrounding workflows.",
        },
      ],
      features:
        "The Student portal includes a personal overview, filtered classes and exams, MCQ submission links, internal marks, notifications, enrollment management, monthly payment status, proof submission, receipt access, password change, and profile details. The Staff portal includes assignment-aware dashboards, scoped class and exam CRUD, eligible-student lookup, mark entry and publication, read-only payment visibility, tools, and account recovery. The Admin console manages registration decisions, students, staff lifecycle and teaching assignments, subjects and courses, enrollment requests, payments, fee schedules, proof review, receipts, notification delivery status, and explicit audit-preserving corrections.",
      a11y:
        "Responsive desktop, tablet, and mobile layouts are paired with labeled navigation, form validation and error regions, status text, keyboard-aware dialogs, focus handling, and a persistent dark-mode preference. The repository also includes PHP syntax checks, 27 focused PHP test runners, Playwright browser tests, fixture-safety checks, and concurrent-run isolation in CI across authentication, sessions, migrations, security, billing, proofs, marks, registration reviews, staff authorization, notifications, and both portal versions.",
      conclusion:
        "ICTwithLS evolved from a student-facing dashboard into a complete institute platform with carefully separated responsibilities and verifiable record ownership. Its strongest result is not a single screen, but the connected lifecycle underneath it: applications become accounts, assignments become controlled teaching access, lessons become assessed outcomes, and payments become auditable records without losing the approachable experience students and staff need every day.",
    },
    {
      slug: "oralguard-lk",
      tag: "AI-Assisted Oral Cancer Screening App",
      title: "OralGuard LK — Oral Cancer Screening App",
      href: "/oralguard-lk",
      image: "/images/project-oralguard-lk.png",
      gallery: [
        "/images/project-oralguard-lk-detail-onboarding.png",
        "/images/project-oralguard-lk-detail-clinics.png",
        "/images/project-oralguard-lk-detail-screening.png",
      ],
      client: "TeamLogicForge",
      duration: "May 9–15, 2025",
      preview: "",
      templateLabel: "",
      templateHref: "",
      intro:
        "OralGuard LK is a Sri Lanka-focused app for AI-assisted oral-cancer risk screening. It guides a registered user through a structured risk questionnaire and an oral-cavity photo, combines the two results into a colour-coded risk zone, and keeps the outcome available through screening history and a downloadable PDF. The product is designed as an early-awareness and follow-up aid—not a diagnosis—so the experience pairs its result with next-step guidance and a medical disclaimer.",
      approach:
        "The app was developed as a connected mobile, API, AI, and data platform during a May 2025 hackathon. A React Native and Expo application handles the user journey; a Node.js and Express API validates Supabase JWTs and coordinates screening records; a FastAPI service runs TensorFlow inference; and Supabase PostgreSQL and Storage persist account, result, and image data. This separation keeps the screening interface focused while isolating authentication, storage, scoring, reporting, and model execution behind service boundaries.",
      sections: [
        {
          heading: "Questionnaire and Image Screening Journey",
          body: "The implemented flow starts an authenticated screening record, calculates a rule-based questionnaire score, captures an oral photo with device permission handling, uploads it to a private application storage bucket, and forwards the image to the inference service. The API then persists the image result and calculates a final risk verdict when the required inputs are available. Users can review the zone and score breakdown, return to previous screenings, and request a branded PDF report for clinical follow-up.",
        },
        {
          heading: "EfficientNet Inference Behind a Stable API",
          body: "The Python service loads the repository's TensorFlow model and class-index mapping, validates incoming image type and size, preprocesses the image, and exposes prediction through FastAPI. The Express layer acts as the coordinator between mobile requests, questionnaire scoring, Supabase records, image storage, and model inference. An EfficientNet-B4 model artifact is included in the repository, but no verified evaluation dataset, clinical study, or accuracy metrics were found, so the portfolio presents the app as an AI-assisted screening aid rather than a validated diagnostic tool.",
        },
        {
          heading: "Localized, Mobile-First Follow-Up",
          body: "English, Sinhala, and Tamil locale resources support the questionnaire and result experience, making the core journey more relevant to Sri Lankan users. The mobile interface includes onboarding, camera capture, results, history, profile-oriented navigation, and PDF reporting. A PHI-oriented screen and metadata-based PHI authorization check explore community-health use, while the web project extends the concept to a public-facing experience. These surfaces share the same service and data foundations instead of duplicating the screening logic in each client.",
        },
        {
          heading: "Security Foundations and Honest MVP Boundaries",
          body: "Supabase bearer tokens protect the screening routes, ownership rules restrict stored records, and the API adds controlled CORS, Helmet security headers, request logging, and rate limiting. Images are stored through Supabase Storage rather than the S3 design described in earlier planning material. The code audit also identified important MVP boundaries: clinic routes still return HTTP 501, the anonymous-token endpoint does not connect to the authenticated screening flow, no administrator role was verified, and automated test coverage is minimal.",
        },
      ],
      features:
        "Implemented capabilities include multilingual onboarding and questionnaire UI, rule-based risk scoring, camera permission and photo capture, authenticated screening creation, Supabase image upload, TensorFlow model inference through FastAPI, combined verdict persistence, result history, and PDF generation with a disclaimer. Supabase provides authentication, PostgreSQL records, row ownership controls, and application image storage. The Express API separates auth, screening, AI proxy, clinic, and PHI concerns, while metadata-based checks gate PHI-specific access. Clinic discovery remains a visible mock backed by 501 endpoints, anonymous screening is incomplete, and no production Admin role or verified clinical performance metrics are claimed.",
      a11y:
        "The mobile-first flow uses permission states, translated UI copy, explicit result zones, history views, and downloadable reports to keep the screening journey understandable across English, Sinhala, and Tamil. Security middleware, request validation, restricted record ownership, and PDF disclaimers support safer handling of sensitive screening information. The repository audit did not find a comprehensive accessibility audit or substantial automated mobile/API test coverage, so accessibility and production readiness remain areas for further validation rather than completed claims.",
      conclusion:
        "OralGuard LK demonstrates an end-to-end health-tech app rather than a collection of disconnected screens: questionnaire answers and a captured image travel through authenticated services, model inference, persistent records, and a user-facing report. The application establishes a credible technical foundation for early-awareness screening in Sri Lanka while remaining transparent about what comes next—clinical evaluation, a working clinic directory, a coherent anonymous flow, stronger role administration, and deeper automated testing.",
    },
    {
      slug: "ls-ecommerce",
      tag: "Full-Stack E-Commerce & Order Tracking",
      title: "L.S. — E-Commerce & Order Tracking Platform",
      href: "/ls-ecommerce",
      image: "/images/project-ls-ecommerce.png",
      gallery: [
        "/images/project-ls-ecommerce-detail-home.png",
        "/images/project-ls-ecommerce-detail-contact.png",
        "/images/project-ls-ecommerce-detail-blog.png",
      ],
      client: "L.S. Computer Technology",
      duration: "",
      preview: "",
      templateLabel: "",
      templateHref: "",
      intro:
        "L.S. is a custom e-commerce platform created for a technology retailer, combining a product-led storefront with customer accounts, checkout, payment handling, and public order tracking. Behind the shopping experience is a dedicated operations system for managing products, stock, orders, receipts, shipping, customers, promotions, staff permissions, and business reporting from one place.",
      approach:
        "The project uses PHP 8.2 and MySQL 8 with a custom MVC structure instead of a packaged commerce framework. Server-rendered Bootstrap 5.3 views connect to controller, model, session, mail, upload, and security services, while database transactions protect the most important checkout operations. The result is a single codebase spanning the storefront, customer portal, order workflow, and a 14-module Admin CMS.",
      sections: [
        {
          heading: "A Complete Storefront and Customer Journey",
          body: "Customers can browse categories, search and filter the catalogue, inspect product images and approved reviews, save wish-list items, and manage a session-backed cart. Coupons, dynamic shipping charges, address details, and authenticated checkout feed into two supported payment paths: Cash on Delivery or bank transfer with a PDF/JPG/PNG receipt upload. Account screens bring orders, addresses, reviews, wish lists, notifications, and profile management into the same journey.",
        },
        {
          heading: "Transactional Checkout and Live Order Tracking",
          body: "Checkout creates the order, item snapshots, payment record, stock movement, and initial status history inside one database transaction. Conditional inventory updates prevent stock from dropping below zero, while every order receives unique order and tracking numbers. Customers can then follow a public visual timeline through the operational workflow—from Pending and Payment Pending to Preparing, Packed, Out for Delivery, Delivered, and Completed—with cancellation and refund states available when needed.",
        },
        {
          heading: "A 14-Module Admin Operations Centre",
          body: "The Admin CMS covers dashboard metrics, products, categories, inventory, orders, payments, reviews, customers, coupons, shipping, staff, reports, settings, and audit logs. Teams can monitor low stock and stock history, adjust inventory, verify or reject bank receipts, move orders through their status workflow, moderate reviews, configure delivery rates, manage promotional rules, and export order data as CSV. Status updates can also trigger customer email notifications.",
        },
        {
          heading: "Security and Accountability by Design",
          body: "The implementation combines Argon2ID password hashing with a bcrypt fallback, CSRF tokens, prepared PDO queries, login lockout and action rate limits, secure session renewal, fingerprint checks, and HttpOnly SameSite cookies. Uploads are restricted by size, extension, and detected MIME type. Role-and-permission checks protect administrative capabilities, while activity and audit records preserve operational accountability. These safeguards are implemented in the repository, although they still require deployment-specific configuration and production security testing.",
        },
      ],
      features:
        "The verified build includes a responsive product catalogue, categories, search, filters, sorting and pagination; product media and moderated verified-purchase reviews; customer registration, sign-in, email verification and password recovery; wish lists, a session cart, coupons and configurable shipping; Cash on Delivery and bank-transfer checkout with receipt validation; transactional stock deduction; unique order and tracking identifiers; an 11-state order history and public tracking timeline; customer addresses, orders, reviews, notifications and profile tools; and a 14-module Admin CMS for catalogue, inventory, fulfilment, payments, customers, promotions, staff permissions, reports, settings and audit logs. The code implements CSV order export; broader PDF/Excel export and PWA claims found in documentation were not treated as completed features because corresponding implementations were not found in the inspected source.",
      a11y:
        "Bootstrap-based responsive layouts support desktop and mobile storefront views, with persistent light and dark themes across the public and administrative interfaces. Forms use labelled inputs, validation feedback, explicit account and order states, and structured navigation to keep shopping and fulfilment tasks understandable. Security-sensitive actions use CSRF validation and guarded sessions. A formal accessibility audit and an automated test or CI suite were not present in the inspected repository, so keyboard, screen-reader, contrast, regression, and production-load testing remain important next steps.",
      conclusion:
        "L.S. goes beyond a storefront mock-up by connecting discovery, checkout, payment evidence, inventory control, fulfilment, and customer-visible tracking in one operational platform. Its custom MVC foundation demonstrates broad full-stack ownership, while the honest implementation boundary is clear: the core commerce workflow is present, and the next maturity step is systematic automated testing, accessibility verification, and deployment hardening.",
    },
    {
      slug: "climedge",
      tag: "Climate Education Website",
      title: "ClimEdge — Climate Education & Action Website",
      href: "/climedge",
      image: "/images/project-climedge.png",
      gallery: [
        "/images/project-climedge-home.png",
        "/images/project-climedge-plans.png",
        "/images/project-climedge-clean-energy.png",
      ],
      client: "University of Westminster coursework",
      duration: "",
      preview: "",
      templateLabel: "",
      templateHref: "",
      intro:
        "ClimEdge is a responsive, multi-page climate education website created by a four-person group for the University of Westminster Web Design and Development module at IIT Sri Lanka. The experience turns climate awareness into clear routes for learning and participation through focused educational content, volunteering opportunities, sustainability support plans, a community profile, feedback, team information, and a visual sitemap. My Student 02 contribution established the shared navigation, footer, and core layout; delivered the Home and Price Plan pages; created the Promote Clean Energy content page; and supported the team throughout the build.",
      approach:
        "I built the core experience as a framework-free static website using semantic HTML5, modular CSS3, CSS Grid, Flexbox, media queries, and lightweight vanilla JavaScript. A consistent seven-link header and shared footer connect the main pages, while reusable visual rules keep the teal-and-green identity coherent. Responsive layouts adapt content grids, typography, spacing, and the wide comparison table for smaller screens. JavaScript is reserved for focused interactions such as the animated splash sequence, smooth scroll-to-top controls, volunteer-card scrolling, review expansion and sorting, and feedback confirmation. The implementation is intentionally described as a front-end prototype: its donation, pricing, profile contact, and feedback controls do not process payments or persist user data to a backend.",
      sections: [
        {
          heading: "A Climate Journey Built Around Awareness and Action",
          body: "The Home page opens with a looping climate video and a direct message about education and action, then moves through awareness, conservation, and innovation focus areas. A Why Act Now section links visitors to four deeper learning paths—cutting carbon emissions, saving natural resources, promoting clean energy, and climate education—before presenting the mission, support options, and trusted external resources from NASA, the IPCC, UNFCCC, and the US EPA.",
        },
        {
          heading: "My Student 02 Contribution",
          body: "As Student 02, I designed and developed the navigation, footer, and main page structure used across the group project. I owned the Home page, the EcoGuard Price Plan page, and the Promote Clean Energy content page, while also guiding the other team members. The clean-energy experience uses an in-page contents menu and structured sections covering the urgency of change, solar, wind, hydroelectric, ocean and geothermal energy, environmental and economic benefits, storage, smart grids, green hydrogen, and practical individual and community actions.",
        },
        {
          heading: "Pricing and Participation Without a Backend",
          body: "The Price Plan page presents Green Starter, Eco Professional, and Enterprise Green tiers in a detailed comparison table covering tree planting, CO₂ monitoring, carbon-footprint assessment, impact certificates, sustainability reporting, consulting, support, and certification. These calls to action are interface demonstrations rather than a connected billing flow. The wider group experience adds a volunteer-program carousel, expandable and sortable reviews, a static user persona with volunteering availability and supported UN goals, a detailed feedback form, team profiles, and a linked sitemap.",
        },
        {
          heading: "Responsive Front-End Architecture and Constraints",
          body: "The repository is a collection of linked HTML documents, page-specific CSS files, shared styles, local images and videos, and inline scripts; it has no application framework, server, database, authentication layer, or build pipeline. Grid and Flexbox are used throughout, with breakpoints at page-appropriate widths to collapse multi-column layouts and keep dense content readable. The strongest technical challenge was maintaining consistency across independently authored pages while handling a media-heavy archive and a large desktop-oriented pricing table. Student editor pages and captured validation reports document the team's review process, but the repository contains no automated test or continuous-integration suite.",
        },
      ],
      features:
        "The verified repository includes a timed animated splash screen with a four-second redirect; a video-led Home page with focus areas, linked climate topics, mission, donation-style support cards, and external resources; a three-tier EcoGuard comparison table; four educational pages covering natural resources, clean energy, carbon reduction, and climate education; a horizontally scrollable catalogue of volunteer programmes with expandable details; sortable volunteer reviews and an emoji-based review interface; a comprehensive feedback form with native HTML validation, file selection, scheduling, star rating, and a confirmation alert; a static environmental-activist profile with skills, goals, availability, supported UN goals, and a contact form; a keyboard-focusable team gallery; a visual sitemap; shared navigation and footer links; and scroll-to-top controls. Form submissions, search, donations, plan selection, and account data remain front-end demonstrations and are not connected to persistent services.",
      a11y:
        "The project uses language and viewport metadata, semantic headers, navigation, sections, tables and footers, descriptive alternative text on core imagery, native form controls, labelled fields on the dedicated feedback form, visible focus treatment in several page styles, and selected ARIA labels and roles in the volunteer, profile, and splash experiences. The Student 02 styles include reduced-motion and high-contrast media queries, and responsive rules reorganise grids for narrower screens. Accessibility is not uniform across every page: some search and profile form controls rely on placeholders, the video-led presentation is media-heavy, and no repository-level automated accessibility or keyboard regression suite is present. The included validation pages are useful evidence of manual review, not a substitute for a current independent WCAG audit.",
      conclusion:
        "ClimEdge demonstrates how a coordinated four-person build can turn a broad sustainability theme into a coherent, navigable web experience using only the browser platform. My contribution defined the shared shell and delivered the project's main discovery, pricing, and clean-energy journeys. Its clearest next step would be to consolidate duplicated shared markup into components, optimise the largest media assets, connect forms and plan actions to real services, and add automated responsive and accessibility testing.",
    },
] as const;

const leadProjectOrder = new Map<string, number>([
  ["bambinoo", 0],
  ["cafs", 1],
]);

const orderedProjects = [...rawProjects].sort((left, right) => {
  const leftOrder =
    leadProjectOrder.get(left.slug) ??
    leadProjectOrder.size + rawProjects.indexOf(left);
  const rightOrder =
    leadProjectOrder.get(right.slug) ??
    leadProjectOrder.size + rawProjects.indexOf(right);

  return leftOrder - rightOrder;
});

export const projectSeed: ProjectRecord[] = orderedProjects.map((project, index) => ({
  id: `seed-project-${project.slug}`,
  slug: project.slug,
  title: project.title,
  tag: project.tag,
  image: project.image,
  gallery: [...project.gallery],
  client: project.client,
  duration: project.duration,
  previewUrl: project.preview,
  templateLabel: project.templateLabel,
  templateUrl: project.templateHref,
  intro: project.intro,
  approach: project.approach,
  sections: project.sections.map((section) => ({
    heading: section.heading,
    body: section.body,
  })),
  features: project.features,
  a11yNotes: project.a11y,
  conclusion: project.conclusion,
  published: true,
  showOnHomepage: true,
  displayOrder: index,
  updatedAt: null,
}));
