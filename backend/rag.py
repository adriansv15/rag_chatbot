import os

import chromadb
from dotenv import load_dotenv
from datasets import load_dataset
from huggingface_hub import InferenceClient
import requests

load_dotenv()

# Access the variable
api_key = os.getenv("HF_API_KEY")
api_url = os.getenv("API_URL")

# 1. Setup ChromaDB (Local Persistence)
client = chromadb.PersistentClient(path="./my_vector_db")
collection = client.get_or_create_collection(name="my_knowledge_base")

# 2. Load and Ingest HF Wiki Data (taking first 100 for speed)
dataset = load_dataset("rag-datasets/rag-mini-wikipedia", "text-corpus", split="passages")
sample_data = dataset.select(range(100)) # Adjust this number as needed

# Extract text and IDs from the dataset
wiki_documents = [item["passage"] for item in sample_data]
wiki_ids = [str(item["id"]) for item in sample_data]

# Use upsert to avoid duplicate ID errors
collection.upsert(
    documents=wiki_documents,
    ids=wiki_ids
)

# 3. Retrieve Context (The "R" in RAG)
query = "When was Pascal born?"
results = collection.query(
    query_texts=[query],
    n_results=5  # Get top 2 relevant chunks
)
retrieved_context = " ".join(results['documents'][0])
# print(retrieved_context + '\n')
# 4. Generate Answer (The "G" in RAG)
# Prepare the RAG prompt
prompt = f"Answer the question according to the information given in the context.\n\nContext: {retrieved_context}\n\nQuestion: {query}\n\nAnswer:"

client = InferenceClient(
    api_key=api_key,
)

completion = client.chat.completions.create(
    model="meta-llama/Meta-Llama-3-8B-Instruct:featherless-ai",
    messages=[
        {
            "role": "user",
            "content": prompt,
        }
    ],
)

print('\nAnswer with context')
print(completion.choices[0].message['content'])

prompt = f"Question: {query}\n\nAnswer:"

client = InferenceClient(
    api_key=api_key,
)

completion = client.chat.completions.create(
    model="meta-llama/Meta-Llama-3-8B-Instruct:featherless-ai",
    messages=[
        {
            "role": "user",
            "content": prompt,
        }
    ],
)

print('\nAnswer without context')
print(completion.choices[0].message['content'])