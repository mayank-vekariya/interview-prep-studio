import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
const read = async name => JSON.parse(await readFile(new URL('./content/'+name, import.meta.url), 'utf8'));
const dsa = await read('dsa.json');
const backend = await read('backend.json');
const interview = await read('interview.json');
const ragCode = await readFile(new URL('./examples/rag.mjs', import.meta.url), 'utf8');
const sources = [...(backend.sources||[]),...(interview.sources||[]),
{title:'Node.js: Do not block the event loop',url:'https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop'},
{title:'Express: error handling',url:'https://expressjs.com/en/guide/error-handling/'},
{title:'React: useEffect',url:'https://react.dev/reference/react/useEffect'},
{title:'Ollama: embeddings API',url:'https://docs.ollama.com/api/embed'}];
const data = {lessons:[...dsa.lessons,...backend.lessons,...interview.lessons],exercises:dsa.exercises,
  company:interview.company,videos:interview.videos,mocks:interview.mocks,
  sources:[...new Map(sources.map(s=>[s.url,s])).values()],ragCode};
await writeFile(new URL('./dist/data.js',import.meta.url),'window.COURSE = '+JSON.stringify(data,null,2)+';\n');
await mkdir(new URL('./dist/examples/',import.meta.url),{recursive:true});
for(const name of ['rag.mjs','movies.json']) await copyFile(new URL('./examples/'+name,import.meta.url),new URL('./dist/examples/'+name,import.meta.url));
console.log(`Built ${data.lessons.length+4} lessons, ${data.exercises.length} exercises and ${data.mocks.length} mocks.`);
