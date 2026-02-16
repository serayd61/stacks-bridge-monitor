'use client';

import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Activity, 
  Users,
  TrendingUp,
  TrendingDown 
} from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  iconName: 'arrow-down-left' | 'arrow-up-right' | 'activity' | 'users';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'purple' | 'orange' | 'green' | 'blue';
}

const iconMap = {
  'arrow-down-left': ArrowDownLeft,
  'arrow-up-right': ArrowUpRight,
  'activity': Activity,
  'users': Users,
};

export default function StatsCard({
  title,
  value,
  subtitle,
  iconName,
  trend,
  color = 'purple',
}: StatsCardProps) {
  const Icon = iconMap[iconName];
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
    orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30',
    green: 'from-green-500/20 to-green-600/5 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  };

  const iconColors = {
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border bg-gradient-to-br p-6
        ${colorClasses[color]}
        transition-all duration-300 hover:scale-[1.02] hover:shadow-lg
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-500">vs last period</span>
            </div>
          )}
        </div>
        <div
          className={`
            rounded-lg bg-black/30 p-3
            ${iconColors[color]}
          `}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
      
      {/* Decorative gradient */}
      <div
        className={`
          absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl
          ${color === 'purple' ? 'bg-purple-500' : ''}
          ${color === 'orange' ? 'bg-orange-500' : ''}
          ${color === 'green' ? 'bg-green-500' : ''}
          ${color === 'blue' ? 'bg-blue-500' : ''}
        `}
      />
    </div>
  );
}
