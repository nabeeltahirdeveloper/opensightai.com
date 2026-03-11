export const pricesPackages = [
    {
      id: "starter",
      name: "Starter Package",
      price: 25,
      credits: 25,
      description: "Starter access to the OpenSight AI platform.",
      features: [
        "Full access to OpenSight AI",
        "Credits for AI-powered analysis",
        "Credits for chat agent usage",
        "Secure dashboard & usage tracking",
        "Credits expiry – 6 months",
        "Best for: Light usage, testing the platform, quick analysis and insights.",
      ],
      popular: false,
      color: "blue",
      type: "package",
      active: true,
      sort_order: 1,
    },
    {
      id: "growth",
      name: "Growth Package",
      price: 80,
      credits: 80,
      description: "Unlock more AI power with increased credits.",
      features: [
        "Full access to OpenSight AI",
        "Higher credit balance for analysis",
        "Extended chat agent interactions",
        "Faster workflows for ongoing projects",
        "Credits expiry – 6 months",
        "Best for: Regular users, ongoing research, frequent AI interactions.",
      ],
      popular: true,
      color: "orange",
      type: "package",
      active: true,
      sort_order: 2,
    },
    {
      id: "pro",
      name: "Pro Package",
      price: 129,
      credits: 129,
      description: "Maximum value for advanced users.",
      features: [
        "Full access to OpenSight AI",
        "High-volume credits for analysis",
        "Unlimited-style chat agent usage (credit-based)",
        "Priority performance & advanced workflows",
        "Credits expiry – 6 months",
        "Best for: Professionals, power users, complex analysis, multiple projects.",
      ],
      popular: false,
      color: "purple",
      type: "package",
      active: true,
      sort_order: 3,
    },
  ];
  
  export const pricesCustomConfig = {
    enabled: true,
    minUsd: 50,
    maxUsd: 5000,
    stepUsd: 10,
  };
  
  // Optional: static features list for the custom card (keeps Prices.jsx cleaner)
  export const pricesCustomFeatures = [
    "Full access to OpenSight AI",
    "Custom credit amount (you choose)",
    "Credits usable for analysis and chat agent",
    "Flexible scaling as your needs grow",
    "Credits expiry – 6 months",
    "Best for: Teams, enterprise users, unpredictable or high-volume usage",
  ];
  