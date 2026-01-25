'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  Activity,
  BarChart3,
  Calendar,
  DollarSign,
  Home,
  LineChart,
  LogOut,
  Settings,
  TrendingUp,
  User,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/games', label: 'Games', icon: Calendar },
  { href: '/predictions', label: 'Model', icon: TrendingUp },
  { href: '/odds', label: 'Odds', icon: DollarSign },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/props', label: 'Props', icon: Activity },
  { href: '/my-bets', label: 'My Bets', icon: LineChart },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/75">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">NBA Predict</span>
          </Link>

          {/* Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {session?.user ? (
              <div className="flex items-center space-x-3">
                <Link
                  href="/settings"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </Link>
                <div className="flex items-center space-x-2">
                  <Avatar
                    src={session.user.image}
                    fallback={session.user.name || session.user.email || 'U'}
                    size="sm"
                  />
                  <button
                    onClick={() => signOut()}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="border-t border-slate-800 md:hidden">
        <div className="flex overflow-x-auto px-2 py-2 space-x-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5 mb-1" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
