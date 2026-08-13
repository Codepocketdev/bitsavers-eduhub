import Hero from '../components/Hero'
import Pillars from '../components/Pillars'
import ProgramsPreview from '../components/ProgramsPreview'
import RecentEvents from '../components/RecentEvents'
import UpcomingEvents from '../components/UpcomingEvents'
import Gallery from '../components/Gallery'
import CTASection from '../components/CTASection'

export default function Home() {
  return (
    <>
      <Hero />
      <Pillars />
      <ProgramsPreview />
      <RecentEvents />
      <UpcomingEvents />
      <Gallery />
      <CTASection />
    </>
  )
}
