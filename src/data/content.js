import { GraduationCap, Store } from 'lucide-react'
export const stats = [
  { value: 500, suffix: '+', label: 'Students Trained' },
  { value: 50, suffix: '+', label: 'Workshops Held' },
  { value: 12, suffix: '', label: 'Partner Schools' },
]

export const pillars = [
  {
    icon: 'GraduationCap',
    title: 'Education First',
    description: 'From students to professionals, we equip people with the knowledge to understand, use, and build with Bitcoin.',
  },
  {
    icon: 'Handshake',
    title: 'Community Adoption',
    description: 'Partnering with local businesses, schools, and organizations to drive real-world Bitcoin adoption.',
  },
  {
    icon: 'Rocket',
    title: 'Building Futures',
    description: 'Creating pathways for young Africans to build careers in the Bitcoin and open-source ecosystem.',
  },
]

export const programs = [
  {
    id: 'bitcoin-education',
    icon: GraduationCap,
    title: 'Bitcoin Education',
    description: 'We teach students, entrepreneurs, and local communities about Bitcoin — how it works, and how it creates opportunities for financial independence and global inclusion.',
    image: '/images/programs/bitcoin-education.jpg',
    link: '/programs#bitcoin-education',
    features: ['Beginner to Advanced', 'Hands-on Workshops', 'Certification'],
  },
  {
    id: 'merchant-adoption',
    icon: Store,
    title: 'Merchant Adoption',
    description: 'We support small businesses and vendors to start accepting Bitcoin through Lightning wallets, enabling fast, low-fee payments and financial inclusion.',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
    video: 'https://files.catbox.moe/9wf2th.mp4',
    link: '/programs#merchant-adoption',
    features: ['Lightning Setup', 'POS Integration', 'Ongoing Support'],
  },
]

export const team = [
  {
    name: 'Linda Wambui',
    role: 'Founder',
    bio: 'Linda founded Bitsavers EduHub with a vision to make Bitcoin education accessible across Africa. She leads the organization\'s strategy and community partnerships, driving its mission of financial inclusion through open, permissionless technology.',
    image: 'https://files.catbox.moe/4eu1t5.jpg',
    social: { twitter: '#', linkedin: '#' },
  },
  {
    name: 'Doris Olele',
    role: 'Academic Head',
    bio: 'Doris oversees Bitsavers EduHub\'s curriculum and academic programs, ensuring every course is practical, accurate, and accessible to learners at every level.',
    image: '/images/team/doris.jpg',
    social: { twitter: '#', linkedin: '#' },
  },
  {
    name: 'Stacy Kweto',
    role: 'Program Manager',
    bio: 'Stacy coordinates Bitsavers EduHub\'s events and community programs, keeping workshops, campus tours, and outreach initiatives running smoothly from planning to execution.',
    image: '/images/team/stacy.jpg',
    social: { twitter: '#', linkedin: '#' },
  },
  {
    name: 'Venadate Kerubo',
    role: 'Social Media Manager',
    bio: 'Venadate manages Bitsavers EduHub\'s online presence, sharing the organization\'s work and Bitcoin education content with communities across social media.',
    image: '/images/team/venadate.jpg',
    social: { twitter: '#', linkedin: '#' },
  },
  {
    name: 'Brain Ndege',
    role: 'Graphics Designer',
    bio: 'Brain brings Bitsavers EduHub\'s visual identity to life, designing graphics, event materials, and brand assets that reflect the organization\'s mission and energy.',
    image: '',
    social: { twitter: '#', linkedin: '#' },
  },
  {
    name: 'Martin Tubula',
    role: 'Developer',
    bio: 'Martin builds and maintains Bitsavers EduHub\'s digital platforms, combining a background in Bitcoin and open-source development to support the organization\'s education and outreach efforts.',
    image: '',
    social: { twitter: '#', linkedin: '#' },
  },
]

export const faqs = [
  {
    question: 'What is Bitcoin?',
    answer: 'Bitcoin is a decentralized digital currency that operates without a central authority, relying on blockchain technology to enable secure peer-to-peer transactions.',
  },
  {
    question: 'What is Bitsavers EduHub?',
    answer: 'Bitsavers EduHub is an initiative designed to promote Bitcoin education, adoption, and networking within local communities across Africa.',
  },
  {
    question: 'How can I participate?',
    answer: 'You can participate by joining our community events, taking the "Bitcoin Basics" course at local meetups, or engaging in our educational workshops.',
  },
  {
    question: 'Why should I learn about Bitcoin?',
    answer: 'Bitcoin offers financial autonomy, secure and fast transactions, and the potential to empower local economies through decentralized financial solutions.',
  },
  {
    question: 'How do I store Bitcoin securely?',
    answer: 'You can store Bitcoin securely using a hardware wallet, software wallet, or a paper wallet. Always enable two-factor authentication and keep your private keys safe.',
  },
  {
    question: 'Can I use Bitcoin for everyday transactions?',
    answer: 'Yes! Many businesses now accept Bitcoin for payments, and you can also use it for peer-to-peer transactions or online purchases via the Lightning Network.',
  },
]

