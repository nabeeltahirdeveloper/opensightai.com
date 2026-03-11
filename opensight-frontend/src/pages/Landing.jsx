import React from 'react'
import LandingStyles from '@/components/landing/LandingStyles.jsx'
import Navbar from '@/components/landing/Navbar.jsx'
import Hero from '@/components/landing/Hero.jsx'
import Features from '@/components/landing/Features.jsx'
import HowItWorks from '@/components/landing/HowItWorks.jsx'
import Testimonials from '@/components/landing/Testimonials.jsx'
import About from '@/components/landing/About.jsx'
import FAQ from '@/components/landing/FAQ.jsx'
import Contact from '@/components/landing/Contact.jsx'
import Footer from '@/components/landing/Footer.jsx'
import Modals from '@/components/landing/Modals.jsx'
import Notification from '@/components/landing/Notification.jsx'
import ChatWidget from '@/components/landing/ChatWidget.jsx'
import LandingScripts from '@/components/landing/LandingScripts.jsx'
import WhyChooseUs from '@/components/landing/WhyChooseUs.jsx'
import PricingSection from './prices.jsx'
export default function Landing() {
  return (
    <div className="bg-white overflow-x-hidden">
      <LandingStyles />
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <About />
      <PricingSection />
      <Testimonials />
      <WhyChooseUs/>
      <FAQ />
      <Contact />
      <Footer />
      <Modals />
      <Notification />
      <ChatWidget />
      <LandingScripts />
    </div>
  )
}


