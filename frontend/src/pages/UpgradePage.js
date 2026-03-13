import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { ResponsiveLogo } from '../components/ThemeLogo';
import { Button } from '../components/ui/button';
import { Moon, Sun, ArrowLeft, Check, Crown, Building2, Rocket } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '€0',
    period: '/month',
    description: 'Perfect for individuals and small teams getting started.',
    icon: Rocket,
    iconColor: 'text-odapto-teal',
    bgColor: 'bg-odapto-teal/10',
    features: [
      'Unlimited boards',
      'Unlimited cards',
      'Up to 5 team members',
      'Basic integrations',
      '10MB file attachments',
      'Email support'
    ],
    current: true,
    buttonText: 'Current Plan',
    buttonVariant: 'outline'
  },
  {
    name: 'Business Class',
    price: '€0',
    period: '/month',
    originalPrice: '€9.99',
    description: 'For growing teams that need more power and flexibility.',
    icon: Crown,
    iconColor: 'text-odapto-orange',
    bgColor: 'bg-odapto-orange/10',
    features: [
      'Everything in Free',
      'Unlimited team members',
      'Advanced integrations',
      'Priority support',
      '250MB file attachments',
      'Custom backgrounds',
      'Activity log export',
      'Team permissions'
    ],
    popular: true,
    current: false,
    buttonText: 'Free During Beta',
    buttonVariant: 'default'
  },
  {
    name: 'Enterprise',
    price: '€0',
    period: '/month',
    originalPrice: '€29.99',
    description: 'For large organizations with advanced security needs.',
    icon: Building2,
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    features: [
      'Everything in Business',
      'SSO Authentication',
      'Advanced security',
      'Dedicated support',
      'Unlimited storage',
      'Custom branding',
      'API access',
      'SLA guarantee',
      'Onboarding assistance'
    ],
    current: false,
    buttonText: 'Free During Beta',
    buttonVariant: 'default'
  }
];

export default function UpgradePage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 hover:bg-muted rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Link to="/">
                <ResponsiveLogo className="h-8 w-auto" />
              </Link>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-odapto-orange/10 text-odapto-orange text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-odapto-orange opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-odapto-orange"></span>
            </span>
            Beta - All Plans Free!
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-3">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            During our beta period, all plans are completely free. 
            Upgrade anytime to unlock more features for your team.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative bg-card border rounded-2xl p-6 ${
                plan.popular 
                  ? 'border-odapto-orange shadow-lg shadow-odapto-orange/10' 
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold bg-odapto-orange text-white rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl ${plan.bgColor} flex items-center justify-center mb-4`}>
                <plan.icon className={`w-6 h-6 ${plan.iconColor}`} />
              </div>

              {/* Plan Name */}
              <h3 className="font-heading text-xl font-bold mb-1">{plan.name}</h3>
              
              {/* Price */}
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
                {plan.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {plan.originalPrice}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-6">
                {plan.description}
              </p>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-odapto-teal mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Button */}
              <Button
                className={`w-full ${
                  plan.current 
                    ? 'border-odapto-teal text-odapto-teal hover:bg-odapto-teal/10' 
                    : plan.popular 
                      ? 'bg-odapto-orange hover:bg-odapto-orange-hover text-white'
                      : ''
                }`}
                variant={plan.buttonVariant}
                disabled={plan.current}
              >
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            Questions about pricing? {' '}
            <Link to="/help" className="text-odapto-orange hover:underline">
              Contact our team
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
