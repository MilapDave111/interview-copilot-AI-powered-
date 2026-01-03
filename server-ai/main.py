import os
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg-2025-12-28-git-9ab2a437a1-full_build\bin"


from fastapi import FastAPI,UploadFile,File, Form
import shutil
import whisper
import traceback
from dotenv import load_dotenv
from groq import Groq
import json

load_dotenv()

app = FastAPI()

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

print("Loading Whisper AI Model... (This might take a moment) ")
model = whisper.load_model("base")
print("Model Loaded!")

@app.get("/")
def read_root():
    return {"message": "Hello from Python AI Service! I am ready."}

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    topic :str = Form("General")
    ):
    try:
        # 1. Save temp file
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"File saved to {temp_filename}. Starting Whisper...")

        # 2. Transcribe
        result = model.transcribe(temp_filename)
        
        print("Transcription success!")
        
        print("Analysing text with Groq...")

        system_prompt = f"""
        You are a strict technical interviewer specializing in {topic}. 
        The user is answering a question about {topic}.
        
        Analyze the user's answer.
        Return ONLY a JSON object with these 3 fields:
        1. "score": A number 1-10.
        2. "feedback": A 2-sentence critique specifically regarding {topic} best practices.
        3. "better_answer": A professional {topic} expert's version of the answer.
        DO NOT output any markdown, just raw JSON.
        """

        chat_completion = client.chat.completions.create(
        messages=[
            {"role":"system","content":system_prompt},
            {"role":"user","content":result["text"]},
        ],
            model="llama-3.1-8b-instant",
            response_format = {"type":"json_object"}
        )

        ai_response_content = chat_completion.choices[0].message.content

        analysis_json = json.loads(ai_response_content)

        return{
            "transcript":result["text"],
            "analysis":analysis_json
        }

    except Exception as e:
        
        print(f"CRITICAL ERROR: {str(e)}")
        traceback.print_exc() 
        return {"error": str(e)}