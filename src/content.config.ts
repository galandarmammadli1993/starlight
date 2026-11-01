import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// Keep the original starter articles as reference without adding game routes.
export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  }),
};
