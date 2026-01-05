import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Mic, Square, Play, Send, Loader2 } from 'lucide-react';

function App() {

  // --- STATE MANAGEMENT ---
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState(""); // Stores the AI feedback object
  const [history, setHistory] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('General');

  // --- REFS ---
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Visualizer Refs
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null); 

  // --- TEXT TO SPEECH ---
  const speakText = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1; 
    window.speechSynthesis.speak(utterance);
  };

  // --- VISUALIZER LOGIC (Fixed Cleanup) ---
  useEffect(() => {
    if (isRecording && streamRef.current && canvasRef.current) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(streamRef.current);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const draw = () => {
        if (!isRecording) return;
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = "rgb(20, 20, 20)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i] / 2;
          ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      };
      draw();
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      // FIXED: Only close if not already closed
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isRecording]);

  // --- RECORDING FUNCTIONS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Save for visualizer

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        audioChunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Microphone permission denied!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- UPLOAD FUNCTION ---
  const uploadAudio = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    setTranscript("");
    setAnalysis(null);

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("topic", selectedTopic);

    try {
      const response = await axios.post('http://localhost:3000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setTranscript(response.data.transcript);
      setAnalysis(response.data.analysis);

      // Auto-Speak Feedback
      if (response.data.analysis?.feedback) {
        speakText(response.data.analysis.feedback);
      }

      alert("Transcription Completed!");
      fetchHistory(); // Refresh list

    } catch (error) {
      console.error("Upload failed: ", error);
      alert("Upload failed! Check Console.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- HISTORY FUNCTION ---
  const fetchHistory = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/history');
      if (Array.isArray(response.data)) {
        setHistory(response.data);
      } else if (response.data && Array.isArray(response.data.rows)) {
        setHistory(response.data.rows);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      setHistory([]);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Interview Copilot</h1>

      <div className="flex flex-col items-center gap-6 w-full max-w-2xl">

        {/* TOPIC SELECTOR */}
        <div className="w-full flex flex-col items-center">
          <label className="mb-2 font-bold text-gray-300">Select Interview Topic:</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="p-2 rounded bg-white text-black w-64 text-center font-medium"
          >
            <option value="General">General / Behavioral</option>
            <option value="React">React.js</option>
            <option value="NodeJS">Node.js</option>
            <option value="Python">Python</option>
            <option value="SQL">SQL & Databases</option>
            <option value="DSA">Data Structures</option>
          </select>
        </div>

        {/* VISUALIZER CANVAS */}
        {isRecording && (
          <div className="w-full h-24 bg-black rounded-lg border border-gray-700 overflow-hidden">
            <canvas ref={canvasRef} width="600" height="100" className="w-full h-full" />
          </div>
        )}

        {/* RECORD BUTTON */}
        {!isRecording ? (
          <button onClick={startRecording} className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            <Mic size={40} className="text-white" />
          </button>
        ) : (
          <button onClick={stopRecording} className="w-24 h-24 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-lg animate-pulse">
            <Square size={40} className="text-white" />
          </button>
        )}

        <p className="text-gray-400">
          {isRecording ? "Listening... (Click to Stop)" : "Click mic to record"}
        </p>

        {/* PLAYBACK & UPLOAD */}
        {audioUrl && (
          <div className="mt-6 p-4 bg-gray-800 rounded-lg flex flex-col items-center gap-4 w-full">
            <h3 className="text-sm font-semibold text-gray-300">Playback Preview</h3>
            <audio src={audioUrl} controls className="w-full" />

            <button
              onClick={uploadAudio}
              disabled={isUploading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full font-medium transition-colors disabled:opacity-50"
            >
              {isUploading ? <><Loader2 className="animate-spin" size={18} /> Uploading...</> : <><Send size={18} /> Submit Answer</>}
            </button>
          </div>
        )}

        {/* AI TRANSCRIPT */}
        {transcript && (
          <div className="mt-8 p-6 bg-white rounded-lg shadow-lg w-full text-gray-800 animate-fade-in">
            <h2 className="text-xl font-bold mb-4 border-b border-gray-300 pb-2 text-blue-600">AI Transcript:</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-lg">{transcript}</p>
          </div>
        )}

        {/* AI REPORT CARD (With Speak Button) */}
        {analysis && (
          <div className="mt-8 p-6 bg-slate-800 rounded-xl shadow-2xl w-full border border-slate-700 animate-fade-in">
            <div className="flex items-center justify-between mb-6 border-b border-slate-600 pb-4">
              <h2 className="text-2xl font-bold text-white">AI Analysis</h2>
              <div className={`px-4 py-2 rounded-full font-bold text-xl ${
                (analysis?.score || 0) >= 7 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                Score: {analysis?.score ?? "?"}/10
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-400 uppercase">Feedback</h3>
                <button onClick={() => speakText(analysis.feedback)} className="text-blue-400 hover:text-blue-300 text-xs font-bold uppercase flex items-center gap-1">
                  <Play size={14} /> Listen
                </button>
              </div>
              <p className="text-gray-300 leading-relaxed bg-slate-900/50 p-4 rounded-lg">{analysis?.feedback}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-blue-400 uppercase mb-2">Improvement</h3>
              <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg text-blue-100 italic">
                "{analysis?.better_answer}"
              </div>
            </div>
          </div>
        )}

        {/* HISTORY LIST (Safe Mode) */}
        <div className="w-full mt-12 mb-20">
          <h2 className="text-xl font-bold text-gray-400 mb-4 border-b border-gray-700 pb-2">Interview History</h2>
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`font-bold px-2 py-0.5 rounded text-sm ${
                      (item.json_log?.analysis?.score || 0) >= 7 ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
                    }`}>
                      Score: {item.json_log?.analysis?.score ?? "N/A"}
                    </span>
                    <span className="text-gray-500 text-xs">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-400 text-sm truncate w-64">
                    {item.json_log?.transcript || "No transcript"}
                  </p>
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-gray-500 text-center italic">No history yet.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;