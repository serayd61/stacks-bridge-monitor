'use client';

import { Image } from 'lucide-react';

interface Collection {
  name: string;
  floorPrice: string;
  volume24h: string;
  items: number;
}

interface NFTCollectionsProps {
  collections: Collection[];
}

export default function NFTCollections({ collections }: NFTCollectionsProps) {
  const colors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-orange-500 to-yellow-500',
    'from-green-500 to-emerald-500',
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">NFT Collections</h3>
          <p className="text-sm text-gray-400">Trending on Stacks</p>
        </div>
        <Image className="h-5 w-5 text-gray-400" />
      </div>

      <div className="space-y-3">
        {collections.map((collection, index) => (
          <div
            key={collection.name}
            className="flex items-center justify-between rounded-lg bg-gray-800/50 p-4 transition-all hover:bg-gray-800 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center`}>
                <span className="text-white font-bold text-sm">
                  {collection.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="font-medium text-white">{collection.name}</p>
                <p className="text-xs text-gray-400">{collection.items.toLocaleString()} items</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="font-medium text-white">{collection.floorPrice}</p>
              <p className="text-xs text-gray-400">Vol: {collection.volume24h}</p>
            </div>
          </div>
        ))}
      </div>
      
      <a
        href="https://gamma.io"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block text-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
      >
        Explore on Gamma →
      </a>
    </div>
  );
}
