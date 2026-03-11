// Package pricing data for the cart system
export const packages = [
  {
    id: 'starter',
    name: 'Starter',
    price: 59,
    currency: '$',
    originalPrice: 250, // Keep reference to original euro price for compatibility
    description: 'Perfect for beginners exploring market analysis',
    features: [
      'Live chart analytics (10 analyses)',
      'AI agent teacher (basic access)',
      'Education center access',
      'Email support (48-hour response)',
      'Standard analysis tools and features',
      'Basic market research insights',
      'Mobile app access',
      'Analysis history (30 days)',
      'Export to PDF'
    ],
    popular: false,
    color: 'blue'
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 129,
    currency: '$',
    originalPrice: 500,
    description: 'Most popular choice for serious traders',
    features: [
      'Live chart analytics (50 analyses)',
      'AI agent teacher (advanced features)',
      'Full education center access',
      'Email support (24-hour response)',
      'Advanced analysis tools and features',
      'Comprehensive market research insights',
      'Mobile app access',
      'Analysis history (6 months)',
      'Export to Excel/PDF',
      'Multiple data watchlists',
      'Advanced assessment suite',
      'Pattern recognition tools',
      'Custom analysis templates'
    ],
    popular: true,
    color: 'orange'
  },
  {
    id: 'expert',
    name: 'Expert',
    price: 189,
    currency: '$',
    originalPrice: 750,
    description: 'Full access to all premium features',
    features: [
      'Live chart analytics (unlimited analyses)',
      'AI agent teacher (premium features)',
      'Full education center with premium content',
      'Priority email support (immediate response)',
      'Professional-grade analysis tools',
      'Premium market research insights',
      'Mobile and desktop app access',
      'Analysis history (unlimited)',
      'Export to Excel/PDF/CSV',
      'Multiple data watchlists (unlimited)',
      'Advanced assessment suite',
      'Pattern recognition tools',
      'Custom analysis templates',
      'API access for integrations',
      'White-label options',
      'Priority feature requests',
      'Advanced market indicators',
      'Real-time data feeds',
      'Portfolio tracking tools'
    ],
    popular: false,
    color: 'purple'
  }
];

// Credit packages that must be added when purchasing main packages
export const creditPackages = [
  {
    id: 'credits-50',
    name: 'Starter',
    price: 50,
    currency: '$',
    credits: 50,
    description: 'Perfect for getting started',
    features: [
      '50 chart analyses',
      'Basic AI insights',
      'Email support',
      '30-day validity'
    ],
    popular: false
  },
  {
    id: 'credits-70',
    name: 'Basic',
    price: 70,
    currency: '$',
    credits: 70,
    description: 'Great for regular users',
    features: [
      '70 chart analyses',
      'Enhanced AI insights',
      'Priority support',
      '45-day validity'
    ],
    popular: false
  },
  {
    id: 'credits-100',
    name: 'Standard',
    price: 100,
    currency: '$',
    credits: 100,
    description: 'Most popular choice',
    features: [
      '100 chart analyses',
      'Advanced AI features',
      'Live chat support',
      '60-day validity'
    ],
    popular: true
  },
  {
    id: 'credits-150',
    name: 'Popular',
    price: 150,
    currency: '$',
    credits: 150,
    description: 'Best value for money',
    features: [
      '150 chart analyses',
      'Premium AI insights',
      'Priority support',
      '90-day validity'
    ],
    popular: false
  },
  {
    id: 'credits-250',
    name: 'Professional',
    price: 250,
    currency: '$',
    credits: 250,
    description: 'For serious analysts',
    features: [
      '250 chart analyses',
      'Professional features',
      'Dedicated support',
      '120-day validity'
    ],
    popular: false
  },
  {
    id: 'credits-500',
    name: 'Business',
    price: 500,
    currency: '$',
    credits: 500,
    description: 'Perfect for teams',
    features: [
      '500 chart analyses',
      'Business features',
      'Account manager',
      '180-day validity'
    ],
    popular: false
  },
  {
    id: 'credits-1000',
    name: 'Enterprise',
    price: 1000,
    currency: '$',
    credits: 1000,
    description: 'For large organizations',
    features: [
      '1000 chart analyses',
      'Enterprise features',
      '24/7 support',
      '365-day validity'
    ],
    popular: false
  },
  {
    id: 'credits-unlimited',
    name: 'Unlimited',
    price: 1500,
    currency: '$',
    credits: 'unlimited',
    description: 'No limits, endless analysis',
    features: [
      'Unlimited analyses',
      'All premium features',
      'White-glove support',
      'Lifetime access'
    ],
    popular: false,
    unlimited: true
  }
];

export const getPackageById = (id) => {
  return packages.find(pkg => pkg.id === id);
};

export const getCreditPackageById = (id) => {
  return creditPackages.find(pkg => pkg.id === id);
};

