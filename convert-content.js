import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read JSON metadata
const blogPosts = JSON.parse(fs.readFileSync('../dawonx-site/content/blog/posts.json', 'utf8'));
const workPosts = JSON.parse(fs.readFileSync('../dawonx-site/content/work/posts.json', 'utf8'));
const researchPosts = JSON.parse(fs.readFileSync('../dawonx-site/content/research/posts.json', 'utf8'));

function slugify(path) {
  return path.split('/').filter(Boolean).pop();
}

function convertMarkdownWithFrontmatter(collection, posts, sourceDir, targetDir) {
  posts.forEach(post => {
    const slug = slugify(post.path);
    const mdFile = `${slug}.md`;
    const koMdFile = `${slug}.ko.md`;

    const sourceMd = path.join(sourceDir, mdFile);
    const sourceKoMd = path.join(sourceDir, koMdFile);
    const targetMd = path.join(targetDir, mdFile);
    const targetKoMd = path.join(targetDir, koMdFile);

    // Create frontmatter
    const frontmatter = `---
title: "${post.title}"
${post.title_ko ? `title_ko: "${post.title_ko}"` : ''}
description: "${post.description}"
${post.description_ko ? `description_ko: "${post.description_ko}"` : ''}
${post.image ? `image: "/${post.image}"` : ''}
category: "${post.category}"
${post.subcategory ? `subcategory: "${post.subcategory}"` : ''}
${post.tags ? `tags: ${JSON.stringify(post.tags)}` : ''}
${post.date ? `date: "${post.date}"` : ''}
${post.author ? `author: "${post.author}"` : ''}
${post.series ? `series:\n  name: "${post.series.name}"\n  order: ${post.series.order}` : ''}
${post.color ? `color: "${post.color}"` : ''}
---

`;

    // Read and convert English markdown
    if (fs.existsSync(sourceMd)) {
      let content = fs.readFileSync(sourceMd, 'utf8');
      // Remove title if it exists (first line starting with #)
      content = content.replace(/^#\s+.*\n+/, '');
      fs.writeFileSync(targetMd, frontmatter + content);
      console.log(`✅ Converted: ${mdFile}`);
    }

    // Read and convert Korean markdown
    if (fs.existsSync(sourceKoMd)) {
      let content = fs.readFileSync(sourceKoMd, 'utf8');
      content = content.replace(/^#\s+.*\n+/, '');
      fs.writeFileSync(targetKoMd, frontmatter + content);
      console.log(`✅ Converted: ${koMdFile}`);
    }
  });
}

// Ensure directories exist
['blog', 'work', 'research'].forEach(dir => {
  const targetDir = path.join('src/content', dir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
});

// Convert all collections
console.log('📝 Converting blog posts...');
convertMarkdownWithFrontmatter('blog', blogPosts, '../dawonx-site/content/blog', 'src/content/blog');

console.log('\n📝 Converting work posts...');
convertMarkdownWithFrontmatter('work', workPosts, '../dawonx-site/content/work', 'src/content/work');

console.log('\n📝 Converting research posts...');
convertMarkdownWithFrontmatter('research', researchPosts, '../dawonx-site/content/research', 'src/content/research');

console.log('\n✨ Conversion complete!');
