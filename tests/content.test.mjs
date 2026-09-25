import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const dsa = JSON.parse(await read('content/dsa.json'));
const backend = JSON.parse(await read('content/backend.json'));
const interview = JSON.parse(await read('content/interview.json'));
const generated = await read('dist/data.js');
const html = await read('dist/index.html');

const lessons = [...dsa.lessons, ...backend.lessons, ...interview.lessons];
const unique = values => new Set(values).size === values.length;
if (lessons.length !== 12 || !unique(lessons.map(l => l.id))) throw new Error('Expected 12 unique lessons');
if (dsa.exercises.length !== 15 || !unique(dsa.exercises.map(e => e.id))) throw new Error('Expected 15 unique exercises');
if (interview.mocks.length !== 3 || interview.mocks.some(m => m.rounds.reduce((sum, r) => sum + r.minutes, 0) !== 60)) throw new Error('Mocks must contain three 60-minute rounds');
if (!generated.includes('window.COURSE') || !generated.includes('Two Sum') || !generated.includes('RAG')) throw new Error('Generated data is incomplete');
for (const script of ['foundations.js', 'data.js', 'app.js']) if (!html.includes(`src="${script}"`)) throw new Error(`Missing script ${script}`);
const forbidden = ['turakhiadhruvi21@gmail.com', '+91 99743 79911', 'linkedin.com/in/dhruvi-turakhia'];
if (forbidden.some(value => generated.includes(value))) throw new Error('Personal contact data leaked into site payload');
const allowedTags = new Set(['p','ul','ol','li','pre','code','table','thead','tbody','tr','th','td','blockquote','h4','strong','em','a','br']);
for (const lesson of lessons) for (const section of lesson.sections) {
  for (const match of section.html.matchAll(/<\/?([a-z0-9]+)/gi)) if (!allowedTags.has(match[1].toLowerCase())) throw new Error(`Unexpected content tag ${match[1]}`);
}
console.log(`Validated ${lessons.length} lessons, ${dsa.exercises.length} exercises, ${interview.mocks.length} mocks and generated payload.`);
