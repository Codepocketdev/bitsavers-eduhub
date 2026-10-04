import Hero from '../components/Hero'
import ProgramsPreview from '../components/ProgramsPreview'
import RecentEvents from '../components/RecentEvents'
import UpcomingEvents from '../components/UpcomingEvents'
import AcademyShowcase from '../components/AcademyShowcase'
import Gallery from '../components/Gallery'
import CTASection from '../components/CTASection'

export default function Home() {
  return (
    <>
      <Hero />
      {/* Anchor for the hero's scroll arrow (href="#pillars") */}
      <div id="pillars" />
      <ProgramsPreview />
      <RecentEvents />
      <UpcomingEvents />
      <AcademyShowcase />
      <Gallery />
      <CTASection />
    </>
  )
}
