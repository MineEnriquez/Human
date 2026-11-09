# Gradient: an AI tutor bot

A single-page tutor for learning AI concepts with interactive visuals and Python.

**Live version:** https://claude.ai/artifact/6YvWAVzn2x7wzpk8kApKyq

## What it covers

| Track            | Lessons |
|------------------|---------|
| Start here       | How the pieces fit together (LLM + vector DB + RAG + MCP) |
| LLMs             | Tokens · Next-token prediction and temperature · Attention |
| Vector math      | Vectors and cosine similarity · Embeddings |
| Vector databases | Storing records · Searching (top-k, metadata filters, ANN indexes) |
| RAG              | Step 1: ingestion and chunking · The RAG workflow end to end |
| RAG frameworks   | RAG with LlamaIndex · RAG with LangChain (LCEL) |
| MCP              | Hosts, clients and servers · A tool call, message by message |

## Terminology: vector math vs vector databases

"Vector" means two different things in this course. Learners and anyone
developing this tutor should keep them apart the same way:

| | Vector math (`domain: "math"`) | Vector databases (`domain: "db"`) |
|---|---|---|
| What it is | Maths: a vector is an ordered list of numbers | Software: a database system that stores and searches vectors |
| Key terms | vector, dot product, norm, cosine similarity, embedding, dimensions | collection, record (id + vector + metadata), add/upsert/get/delete, query, top-k, metadata filter, ANN index |
| Examples | `[3, 4]`, `cosine(a, b)` | ChromaDB, Pinecone, Weaviate, Qdrant, pgvector |
| Lesson ids | `vector-math`, `embeddings` | `vector-db-store`, `vector-db-search` |
| Visuals | `vectorMath`, `embeddingMap` | `vectorDbRecords`, `vectorDbSearch` |
| JS helpers | `mathDot`, `mathNorm`, `mathCosine` | (database visuals call the math helpers) |
| Python | `dot`, `norm`, `cosine` | `class VectorStore`, `class SearchableStore(VectorStore)` |

Rules:

- Say **vector** only for the list of numbers. Say **vector database** (or vector DB) for the system, never just "vectors".
- Vector-math lessons never mention storage. Database lessons may *use* vector math (cosine ranking) and say so.
- Every lesson in those two tracks shows a banner naming its domain, and its glossary cards carry a `math` or `database` tag.
- The tutor bot is instructed to follow the same rules.
- The same conventions are documented in a `TERMINOLOGY` comment at the top of the script in `index.html`.

The Python exercises build on each other: `cosine()` (vector math) is used
by `SearchableStore.query()` (vector database), which powers the RAG pipeline.

Each lesson has:

- **Gradient bot**: a tutor (powered by Claude) that greets you, teaches step by step, and sees your code.
- **See it**: an interactive visual (draggable vectors, embedding map, live tokenizer, temperature sampler, attention heatmap, chunk slicer, RAG pipeline, MCP diagram and message flow).
- **Code it**: a Python exercise that runs in the browser (via Brython). Run the tests, fix, run again. Later exercises reuse the code you wrote earlier.
- **Quiz**: fresh multiple-choice questions every time.

## RAG frameworks (LlamaIndex and LangChain)

Each framework lesson maps every RAG step you built by hand to the framework's
class, shows the real setup code (including swapping in ChromaDB), and has an
exercise written against the framework's real API.

The libraries can't run in the browser, so `FW_LLAMA` and `FW_LANGCHAIN` in
`index.html` are small Python stand-ins that register fake `llama_index.*`,
`langchain_core.*` and `langchain_text_splitters` modules covering only the
calls the exercises use, plus a stand-in embedding model and LLM. A learner's
solution runs unchanged with the real libraries once real models are configured.
If you change an exercise to use another API call, add it to the stand-in too.

Running the lesson code on your own machine needs `pip install` (commands are in
each lesson) and an `ANTHROPIC_API_KEY` for the LLM. The in-browser exercises need
neither.

## Running it

Open `index.html` through Claude (the live link above) so the bot can use Claude. No API key is needed: calls use the viewer's own Claude account. The visuals and Python exercises also work in any browser; only the bot and quizzes need Claude.
