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
    title: 'Bitcoin Education',
    description: 'We teach students, entrepreneurs, and local communities about Bitcoin — how it works, and how it creates opportunities for financial independence and global inclusion.',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop',
    link: '/programs#bitcoin-education',
  },
  {
    id: 'merchant-adoption',
    title: 'Merchant Adoption',
    description: 'We support small businesses and vendors to start accepting Bitcoin through Lightning wallets, enabling fast, low-fee payments and financial inclusion.',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
    link: '/programs#merchant-adoption',
  },
  {
    id: 'developer-training',
    title: 'Developer Training',
    description: 'Training the next generation of African Bitcoin developers through intensive bootcamps, hackathons, and open-source contributions.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop',
    link: '/programs#developer-training',
  },
]

export const team = [
  {
    name: 'Alex Mwangi',
    role: 'Co-Founding Partner',
    bio: 'Alex is committed to driving Bitcoin awareness and fostering economic inclusion. With a strong belief in financial freedom, he works tirelessly to support communities in embracing Bitcoin.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    social: { twitter: '#', linkedin: '#' },
  },
  {
    name: 'Sarah Ochieng',
    role: 'Co-Founding Partner',
    bio: 'Sarah leads curriculum development and community outreach. Her passion for education and technology drives Bitsavers EduHub\'s mission to make Bitcoin accessible to everyone.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
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
  { path: '/team', label: 'Team' },
  { path: '/faq', label: 'FAQ' },
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
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=500&fit=crop',
    attendees: 200,
    tags: ['Community', 'Workshop'],
  },
  {
    id: 'campus-caravan-2026',
    title: 'Campus Caravan — University of Nairobi',
    date: 'June 15, 2026',
    location: 'University of Nairobi',
    description: 'Our Campus Caravan tour kicked off at UoN with a packed auditorium of curious students. We covered Bitcoin basics, wallet setup, and career paths in the Bitcoin ecosystem.',
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
    image: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&h=500&fit=crop',
    attendees: 150,
    tags: ['Women', 'Empowerment'],
  },
]

export const upcomingEvents = [
  {
    id: 'campus-caravan-kenyatta',
    title: 'Campus Caravan — Kenyatta University',
    date: 'August 20, 2026',
    time: '2:00 PM - 6:00 PM',
    location: 'Kenyatta University Main Campus',
    description: 'The Campus Caravan continues! Join us for an interactive session on Bitcoin basics, Lightning Network demos, and a Q&A with industry experts.',
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&h=500&fit=crop',
    spots: 120,
    tags: ['Education', 'Campus'],
  },
  {
    id: 'she-leads-mombasa',
    title: 'She Leads Mombasa',
    date: 'September 12, 2026',
    time: '10:00 AM - 4:00 PM',
    location: 'Mombasa, Kenya',
    description: 'Expanding our She Leads initiative to the coast. A full-day workshop for women interested in Bitcoin, financial literacy, and entrepreneurship.',
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=500&fit=crop',
    spots: 80,
    tags: ['Women', 'Workshop'],
  },
  {
    id: 'bitcoin-dev-bootcamp',
    title: 'Bitcoin Developer Bootcamp',
    date: 'October 5-10, 2026',
    time: '9:00 AM - 5:00 PM Daily',
    location: 'Nairobi, Kenya',
    description: 'A 6-day intensive bootcamp for aspiring Bitcoin developers. Learn Rust, Bitcoin Core, Lightning development, and build your first open-source contribution.',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=500&fit=crop',
    spots: 40,
    tags: ['Developer', 'Bootcamp'],
  },
  {
    id: 'merchant-onboarding-drive',
    title: 'Merchant Onboarding Drive',
    date: 'November 18, 2026',
    time: '9:00 AM - 6:00 PM',
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
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1574126154517-d1e0d89e7344?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop',
    ],
  },
  {
    id: 'campus-caravan-gallery',
    title: 'Campus Caravan',
    category: 'Campus Caravan',
    images: [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&h=400&fit=crop',
    ],
  },
  {
    id: 'she-leads-gallery',
    title: 'She Leads',
    category: 'She Leads',
    images: [
      'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop',
    ],
  },
]
