'use client';

import { 
  ExternalLink, 
  BookOpen, 
  Compass, 
  Wallet, 
  Code, 
  MessageCircle,
  Twitter,
  Github
} from 'lucide-react';

export default function QuickLinks() {
  const links = [
    {
      title: 'Stacks Explorer',
      description: 'View transactions & blocks',
      url: 'https://explorer.hiro.so',
      icon: Compass,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Documentation',
      description: 'Learn to build on Stacks',
      url: 'https://docs.stacks.co',
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Leather Wallet',
      description: 'Official Stacks wallet',
      url: 'https://leather.io',
      icon: Wallet,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Clarity Playground',
      description: 'Write smart contracts',
      url: 'https://play.clarity.tools',
      icon: Code,
      color: 'from-green-500 to-green-600',
    },
  ];

  const socials = [
    { name: 'Twitter', url: 'https://twitter.com/Stacks', icon: Twitter },
    { name: 'Discord', url: 'https://discord.gg/stacks', icon: MessageCircle },
    { name: 'GitHub', url: 'https://github.com/stacks-network', icon: Github },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
      
      <div className="grid grid-cols-2 gap-3 mb-6">
        {links.map((link) => (
          <a
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-lg bg-gray-800/50 p-3 transition-all hover:bg-gray-800"
          >
            <div className={`rounded-lg bg-gradient-to-br ${link.color} p-2`}>
              <link.icon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="font-medium text-white text-sm truncate">{link.title}</p>
                <ExternalLink className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-400 truncate">{link.description}</p>
            </div>
          </a>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-500 mb-3">Community</p>
        <div className="flex gap-2">
          {socials.map((social) => (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-10 w-10 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title={social.name}
            >
              <social.icon className="h-5 w-5" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
