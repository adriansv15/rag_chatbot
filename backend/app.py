import os
import uuid
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from huggingface_hub import AsyncInferenceClient
import chromadb
from chromadb.api.types import Metadata

from processing import extract_text_from_file

load_dotenv()

# Access the variable
api_key = os.getenv("HF_API_KEY")
api_url = os.getenv("API_URL")


app = FastAPI()

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Initialize your local RAG components once
client = AsyncInferenceClient(api_key=api_key)
chroma_client = chromadb.PersistentClient(path="./my_vector_db")
collection = chroma_client.get_collection(name="my_knowledge_base")
# Create a dedicated collection for chat history
history_collection = chroma_client.get_or_create_collection(name="chat_history")

# 2. Your RAG Logic wrapped for Streaming
async def get_rag_response(query: str, session_id: str, uploaded_text: str):
    # 1. Retrieve the last few messages for this session
    past_chats = history_collection.get(where={"session_id": session_id})
    
    # 2. Build the message history for Hugging Face
    # Start with a System Message or your RAG Context
    messages = [{"role": "system", "content": "You are a helpful assistant."}]
    
    # Add past interactions (User & Assistant)
    for i in range(len(past_chats['ids'])):
        messages.append({
            "role": past_chats['metadatas'][i]['role'],
            "content": past_chats['documents'][i]
        })

    # Step 1: Retrieve context from Chroma
    results = collection.query(
        query_texts=[query],
        n_results=5
    )
    retrieved_context = " ".join(results['documents'][0])
    
    # Step 2: Prepare the Prompt
     # Step 2: Prepare the Prompt with distinct sections
    prompt_parts = []
    
    if retrieved_context:
        prompt_parts.append(f"Retrieved Context:\n{retrieved_context}")
    
    if uploaded_text:
        prompt_parts.append(f"User Uploaded File Context:\n{uploaded_text}")
    
    prompt_parts.append(f"Question: {query}")
    prompt_parts.append("Answer:")

    # Join everything with double newlines
    prompt = "\n\n".join(prompt_parts)
    
    # Add the current user prompt
    messages.append({"role": "user", "content": prompt})
    print(messages)
    # Step 3: Stream from Hugging Face
    # Setting stream=True allows us to yield tokens as they arrive
    full_response = ""
    stream = await client.chat.completions.create(
        model="meta-llama/Meta-Llama-3-8B-Instruct:featherless-ai",
        messages=messages,
        stream=True 
    )

    async for chunk in stream:
        # 1. Check if choices exists and is not empty
        if chunk.choices and len(chunk.choices) > 0:
            content = chunk.choices[0].delta.content
            # 2. Only yield if there is actual text content
            if content:
                full_response += content
                yield content
    
        # 4. Save the NEW interaction to ChromaDB after streaming finishes
    history_collection.add(
        ids=[f"{session_id}_user_{len(past_chats['ids'])}", f"{session_id}_ai_{len(past_chats['ids'])}"],
        documents=[query, full_response],
        metadatas=[{"session_id": session_id, "role": "user"}, {"session_id": session_id, "role": "assistant"}]
    )

@app.get("/new-session")
async def create_session():
    while True:
        new_id = str(uuid.uuid4())
        # Check your database (or ChromaDB) for the ID
        existing = history_collection.get(ids=[new_id])
        
        if not existing['ids']: # If the list is empty, the ID is unique
            return {"session_id": new_id}
        # If it exists (miraculously), the loop runs again to generate a new one

@app.get("/history/{session_id}")
async def get_history(session_id: str):
    # Query ChromaDB for all messages with this session_id
    results = history_collection.get(
        where={"session_id": session_id}
    )
    
    messages = []
    # Results are usually returned in parallel lists (ids, documents, metadatas)
    for i in range(len(results['ids'])):
        messages.append({
            "role": results['metadatas'][i]['role'],
            "content": results['documents'][i]
        })
    
    # Optional: Sort messages if you stored timestamps in metadata
    return {"history": messages}

@app.get("/sessions")
async def list_sessions():
    # Fetch all metadatas from the collection
    results = history_collection.get(include=["metadatas"])
    
    # Extract unique session_ids using a set comprehension
    unique_ids = list({m["session_id"] for m in results["metadatas"] if "session_id" in m})
    
    # Optional: If you saved 'titles' or 'timestamps', you could return objects here
    return {"sessions": unique_ids}

@app.delete("/clear-history/{session_id}")
async def delete_history(session_id: str):
    # This removes all documents associated with the session_id
    history_collection.delete(
        where={"session_id": session_id}
    )
    return {"status": "success", "message": f"History for {session_id} deleted."}

@app.post("/chat")
async def chat_endpoint(
    message: str = Form(...),
    session_id: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    uploaded_text = ""

    # Handle multiple uploaded files
    if files:
        for f in files:
            content = await f.read()
            filename = f.filename or "unknown"
            try:
                text = extract_text_from_file(filename, content)
            except UnicodeDecodeError:
                text = ""  # ignore non-text files
            uploaded_text += "\n" + text

    # Stream the RAG response
    return StreamingResponse(
        get_rag_response(message, session_id, uploaded_text),
        media_type="text/plain"
    )


MAX_TOTAL_SIZE = 1 * 1024 * 1024  # 1MB total

@app.post("/ingest")
async def ingest_files(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # 1. Enforce total size limit
    total_size = 0
    file_contents = []

    for f in files:
        filename = f.filename or "unknown"
        content = await f.read()
        total_size += len(content)

        if total_size > MAX_TOTAL_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Total uploaded file size exceeds 1MB"
            )

        # Decode text
        try:
            text = extract_text_from_file(filename, content)
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not valid UTF‑8 text"
            )

        file_contents.append((f.filename, text))

    # 2. Chunk and ingest each file
    total_chunks = 0

    for filename, text in file_contents:
        chunks = [text[i:i+1000] for i in range(0, len(text), 1000)]
        ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas: List[Metadata] = [
            {"source": filename} for _ in chunks
        ]

        collection.add(
            documents=chunks,
            ids=ids,
            metadatas=metadatas,
        )

        total_chunks += len(chunks)

    return {
        "message": f"Successfully ingested {total_chunks} chunks from {len(files)} files"
    }

@app.get("/rag/files")
async def list_rag_files():
    # 1. Get all metadata from the collection
    results = collection.get(include=['metadatas'])
    metadatas = results.get('metadatas', [])

    # 2. Extract unique filenames from the 'source' key
    # Using a set to ensure filenames aren't duplicated
    unique_sources = list(set(m.get('source') for m in metadatas if m and m.get('source')))
    
    # Return as a list of objects for the frontend
    return [{"id": name, "filename": name} for name in unique_sources]


@app.delete("/rag/files/{filename}")
async def delete_rag_file(filename: str):
    try:
        # Chroma handles bulk deletion via metadata filters
        collection.delete(where={"source": filename})
        return {"message": f"Successfully deleted {filename} from RAG"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
