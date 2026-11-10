# Neva: an AI tutor bot

A single-page tutor for learning AI concepts with interactive visuals and Python.

**Live version:** https://claude.ai/artifact/6YvWAVzn2x7wzpk8kApKyq

## What it covers

| Track            | Lessons |
|------------------|---------|
| Start here       | How the pieces fit together (LLM + vector DB + RAG + MCP) |
| LLMs             | Tokens · Next-token prediction and temperature · Attention |
| Vector databases | Storing records · Searching (top-k, metadata filters, ANN indexes) |
| RAG              | Step 1: ingestion and chunking · The RAG workflow end to end |
| RAG frameworks   | RAG with LlamaIndex · RAG with LangChain (LCEL) |
| MCP              | Hosts, clients and servers · A tool call, message by message |

## Terminology: vector databases only

This course teaches **vector databases**, not vector maths. "Vector" only appears
as part of a database record: the embedding stored next to an id and metadata.

| | Vector databases (`domain: "db"`) |
|---|---|
| What it is | Software: a database system that stores and searches embeddings |
| Key terms | collection, record (id + vector + metadata), add/upsert/get/delete, query, top-k, metadata filter, ANN index |
| Examples | ChromaDB, Pinecone, Weaviate, Qdrant, pgvector |
| Lesson ids | `vector-db-store`, `vector-db-search` |
| Visuals | `vectorDbRecords`, `vectorDbSearch` |
| Python | `class VectorStore`, `class SearchableStore(VectorStore)` |

Rules for learners, the tutor bot and anyone developing this tutor:

- Say **vector database** (or vector DB) for the system, never just "vectors".
- Similarity (cosine) is a built-in database feature. Exercises get `cosine()` from
  `SIMILARITY_PRELUDE`; visuals use `dbSimilarity()`. The maths behind it is not taught.
- Don't add vector-maths lessons. The `TERMINOLOGY` comment in `index.html` says the same.

The Python exercises build on each other: `VectorStore` (storing) → `SearchableStore`
(searching) → the RAG pipeline.

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
