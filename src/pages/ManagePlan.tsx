import React from 'react';
import { Check, Zap, Shield, Crown } from 'lucide-react';
import ConfigurationRequired from '../components/ConfigurationRequired.tsx';

export default function ManagePlan() {
  const plans = [
    {
      name: 'Starter',
      price: '0',
      icon: Zap,
      features: ['1 Business Location', 'Basic Review Sync', 'Weekly Reports', '5 AI Credits/mo'],
      current: false,
      color: 'text-blue'
    },
    {
      name: 'Professional',
      price: '49',
      icon: Shield,
      features: ['10 Business Locations', 'AI Review Automation', 'Keyword Rank Tracking', '100 AI Credits/mo', 'WhatsApp Alerts'],
      current: true,
      color: 'text-primary'
    },
    {
      name: 'Enterprise',
      price: '199',
      icon: Crown,
      features: ['Unlimited Locations', 'Custom AI Training', 'API Access', '1000 AI Credits/mo', 'Dedicated Support'],
      current: false,
      color: 'text-accent'
    }
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black tracking-tight text-white">Choose the right plan for your growth</h1>
        <p className="text-muted max-w-2xl mx-auto">Scalable solutions for local businesses of all sizes. Upgrade or downgrade anytime.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div key={plan.name} className={`bg-card rounded-[2.5rem] p-10 border border-border relative flex flex-col ${plan.current ? 'ring-2 ring-primary border-primary/50 shadow-2xl shadow-primary/10' : ''}`}>
            {plan.current && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                Current Plan
              </div>
            )}
            
            <div className="mb-8">
              <div className={`w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center mb-6 ${plan.color}`}>
                <plan.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">${plan.price}</span>
                <span className="text-muted text-sm font-bold">/mo</span>
              </div>
            </div>

            <div className="space-y-4 mb-10 flex-1">
              {plan.features.map((feat) => (
                <div key={feat} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                  <Check className="w-4 h-4 text-green shrink-0" />
                  {feat}
                </div>
              ))}
            </div>

            <button className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${plan.current ? 'bg-card-nested border border-border text-muted cursor-default' : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 hover:translate-y-[-2px]'}`}>
              {plan.current ? 'Already Active' : `Select ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-[3rem] p-12 border border-border flex flex-col md:flex-row items-center justify-between gap-8">
         <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-bold text-white">Need a custom solution?</h3>
            <p className="text-muted">Contact our sales team for personalized enterprise packages and multi-brand accounts.</p>
         </div>
         <button className="bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Contact Sales</button>
      </div>
    </div>
  );
}
