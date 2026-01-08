const pool = require('./db');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const { fork } = require('child_process');

const app = express();
app.use(cors());

const storage = multer.diskStorage({
    destination : function(req, file, cb){
        cb(null,'uploads/');
    },
    filename: function(req, file, cb){
        const uniqiesuffix = Date.now();
        cb(null,'audio-' + uniqiesuffix + '.webm');
    }
})

const upload = multer({
    storage:storage
});

app.get('/api/health',async (req,res) => {
    try{
        const pythonResponse = await axios.get('http://127.0.0.1:8000/');
        res.json({
            node_status: "Node is Working",
            python_status: pythonResponse.data.message
        })

    }catch(error){
        res.status(500).json({error:"Python server is done!"});
    }
});

app.post('/api/upload',upload.single("audio"), async (req,res) => {
    if(!req.file){
        return res.status(400).json({
            error: "No file recieved"
        });
    }
    console.log("File saved successfully! :",req.file.path);

    try{

        const userTopic = req.body.topic || "General";
        console.log("Topic received from Frontend:", userTopic);

        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));
        formData.append('topic', userTopic);
        console.log("Sending file to python AI...");

        const pythonResponse = await axios.post('http://127.0.0.1:8000/transcribe',formData,{
            headers:{
                ...formData.getHeaders()
            }
        });
        console.log("Python replied: ",pythonResponse.data);

        const interviewData = {
            filename:req.file.filename,
            audio_path:req.file.path,
            transcript:pythonResponse.data.transcript,
            analysis:pythonResponse.data.analysis,
            timestamp:new Date()
        };

        const dbResult = await pool.query(
            'insert into interviwes (json_log) values ($1) Returning id',
            [interviewData]
        );

        const newId = dbResult.rows[0].id;
        console.log("Saved into Database with ID : ",newId);

        res.json({
            message:"File processed successfully",
            filename:req.file.filename,
            transcript: pythonResponse.data.transcript,
            analysis:pythonResponse.data.analysis
        });

    }catch(error){
        console.log("AI error:", error.message);
        res.status(500).json({
            error: "AI Transcription failed"
        });
    }
});

app.get('/api/history', async(req,res) => {
    try{
        const result = await pool.query(
            'select * from interviwes order by created_at desc'
        );
        res.json(result.rows);
    }catch(error){
        console.log("Database Error: ", error);
        res.status(500).json({
            error:"Failed to fetch history"
        });
    }
});

app.post('/api/upload-resume',upload.single("resume"), async (req,res) => {
    if(!req.file){
        return res.status(400).json({
            error: "No resume recieved"
        });
    }
    console.log("Resume received successfully! :",req.file.path);
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));

        console.log("Forwarding resume to Python AI...");

        const pythonResponse = await axios.post('http://127.0.0.1:8000/analyze-resume', formData, {
            headers: { ...formData.getHeaders() }
        });

        // --- 🟢 FIX: Check if Python actually returned questions ---
        if (!pythonResponse.data.questions || pythonResponse.data.error) {
            console.error("Python AI Error:", pythonResponse.data);
            return res.status(500).json({ 
                error: "AI failed to generate questions. Ensure PDF is text-based (not an image)." 
            });
        }
        // -----------------------------------------------------------

        console.log("AI Questions Generated:", pythonResponse.data.questions);

        res.json({
            message: "Resume processed successfully",
            questions: pythonResponse.data.questions
        });

    } catch (error) {
        console.error("Resume Processing Error:", error.message);
        res.status(500).json({ error: "Failed to analyze resume" });
    }
});



app.listen(3000, ()=>{
    console.log("Node server running on http://localhost:3000");
});