# Gradient: an AI tutor bot

A single-page tutor for learning AI concepts with interactive visuals and Python.

**Live version:** https://claude.ai/artifact/6YvWAVzn2x7wzpk8kApKyq

## What it covers

| Track            | Lessons |
|------------------|---------|
| Start here       | How the pieces fit together (LLM + vector DB + RAG + MCP) |
| LLMs             | Tokens · Next-token prediction and temperature · Attention |
| Vector databases | Similarity search (cosine) · Embeddings · Vector databases (Chroma, Pinecone, Weaviate, Qdrant, pgvector) |
| RAG              | Step 1: ingestion and chunking · The RAG workflow end to end (ingest → embed & store → query & retrieve → augmented generation) |
| MCP              | Hosts, clients and servers · A tool call, message by message |

The Python exercises build on each other: the `cosine()` you write powers your
`VectorStore`, which powers your RAG pipeline.

Each lesson has:

- **Gradient bot**: a tutor (powered by Claude) that greets you, teaches step by step, and sees your code.
- **See it**: an interactive visual (draggable vectors, embedding map, live tokenizer, temperature sampler, attention heatmap, chunk slicer, RAG pipeline, MCP diagram and message flow).
- **Code it**: a Python exercise that runs in the browser (via Brython). Run the tests, fix, run again. Later exercises reuse the code you wrote earlier.
- **Quiz**: fresh multiple-choice questions every time.

## Running it

Open `index.html` through Claude (the live link above) so the bot can use Claude. No API key is needed: calls use the viewer's own Claude account. The visuals and Python exercises also work in any browser; only the bot and quizzes need Claude.