export const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/programs', label: 'Programs' },
  { path: '/events', label: 'Events' },
  { path: '/team', label: 'Team' },
  { path: '/faq', label: 'FAQ' },
  { path: '/sponsors', label: 'Sponsors' },
  { path: '/donate', label: 'Donate' },
  { path: '/contact', label: 'Join Us' },
]

// ========== EVENTS DATA ==========

export const recentEvents = [
  {
    id: 'bitcoin-pizza-day-2026',
    title: 'Bitcoin Pizza Day 2026',
    date: 'May 22, 2026',
    location: 'Nairobi, Kenya',
    description: 'Celebrated the 16th anniversary of the first Bitcoin transaction with pizza, games, and a live Lightning workshop. Over 200 attendees joined us for an evening of fun and learning.',
    image: '/images/gallery/pizza-day.jpg',
    attendees: 200,
    tags: ['Community', 'Workshop'],
  },
  {
    id: 'campus-caravan-2026',
    title: 'Campus Caravan',
    video: 'https://files.catbox.moe/87zuyk.mp4',
    date: '',
    location: 'Universities across Kenya',
    description: 'Our Campus Caravan tour has brought Bitcoin basics, wallet setup, and career conversations to packed auditoriums at universities across Kenya — sparking curiosity and equipping students with practical, real-world skills.',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop',
    attendees: 350,
    tags: ['Education', 'Campus'],
  },
  {
    id: 'she-leads-nairobi',
    title: 'She Leads Nairobi — Women in Bitcoin',
    date: 'July 8, 2026',
    location: 'Nairobi, Kenya',
    description: 'An empowering session focused on women in Bitcoin. We hosted panel discussions, mentorship circles, and hands-on wallet training for 150+ women from diverse backgrounds.',
    image: '/images/gallery/she-leads-event.jpg',
    attendees: 150,
    tags: ['Women', 'Empowerment'],
  },
]

// calendar.dates = YYYY-MM-DD (Nairobi time), start/end = HH:MM (24h).
// Leave end out if unconfirmed; the calendar file defaults to 4 hours.
export const upcomingEvents = [
  {
    id: 'campus-caravan-kenyatta',
    title: 'Campus Caravan — Kenyatta University',
    date: 'October 16, 17 & 24, 2026',
    time: '10:00 AM - 2:00 PM',
    calendar: { dates: ['2026-10-16', '2026-10-17', '2026-10-24'], start: '10:00', end: '14:00' },
    location: 'Kenyatta University Main Campus',
    description: 'The Campus Caravan continues! Join us for an interactive session on Bitcoin basics, Lightning Network demos, and a Q&A with industry experts.',
    image: '/images/events/ku-caravan-poster.jpg',
    registerUrl: 'https://bit.ly/4iUIuwi',
    spots: 120,
    tags: ['Education', 'Campus'],
  },
  {
    id: 'she-leads-mombasa',
    title: 'She Leads Mombasa',
    date: 'Date to be confirmed',
    time: '10:00 AM - 4:00 PM',
    location: 'Mombasa, Kenya',
    description: 'Expanding our She Leads initiative to the coast. A full-day workshop for women interested in Bitcoin, financial literacy, and entrepreneurship.',
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=500&fit=crop',
    spots: 80,
    tags: ['Women', 'Workshop'],
  },
  {
    id: 'merchant-onboarding-drive',
    title: 'Merchant Onboarding Drive',
    date: 'November 18, 2026',
    time: '9:00 AM - 6:00 PM',
    calendar: { dates: ['2026-11-18'], start: '09:00', end: '18:00' },
    location: 'Nairobi CBD',
    description: 'Join our team as we walk the streets of Nairobi, onboarding local merchants to accept Bitcoin via Lightning. Training, POS setup, and support provided on-site.',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=500&fit=crop',
    spots: 25,
    tags: ['Adoption', 'Community'],
  },
]

export const galleryEvents = [
  {
    id: 'bitcoin-pizza-day-gallery',
    title: 'Bitcoin Pizza Day',
    category: 'Bitcoin Pizza Day',
    images: [
      '/images/gallery/pizza-day.jpg',
      '/images/gallery/pizza-day-2.jpg',
    ],
  },
  {
    id: 'she-leads-gallery',
    title: 'She Leads',
    category: 'She Leads',
    images: [
      '/images/gallery/she-leads-event.jpg',
      '/images/gallery/she-leads-banner.jpg',
      '/images/gallery/she-leads-red-curtain.jpg',
    ],
  },
  {
    id: 'community-gallery',
    title: 'Bitsavers Community',
    category: 'Community',
    images: [
      '/images/gallery/she-leads-group.jpg',
      '/images/gallery/frame-duo.jpg',
      '/images/gallery/community-mic.jpg',
      '/images/gallery/community-graduation.jpg',
      '/images/gallery/community-blink.jpg',
    ],
  },
]
