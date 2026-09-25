# Interview Studio

An open, self-contained study room for Dhruvi Turakhia's Shownex technical interview preparation.

The complete offline companion is [INTERVIEW_STUDY_GUIDE.md](INTERVIEW_STUDY_GUIDE.md). A [shareable PDF](output/pdf/Dhruvi_Technical_Interview_Study_Guide.pdf) is also available from the site header.

The site is designed for active practice: choose a time plan, read short lessons, check off explanations you can give from memory, solve JavaScript problems, run the browser RAG walkthrough, and give a friend one of the three timed mock interviews.

## Topics

- JavaScript, Node.js, Express, APIs and database reasoning
- Redis cache-aside, TTLs, invalidation, stampedes and failure modes
- AWS scheduling, SQS, idempotency, retries, DLQs and monitoring
- RAG ingestion, retrieval, authorization filters, citations and evaluation
- Arrays, Map, Set and linked-list coding practice
- Shownex-inspired movie discovery system design
- Project-story and resume-claim defense
- A focused React refresh

## Local preview

The published site is static. To preview it locally after changing content:

```text
node build.mjs
python -m http.server 4173 --directory dist
```

Open `http://127.0.0.1:4173/`.

To rebuild the PDF after editing its Markdown source, run `python tools/render_study_guide.py INTERVIEW_STUDY_GUIDE.md output/pdf/Dhruvi_Technical_Interview_Study_Guide.pdf`, then run `node build.mjs` to refresh the downloadable copy.

The optional `examples/rag.mjs` is a local Ollama exercise. It is separate from the browser app and needs Node.js 22+, Ollama, `nomic-embed-text`, and `llama3.2`.

## Content boundary

Public Shownex product descriptions are separated from hypothetical interview practice scenarios. The public site intentionally does not include resume contact details.
