import os
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg-2025-12-28-git-9ab2a437a1-full_build\bin"


from fastapi import FastAPI,UploadFile,File, Form
import shutil
import whisper
import traceback
from dotenv import load_dotenv
from groq import Groq
import json
from resume_parser import extract_text_from_pdf



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
    topic :str = Form("General"),
    history :str = Form("")
    ):
    try:
        # 1. Save temp file
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"File saved to {temp_filename}. Starting Whisper...")

        # 2. Transcribe
        result = model.transcribe(temp_filename)
        print(f"Transcription: {result['text']}")

        print(f"--- Context from DB ---\n{history}\n-----------------------")

        print(f"Analysing text with Groq for Topic: {topic}...")

        system_prompt = f"""
        You are a strict technical interviewer specializing in {topic}.
        
        CONTEXT HISTORY (Previous conversation):
        {history}
        
        CURRENT USER ANSWER:
        "{result['text']}"
        
        TASK:
        1. Analyze the user's current answer based on the history.
        2. If the history shows they are struggling, ask an easier follow-up.
        3. If they are doing well, ask a harder follow-up or move to a new concept.
        
        OUTPUT FORMAT (JSON ONLY):
        Return a JSON object with these fields:
        1. "score": Number 1-10.
        2. "feedback": A 2-sentence critique + THE NEXT FOLLOW-UP QUESTION.
        3. "better_answer": The ideal technical answer to the user's last point.
        """

        chat_completion = client.chat.completions.create(
        messages=[
            {"role":"system","content":system_prompt}
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
    

@app.post("/analyze-resume")
async def analyse_resume(file: UploadFile=File(...)):
    """
    Receives a PDF resume, extracts text, and asks AI to generate questions.
    """
    try:
        temp_filename = f"resuem_{file.filename}"
        with open(temp_filename,"wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print(f"Resume saved to {temp_filename}. Extracting text...")

        resume_text = extract_text_from_pdf(temp_filename)

        if not resume_text:
            return {"error": "Failed to read PDF text"}

        print("Text Extracting success! Asking GROQ for questions...")

        system_prompt = """
        You are an expert technical interviewer.
        I will give you a candidate's resume text.
        
        TASK:
        Generate 3 specific, hard technical interview questions based ONLY on the projects and skills listed in this resume.
        Do not ask generic questions like "Tell me about yourself."
        Ask about their specific tech stack (e.g., "How did you optimize MongoDB in your ShopApp?").
        
        OUTPUT FORMAT:
        Return ONLY a JSON object with a list of strings called "questions".
        Example: { "questions": ["Question 1...", "Question 2..."] }
        """   

        chat_complition = client.chat.completions.create(
            messages=[
                {"role":"system","content":system_prompt},
                {"role":"user","content" :f"Here is the resume:\n\n{resume_text}"}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type":"json_object"}
        )

        response_content = chat_complition.choices[0].message.content 
        questions_json = json.loads(response_content)

        return{
            "message": "Resume analyzed Successfully!!!",
            "questions":questions_json["questions"]
        } 
    
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}