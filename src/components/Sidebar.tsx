import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { auth } from '../lib/firebase.ts';
import { 
  LayoutDashboard, Building2, Zap, BadgeCheck, SquarePen, Star, Images, 
  Sparkles, ImagePlus, MapPin, Search as SearchIcon, UsersRound, 
  ChartNoAxesCombined, CreditCard, Gauge, Bell, Settings, LogOut,
  ChevronDown, ChevronRight, Search, X, QrCode, Activity,
  Globe, MessageSquare, Target, Share2, MessageCircle
} from 'lucide-react';

interface MenuItem {
  title: string;
  path: string;
  icon: React.ElementType;
}

interface MenuGroup {
  id: string;
  title: string;
  items: MenuItem[];
}

const SIDEBAR_GROUPS: MenuGroup[] = [
  {
    id: 'account',
    title: 'ACCOUNT',
    items: [
      { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { title: 'Manage Plan', path: '/manage-plan', icon: CreditCard },
    ]
  },
  {
    id: 'google',
    title: 'GOOGLE',
    items: [
      { title: 'Google My Business', path: '/google-business', icon: Building2 },
      { title: 'Print Review QR', path: '/google-business?qr=true', icon: QrCode },
      { title: 'One-Click Optimization', path: '/one-click-optimization', icon: Zap },
      { title: 'Google Audit', path: '/google-audit', icon: BadgeCheck },
      { title: 'Google Posts', path: '/google-posts', icon: SquarePen },
      { title: 'Reviews', path: '/reviews', icon: Star },
      { title: 'Reply Templates', path: '/reply-templates', icon: MessageSquare },
      { title: 'Photos & Videos', path: '/media', icon: Images },
    ]
  },
  {
    id: 'content',
    title: 'CONTENT & AI',
    items: [
      { title: 'AI Mode', path: '/ai-mode', icon: Sparkles },
      { title: 'AI Generated Media', path: '/ai-media', icon: ImagePlus },
      { title: 'Active Programs', path: '/campaigns', icon: Target },
      { title: 'Social Channels', path: '/social-config', icon: Share2 },
      { title: 'WhatsApp Integration', path: '/whatsapp', icon: MessageCircle },
    ]
  },
  {
    id: 'insights',
    title: 'INSIGHTS',
    items: [
      { title: 'Local Rank Checker', path: '/local-rank', icon: MapPin },
      { title: 'Keyword Suggestion', path: '/keywords', icon: SearchIcon },
      { title: 'Competitor Analysis', path: '/competitors', icon: UsersRound },
      { title: 'Citation Manager', path: '/citations', icon: Globe },
      { title: 'Performance Reports', path: '/reports', icon: ChartNoAxesCombined },
    ]
  },
  {
    id: 'billing',
    title: 'BILLING',
    items: [
      { title: 'Plans & Billing', path: '/billing', icon: CreditCard },
      { title: 'Usage & Credits', path: '/usage', icon: Gauge },
    ]
  },
  {
    id: 'system',
    title: 'SYSTEM',
    items: [
      { title: 'System Diagnostics', path: '/diagnostics', icon: Activity },
      { title: 'Notifications', path: '/notifications', icon: Bell },
      { title: 'Settings', path: '/settings', icon: Settings },
    ]
  }
];

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar_collapsed_groups');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed_groups', JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const collapseAll = () => {
    const allCollapsed = SIDEBAR_GROUPS.reduce((acc, group) => {
      acc[group.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setCollapsedGroups(allCollapsed);
  };

  const expandAll = () => {
    setCollapsedGroups({});
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const closeMobile = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const filteredGroups = SIDEBAR_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          onClick={closeMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 w-[280px] bg-sidebar border-r border-border flex flex-col z-50 transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="font-bold text-white">D</span>
              </div>
              <span className="font-bold text-lg tracking-tight">Local Ranker</span>
            </div>
            {mobileOpen && (
              <button 
                onClick={closeMobile} 
                className="lg:hidden text-muted hover:text-white p-1 rounded-lg hover:bg-card"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text"
              placeholder="Search menu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card/50 border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-muted tracking-widest px-2">
            <span>NAVIGATION</span>
            <button 
              onClick={Object.keys(collapsedGroups).length === SIDEBAR_GROUPS.length ? expandAll : collapseAll}
              className="hover:text-primary transition-colors uppercase"
            >
              {Object.keys(collapsedGroups).length === SIDEBAR_GROUPS.length ? 'Expand All' : 'Collapse All'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-2">
          {filteredGroups.map(group => (
            <div key={group.id} className="space-y-1">
              <button 
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold text-muted tracking-widest hover:text-white transition-colors group"
              >
                <span>{group.title}</span>
                {collapsedGroups[group.id] ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              
              {!collapsedGroups[group.id] && (
                <div className="space-y-1">
                  {group.items.map(item => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={closeMobile}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group
                        ${isActive 
                          ? 'bg-[#1E1B4B] text-primary shadow-lg shadow-primary/5' 
                          : 'text-muted hover:bg-card hover:text-white'}
                      `}
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                            ${isActive ? 'bg-primary text-white' : 'bg-card-nested text-muted group-hover:text-white'}
                          `}>
                            <item.icon className="w-4 h-4" />
                          </div>
                          <span>{item.title}</span>
                          {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 mt-auto border-t border-border">
          <div className="bg-card rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-white">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-muted hover:text-danger transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

