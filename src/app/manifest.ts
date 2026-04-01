import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Perricheno',
    short_name: 'Perricheno',
    description: 'Student. Analyst. DevOps Engineer.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/newlogo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/newlogo.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/newlogo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
