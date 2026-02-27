import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { 
  LayoutGrid, 
  Users, 
  Zap, 
  Shield, 
  Moon, 
  Sun, 
  ArrowRight,
  CheckCircle,
  Layers,
  Clock
} from 'lucide-react';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_27d48b6b-dd80-4045-b25e-4aeef47ff911/artifacts/8ilbqloe_download.png";
const HERO_IMAGE = "https://images.unsplash.com/photo-1758691736975-9f7f643d178e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjB0ZWFtJTIwY29sbGFib3JhdGlvbiUyMGRpdmVyc2V8ZW58MHx8fHwxNzcyMTk5MDAxfDA&ixlib=rb-4.1.0&q=85&w=800";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const features = [
    {
      icon: LayoutGrid,
      title: "Kanban Boards",
      description: "Visualize your workflow with intuitive drag-and-drop boards"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Work together in real-time with instant updates"
    },
    {
      icon: Layers,
      title: "Template Library",
      description: "Start fast with pre-built templates for any project"
    },
    {
      icon: Shield,
      title: "Role-Based Access",
      description: "Control who can view and edit with granular permissions"
    },
    {
      icon: Zap,
      title: "Real-Time Sync",
      description: "Changes appear instantly across all devices"
    },
    {
      icon: Clock,
      title: "Due Dates & Reminders",
      description: "Never miss a deadline with smart notifications"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src={LOGO_URL} alt="Odapto" className="h-8 w-auto" />
            </Link>
            
            <div className="flex items-center gap-4">
              <Link to="/templates" className="text-muted-foreground hover:text-foreground transition-colors">
                Templates
              </Link>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button className="bg-odapto-orange hover:bg-odapto-orange-hover text-white" data-testid="go-to-dashboard-btn">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login">
                    <Button variant="ghost" data-testid="login-btn">Log in</Button>
                  </Link>
                  <Link to="/register">
                    <Button className="bg-odapto-orange hover:bg-odapto-orange-hover text-white" data-testid="get-started-btn">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="initial"
              animate="animate"
              variants={staggerContainer}
              className="space-y-6"
            >
              <motion.div variants={fadeInUp}>
                <span className="inline-block px-4 py-1.5 rounded-full bg-odapto-teal/10 text-odapto-teal text-sm font-medium">
                  Work Management Reimagined
                </span>
              </motion.div>
              
              <motion.h1 
                variants={fadeInUp}
                className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight"
              >
                Organize work,{' '}
                <span className="text-odapto-orange">
                  amplify results
                </span>
              </motion.h1>
              
              <motion.p 
                variants={fadeInUp}
                className="text-lg text-muted-foreground max-w-xl"
              >
                Odapto brings clarity to chaos. Manage projects with powerful Kanban boards, 
                collaborate in real-time, and leverage templates to get started instantly.
              </motion.p>
              
              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
                <Link to={isAuthenticated ? "/dashboard" : "/register"}>
                  <Button 
                    size="lg" 
                    className="bg-odapto-orange hover:bg-odapto-orange-hover text-white rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-shadow"
                    data-testid="hero-cta-btn"
                  >
                    Start Free <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/templates">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="rounded-full px-8 py-6 text-lg border-2"
                    data-testid="browse-templates-btn"
                  >
                    Browse Templates
                  </Button>
                </Link>
              </motion.div>

              <motion.div variants={fadeInUp} className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-odapto-teal" />
                  <span className="text-sm text-muted-foreground">Free forever plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-odapto-teal" />
                  <span className="text-sm text-muted-foreground">No credit card needed</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={HERO_IMAGE} 
                  alt="Team collaboration" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>
              
              {/* Floating card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute -bottom-6 -left-6 bg-card rounded-xl shadow-xl p-4 border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-odapto-teal/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-odapto-teal" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Real-time updates</p>
                    <p className="text-xs text-muted-foreground">Changes sync instantly</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to{' '}
              <span className="text-odapto-orange">ship faster</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Powerful features designed to help teams of all sizes organize, 
              track, and manage work efficiently.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-6 bg-card rounded-xl border border-border hover:border-odapto-orange/50 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-odapto-orange/10 flex items-center justify-center mb-4 group-hover:bg-odapto-orange/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-odapto-orange" />
                </div>
                <h3 className="font-heading text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-odapto-orange/10 to-odapto-teal/10 rounded-3xl p-12 border border-border"
          >
            <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
              Ready to transform your workflow?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join thousands of teams already using Odapto to manage their projects 
              more effectively.
            </p>
            <Link to={isAuthenticated ? "/dashboard" : "/register"}>
              <Button 
                size="lg" 
                className="bg-odapto-orange hover:bg-odapto-orange-hover text-white rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-shadow"
                data-testid="cta-get-started-btn"
              >
                Get Started for Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={LOGO_URL} alt="Odapto" className="h-6 w-auto" />
            <span className="text-sm text-muted-foreground">
              2024 Odapto. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/templates" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Templates
            </Link>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
