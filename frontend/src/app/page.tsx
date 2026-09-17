import { About } from "@/components/home/About";
import { Contact } from "@/components/layout/Contact";
import { CreativeServicesShowcase } from "@/components/home/CreativeServicesShowcase";
import { GetInTouch } from "@/components/home/GetInTouch";
import { Hero } from "@/components/home/Hero";
import { Projects } from "@/components/home/Projects";
import { Services } from "@/components/home/Services";
import { Stack } from "@/components/home/Stack";
import { StatisticsBar } from "@/components/home/StatisticsBar";
import { TopNav } from "@/components/layout/TopNav";
import { LavaBackground } from "@/components/effects/LavaBackground";
import { getHomepageProjects, getPublicStack } from "@/lib/data/public";

export default async function Home() {
  const [technologies, projectItems] = await Promise.all([
    getPublicStack(),
    getHomepageProjects(),
  ]);

  return (
    <div className="relative isolate min-h-svh bg-black">
      <LavaBackground blueStartId="services" blueEndId="projects" />
      <TopNav />
      <main className="relative z-10">
        <div className="relative">
          <Hero />
          <About />
        </div>
        <CreativeServicesShowcase />
        <StatisticsBar />
        <Stack technologies={technologies} />
        <Services />
        <Projects items={projectItems} />
        <GetInTouch />
        <Contact />
      </main>
    </div>
  );
}
