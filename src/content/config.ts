import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    title_ko: z.string().optional(),
    description: z.string(),
    description_ko: z.string().optional(),
    image: z.string().optional(),
    category: z.string(),
    subcategory: z.string().optional(),
    tags: z.array(z.string()).optional(),
    date: z.string(),
    author: z.string().optional(),
    series: z.object({
      name: z.string(),
      order: z.number(),
    }).optional(),
    color: z.string().optional(),
  }),
});

const workCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    title_ko: z.string().optional(),
    description: z.string(),
    description_ko: z.string().optional(),
    image: z.string().optional(),
    category: z.string(),
    subcategory: z.string().optional(),
    tags: z.array(z.string()).optional(),
    date: z.string().optional(),
    color: z.string().optional(),
  }),
});

const researchCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    title_ko: z.string().optional(),
    description: z.string(),
    description_ko: z.string().optional(),
    image: z.string().optional(),
    category: z.string(),
    subcategory: z.string().optional(),
    tags: z.array(z.string()).optional(),
    date: z.string().optional(),
    color: z.string().optional(),
  }),
});

export const collections = {
  'blog': blogCollection,
  'work': workCollection,
  'research': researchCollection,
};
